import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { aiApi } from '../services/aiApi';
import { courseApi, type CourseDto, type CourseProgressResponse } from '../services/api';
import { getCurrentUserFromToken } from '../utils/auth';
import { getApiErrorMessage } from '../utils/apiError';
import { resolveCourseThumbnail } from '../utils/courseImage';
import { buildSmartRecommendations } from '../utils/localCourseAdvisor';
import { rankCoursesByGoal } from '../utils/matchCourseByGoal';

const GOAL_DEBOUNCE_MS = 450;

function excerpt(course: CourseDto, maxLen = 110): string {
  const d = course.description?.trim();
  if (d && d.length > 0) {
    return d.length <= maxLen ? d : `${d.slice(0, maxLen).trim()}…`;
  }
  const bits = [course.category, course.level].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Gợi ý dựa trên tiến độ và sở thích học tập của bạn.';
}

export type AISuggestionsProps = {
  userId?: string;
  courses?: CourseDto[];
  limit?: number;
  className?: string;
  /** Đổi giá trị (vd. tăng số) để gọi lại API gợi ý — nút "Làm mới" ở AiHub */
  refreshToken?: number | string;
  title?: string;
  subtitle?: string;
  /** Hiện link "Trung tâm AI" (Dashboard); tắt khi đang ở trang AiHub */
  showNavLink?: boolean;
  /** Nút Làm mới hoặc tuỳ chỉnh cạnh tiêu đề */
  headerActions?: ReactNode;
  /** Khi API trả rỗng / không khớp catalog, hiển thị tạm các khóa này (vd. slice từ danh mục) */
  emptyFallbackCourses?: CourseDto[];
  /** Thông báo nhỏ phía trên lưới khi đang dùng fallback (tuỳ chọn) */
  fallbackNotice?: string;
  /** Mục tiêu người dùng — gửi kèm API để ưu tiên khóa khớp chủ đề */
  goalText?: string;
  /** Khóa catalog khớp mục tiêu (UUID) — bổ sung cho backend khi có */
  goalCourseId?: string;
};

const AISuggestions = ({
  userId: userIdProp,
  courses: coursesProp,
  limit = 4,
  className = '',
  refreshToken = 0,
  title = 'Gợi ý từ AI',
  subtitle = 'Gợi ý khóa học theo mô hình hybrid (tiến độ, danh mục, độ phổ biến).',
  showNavLink = true,
  headerActions,
  emptyFallbackCourses,
  fallbackNotice,
  goalText,
  goalCourseId,
}: AISuggestionsProps) => {
  const fromToken = getCurrentUserFromToken();
  const userId = userIdProp ?? fromToken?.id ?? '';

  const debouncedGoalText = useDebouncedValue(goalText ?? '', GOAL_DEBOUNCE_MS);
  const debouncedGoalCourseId = useDebouncedValue(goalCourseId ?? '', GOAL_DEBOUNCE_MS);

  const [courses, setCourses] = useState<CourseDto[]>(coursesProp ?? []);
  const [items, setItems] = useState<CourseDto[]>([]);
  /** AI trả mã khóa nhưng không khớp id trong danh mục hiển thị */
  const [aiIdsNotInCatalog, setAiIdsNotInCatalog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(!coursesProp?.length);
  const [error, setError] = useState<string | null>(null);
  const [progressByCourseId, setProgressByCourseId] = useState<
    Record<string, CourseProgressResponse | undefined>
  >({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [advisorInsight, setAdvisorInsight] = useState<string | null>(null);
  const [llmOrderedIds, setLlmOrderedIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (coursesProp?.length) {
      setCourses(coursesProp);
      setLoadingCourses(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingCourses(true);
      try {
        const res = await courseApi.getCourses();
        if (!cancelled) setCourses(res.data ?? []);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coursesProp]);

  const catalogKey = useMemo(() => [...courses.map((c) => c.id)].sort().join('|'), [courses]);

  useEffect(() => {
    if (!userId) {
      setProgressByCourseId({});
      setProgressLoaded(true);
      return;
    }
    if (!courses.length) {
      setProgressByCourseId({});
      setProgressLoaded(true);
      return;
    }
    let cancelled = false;
    setProgressLoaded(false);
    (async () => {
      try {
        const entries = await Promise.all(
          courses.map(async (c) => {
            try {
              const p = await courseApi.getCourseProgress(userId, c.id);
              return [c.id, p] as const;
            } catch {
              return [c.id, undefined] as const;
            }
          })
        );
        if (!cancelled) setProgressByCourseId(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setProgressLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, catalogKey]);

  const coursesRef = useRef(courses);
  coursesRef.current = courses;

  const fetchSeqRef = useRef(0);

  const fetchRecommendations = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setAiIdsNotInCatalog(false);
      setLoading(false);
      setError(null);
      return;
    }
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const gt = debouncedGoalText?.trim();
      const gid = debouncedGoalCourseId?.trim();
      const res = await aiApi.getRecommendations(userId, {
        ...(gt ? { goalText: gt } : {}),
        ...(gid ? { goalCourseId: gid } : {}),
      });
      if (seq !== fetchSeqRef.current) return;
      const raw = res.recommended_courses ?? [];
      const map = new Map<string, CourseDto>();
      for (const c of coursesRef.current) {
        map.set(String(c.id).trim().toLowerCase(), c);
      }
      const resolved = raw
        .map((id) => map.get(String(id).trim().toLowerCase()))
        .filter((c): c is CourseDto => !!c)
        .slice(0, limit);
      setAiIdsNotInCatalog(raw.length > 0 && resolved.length === 0);
      setItems(resolved);
    } catch (e) {
      if (seq !== fetchSeqRef.current) return;
      setError(getApiErrorMessage(e));
      setAiIdsNotInCatalog(false);
      setItems([]);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [userId, catalogKey, limit, debouncedGoalText, debouncedGoalCourseId]);

  useEffect(() => {
    if (loadingCourses) return;
    fetchRecommendations();
  }, [loadingCourses, fetchRecommendations, refreshToken]);

  const showSkeleton =
    loading ||
    loadingCourses ||
    (Boolean(userId) && Boolean(courses.length) && !progressLoaded);

  const smartList = useMemo(() => {
    if (!courses.length) return [];
    return buildSmartRecommendations(courses, progressByCourseId, {
      goalText: debouncedGoalText,
      goalCourseId: debouncedGoalCourseId,
      limit,
    });
  }, [courses, progressByCourseId, debouncedGoalText, debouncedGoalCourseId, limit]);

  useEffect(() => {
    if (!userId) {
      setAdvisorInsight(null);
      setLlmOrderedIds(null);
      return;
    }
    const list = coursesRef.current;
    if (!list.length) {
      setAdvisorInsight(null);
      setLlmOrderedIds(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const res = await aiApi.adviseCourses({
          userId,
          goalText: debouncedGoalText?.trim() || undefined,
          courses: list.map((c) => ({
            id: c.id,
            title: c.title,
            category: c.category,
            level: c.level,
            description: c.description,
          })),
        });
        if (cancelled) return;
        setAdvisorInsight(res.message?.trim() || null);
        setLlmOrderedIds(res.recommended_ids?.length ? res.recommended_ids : null);
      } catch {
        if (!cancelled) {
          setAdvisorInsight(null);
          setLlmOrderedIds(null);
        }
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [userId, catalogKey, debouncedGoalText, refreshToken]);

  const display = useMemo(() => {
    if (showSkeleton || error) {
      return { list: [] as CourseDto[], source: 'none' as const };
    }
    const courseMap = new Map<string, CourseDto>();
    for (const c of courses) {
      courseMap.set(String(c.id).trim().toLowerCase(), c);
    }

    if (llmOrderedIds?.length) {
      const ordered: CourseDto[] = [];
      for (const id of llmOrderedIds) {
        const co = courseMap.get(String(id).trim().toLowerCase());
        if (co) ordered.push(co);
      }
      if (ordered.length) {
        return { list: ordered.slice(0, limit), source: 'advisor' as const };
      }
    }

    if (items.length > 0 && !aiIdsNotInCatalog) {
      return { list: items, source: 'ai' as const };
    }

    if (smartList.length > 0) {
      return { list: smartList, source: 'smart' as const };
    }

    if (emptyFallbackCourses?.length) {
      const g = debouncedGoalText?.trim();
      const ranked = g ? rankCoursesByGoal(g, emptyFallbackCourses) : emptyFallbackCourses;
      return { list: ranked.slice(0, limit), source: 'fallback' as const };
    }
    return { list: [] as CourseDto[], source: 'empty' as const };
  }, [
    showSkeleton,
    error,
    items,
    aiIdsNotInCatalog,
    smartList,
    courses,
    llmOrderedIds,
    limit,
    emptyFallbackCourses,
    debouncedGoalText,
  ]);

  const emptyCatalogNoMatch =
    !showSkeleton &&
    !error &&
    display.source === 'empty' &&
    userId &&
    courses.length > 0;

  const emptyNoCoursesInSystem =
    !showSkeleton &&
    !error &&
    display.source === 'empty' &&
    userId &&
    courses.length === 0;

  return (
    <section className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
          {headerActions}
          {showNavLink ? (
            <Link to="/user/ai" className="text-primary text-sm font-semibold hover:underline">
              Trung tâm AI
            </Link>
          ) : null}
        </div>
      </div>

      {!userId && (
        <p className="text-sm text-slate-500 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          Đăng nhập để nhận gợi ý cá nhân hóa.
        </p>
      )}

      {userId && !showSkeleton && !error && advisorInsight ? (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-indigo-50/90 px-4 py-3 text-sm leading-relaxed text-slate-800">
          <span className="font-bold text-primary">Trợ lý AI · </span>
          {advisorInsight}
        </div>
      ) : null}

      {userId && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchRecommendations()}
            className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-rose-800 border border-rose-200 hover:bg-rose-100/80"
          >
            Thử lại
          </button>
        </div>
      )}

      {userId && display.source === 'fallback' && fallbackNotice && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          {fallbackNotice}
        </div>
      )}

      {userId && emptyNoCoursesInSystem && (
        <p className="text-sm text-slate-600 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 mb-4">
          Chưa có khóa học nào trong hệ thống.
        </p>
      )}

      {userId && emptyCatalogNoMatch && (
        <p className="text-sm text-slate-600 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 mb-4">
          Hiện chưa có khóa phù hợp trong danh mục (có thể bạn đã ghi danh hết các khóa được gợi ý).{' '}
          <Link to="/user/courses" className="font-semibold text-primary hover:underline">
            Xem tất cả khóa học
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showSkeleton &&
          userId &&
          Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
            <div
              key={`sk-${i}`}
              className="rounded-xl border border-slate-200/80 bg-white p-4 flex gap-4 animate-pulse"
            >
              <div className="size-20 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-full bg-slate-200 rounded" />
                <div className="h-3 w-5/6 bg-slate-100 rounded" />
              </div>
            </div>
          ))}

        {!showSkeleton &&
          display.list.map((course) => {
            const badge =
              display.source === 'advisor'
                ? 'Trợ lý AI'
                : display.source === 'smart'
                  ? 'Phù hợp cho bạn'
                  : display.source === 'fallback'
                    ? 'Gợi ý thêm'
                    : display.source === 'ai'
                      ? 'Gợi ý hybrid'
                      : 'Gợi ý';
            return (
              <Link
                key={`${display.source}-${course.id}`}
                to={`/user/course/${course.id}`}
                className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm flex gap-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:bg-slate-50/50"
              >
                <div
                  className="size-20 rounded-lg bg-cover bg-center shrink-0 ring-1 ring-slate-200/80 group-hover:scale-[1.02] transition-transform duration-200"
                  style={{ backgroundImage: `url('${resolveCourseThumbnail(course)}')` }}
                />
                <div className="flex flex-col justify-between py-0.5 min-w-0 flex-1">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="material-symbols-outlined text-primary text-[14px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        auto_awesome
                      </span>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wide">{badge}</span>
                    </div>
                    <h4 className="course-title font-bold text-sm group-hover:text-primary transition-colors line-clamp-2">
                      {course.title}
                    </h4>
                  </div>
                  <p className="course-text text-xs line-clamp-2 mt-1">{excerpt(course)}</p>
                </div>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary self-center shrink-0 text-[20px]">
                  chevron_right
                </span>
              </Link>
            );
          })}
      </div>
    </section>
  );
};

export default AISuggestions;
