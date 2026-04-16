import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { courseApi, CourseDto, type CourseProgressResponse } from '../../services/api';
import { aiApi, DropoutRiskResponse } from '../../services/aiApi';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';
import { getApiErrorMessage } from '../../utils/apiError';
import { findCourseIdMatchingGoal } from '../../utils/matchCourseByGoal';
import AISuggestions from '../../components/AISuggestions';
import RoadmapGraph from '../../components/RoadmapGraph';

type TabKey = 'recommend' | 'learning_path' | 'dropout';

const tabMeta: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'recommend', label: 'Gợi ý khóa học', icon: 'auto_awesome' },
  { key: 'learning_path', label: 'Lộ trình của tôi', icon: 'timeline' },
  { key: 'dropout', label: 'Nhịp học', icon: 'favorite' },
];

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

const riskTone = (risk?: string) => {
  const r = (risk || '').toUpperCase();
  if (r === 'HIGH') return { bg: 'bg-blue-50', text: 'text-blue-900', dot: 'bg-primary' };
  if (r === 'MEDIUM') return { bg: 'bg-sky-50', text: 'text-sky-800', dot: 'bg-sky-500' };
  return { bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500' };
};

/** Lời đặt tên tích cực — tránh cảm giác “bị hù” */
const rhythmHeadline = (risk?: string) => {
  const r = (risk || '').toUpperCase();
  if (r === 'HIGH')
    return {
      title: 'Đang cần chút không gian',
      hint: 'Không sao cả — nhiều người cũng lúc nhanh lúc chậm. Thử nghỉ ngắn rồi quay lại từng bước nhỏ.',
    };
  if (r === 'MEDIUM')
    return { title: 'Nhịp học đang hơi trầm', hint: 'Một vài phút mỗi ngày cũng đủ để giữ lửa — bạn làm được.' };
  return { title: 'Nhịp học đang ổn', hint: 'Tiếp tục như vậy là tuyệt — đừng quên thưởng cho bản thân nhé.' };
};

const factorLabel = (key: string): string => {
  const k = key.toLowerCase();
  if (k.includes('progress')) return 'Tiến độ (gợi ý)';
  if (k.includes('inactive') || k.includes('day')) return 'Ngày không học';
  if (k.includes('unknown')) return 'Dữ liệu';
  return key.replace(/_/g, ' ');
};

const dropoutReasonVi = (s: string): string => {
  const m: Record<string, string> = {
    'High inactivity detected (over 14 days)': 'Đã lâu bạn chưa vào học (hơn 14 ngày) — thử quay lại từng bài ngắn.',
    'Moderate inactivity detected (over 7 days)': 'Khoảng hơn một tuần chưa học — mở lại khóa vài phút cũng được.',
    'Low progress indicating disengagement': 'Tiến độ còn thấp — chọn một bài ngắn để lấy lại nhịp.',
    'Progress stalling': 'Tiến độ đang hơi chậm — bước nhỏ vẫn là tiến bộ.',
    'No historical data for user': 'Chưa có đủ dữ liệu học — học thêm vài bài để gợi ý nhịp chính xác hơn.',
    'Feature engineering failed': 'Chưa phân tích được nhịp học tạm thời — thử lại sau.',
  };
  return m[s] ?? s;
};

const QUICK_GOALS = [
  'Python & backend',
  'Phân tích dữ liệu',
  'React / TypeScript',
  'Machine learning cơ bản',
  'DevOps & Docker',
  'An toàn thông tin',
];

type StepStatus = 'completed' | 'current' | 'locked';

type LearningStep = {
  course: CourseDto;
  progress: CourseProgressResponse | null;
  status: StepStatus;
};

const normalizeText = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

function resolveCourseFromToken(token: string, courses: CourseDto[], byId: Map<string, CourseDto>): CourseDto | null {
  const raw = (token || '').trim();
  if (!raw) return null;

  // 1) token là id
  const direct = byId.get(raw) ?? byId.get(raw.toLowerCase());
  if (direct) return direct;

  const nt = normalizeText(raw);
  if (!nt) return null;

  // 2) match theo title "bằng nhau" sau normalize
  for (const c of courses) {
    if (normalizeText(c.title) === nt) return c;
  }

  // 3) match theo contains (token nằm trong title hoặc ngược lại)
  let best: { c: CourseDto; score: number } | null = null;
  for (const c of courses) {
    const titleN = normalizeText(c.title);
    if (!titleN) continue;
    let score = 0;
    if (titleN.includes(nt)) score += 6;
    if (nt.includes(titleN)) score += 3;
    const catN = normalizeText(c.category || '');
    if (catN && (catN.includes(nt) || nt.includes(catN))) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  if (best && best.score >= 5) return best.c;

  // 4) fallback: dùng matcher hiện có (đã lọc stopwords), nhưng vẫn phải có kết quả chắc chắn
  const guessedId = findCourseIdMatchingGoal(raw, courses);
  if (guessedId) return byId.get(guessedId) ?? byId.get(guessedId.toLowerCase()) ?? null;

  return null;
}

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div
        className="lms-ai-orb flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-indigo-500 to-indigo-600 text-white shadow-lg shadow-primary/25"
        aria-hidden
      >
        <span className="material-symbols-outlined text-[22px]">psychology</span>
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-200/90 bg-white/95 px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-soft">
        {children}
      </div>
    </div>
  );
}

function AiTypingLine({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/80 px-4 py-3 text-sm text-slate-600"
      role="status"
      aria-live="polite"
    >
      <span className="lms-ai-typing flex gap-1" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span>{label}</span>
    </div>
  );
}

export default function AiHub() {
  const user = getCurrentUserFromToken();
  const [tab, setTab] = useState<TabKey>('recommend');

  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [recRefresh, setRecRefresh] = useState(0);

  const [goalText, setGoalText] = useState('');
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [pathRawTokens, setPathRawTokens] = useState<string[]>([]);
  const [pathUnmatchedCount, setPathUnmatchedCount] = useState(0);
  const [pathMessage, setPathMessage] = useState<string>('');
  /** Khóa mục tiêu AI chọn (đặc biệt khi dùng mục tiêu tự nhập) — để highlight bước cuối */
  const [pathResolvedGoalId, setPathResolvedGoalId] = useState<string>('');

  const [pathSteps, setPathSteps] = useState<LearningStep[]>([]);
  const [pathStepsLoading, setPathStepsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [dropLoading, setDropLoading] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropoutRiskResponse | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadCourses = async () => {
      setLoadingCourses(true);
      try {
        const res = await courseApi.getCourses();
        const list = res.data ?? [];
        setCourses(list);
      } finally {
        setLoadingCourses(false);
      }
    };
    loadCourses();
  }, []);

  const courseById = useMemo(() => {
    const map = new Map<string, CourseDto>();
    for (const c of courses) {
      map.set(c.id, c);
      map.set(String(c.id).trim().toLowerCase(), c);
    }
    return map;
  }, [courses]);

  const fallbackCourses = useMemo(() => (courses || []).slice(0, 6), [courses]);

  /** Khóa catalog khớp mục tiêu — gửi kèm gợi ý & lộ trình */
  const goalCourseIdResolved = useMemo(() => {
    const t = goalText.trim();
    if (!t) return undefined;
    return findCourseIdMatchingGoal(t, courses);
  }, [goalText, courses]);

  const fetchLearningPath = async () => {
    if (!user?.id) return;
    const trimmed = goalText.trim();
    if (!trimmed) {
      setPathError('Nhập mục tiêu (ví dụ: Python, lập trình web) để AI dựng lộ trình.');
      return;
    }
    setPathLoading(true);
    setPathError(null);
    try {
      const userId = user.id;
      let path: string[] = [];
      let message = '';
      let resolvedGoal = '';

      /** Ưu tiên lộ trình từ catalog (DB): prerequisite / thứ tự gợi ý trên khóa thật. */
      if (goalCourseIdResolved) {
        try {
          const cat = await courseApi.getLearningPathOrder(goalCourseIdResolved);
          const d = cat.data;
          if (d?.path?.length) {
            path = d.path;
            resolvedGoal = d.goalCourseId || goalCourseIdResolved;
            message =
              (d.message || '').trim() || 'Lộ trình theo danh mục và điều kiện tiên quyết trên hệ thống.';
          }
        } catch {
          /* thử AI bên dưới */
        }
      }

      /** Khi chưa có từ catalog (hoặc chưa đoán được khóa mục tiêu) — thử AI bổ sung. */
      if (!path.length) {
        try {
          const res = await aiApi.getLearningPath(userId, {
            goalText: trimmed,
            ...(goalCourseIdResolved ? { goalCourseId: goalCourseIdResolved } : {}),
          });
          path = res.path ?? [];
          message = (res.message || '').trim() || message;
          resolvedGoal = (res.goal_course_id || '').trim() || resolvedGoal;
        } catch {
          /* đã thử catalog ở trên nếu có goalCourseIdResolved */
        }
      }

      // IMPORTANT: AI có thể trả về id hoặc title. Ta resolve sang id catalog nếu được.
      const tokens = (path || []).map((x) => String(x || '').trim()).filter(Boolean);
      const resolved: string[] = [];
      let unmatched = 0;
      for (const t of tokens) {
        const c = resolveCourseFromToken(t, courses, courseById);
        if (c) resolved.push(c.id);
        else {
          unmatched += 1;
          // vẫn giữ token để hiển thị, nhưng tránh gọi progress bằng id rác
          resolved.push(t);
        }
      }

      setPathRawTokens(tokens);
      setPathUnmatchedCount(unmatched);
      setPathIds(resolved);
      setPathMessage(message);
      setPathResolvedGoalId(resolvedGoal || goalCourseIdResolved || '');
      if (path.length) {
        setPathError(null);
      } else {
        setPathError(
          message ||
            'Chưa dựng được lộ trình. Thử mô tả gần với tên khóa hoặc danh mục trên hệ thống, rồi bấm lại.'
        );
      }
    } catch (e: any) {
      setPathError(getApiErrorMessage(e) || 'Chưa tạo được lộ trình cá nhân. Kiểm tra kết nối hoặc thử lại.');
      setPathIds([]);
      setPathMessage('');
      setPathResolvedGoalId('');
    } finally {
      setPathLoading(false);
    }
  };

  const fetchDropout = useCallback(async () => {
    if (!user?.id) return;
    setDropLoading(true);
    setDropError(null);
    try {
      const res = await aiApi.getDropoutRisk(user.id);
      setDrop(res);
    } catch (e: any) {
      setDropError(getApiErrorMessage(e) || 'Chưa lấy được gợi ý nhịp học. Thử lại sau nhé.');
      setDrop(null);
    } finally {
      setDropLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated() || !user?.id) return;
    if (tab === 'dropout') void fetchDropout();
  }, [tab, user?.id, fetchDropout]);

  /** Chỉ xóa kết quả khi xoá hết nội dung mục tiêu — tránh mất kết quả mỗi lần gõ */
  useEffect(() => {
    if (goalText.trim() !== '') return;
    setPathIds([]);
    setPathMessage('');
    setPathError(null);
    setPathResolvedGoalId('');
    setPathSteps([]);
    setPathRawTokens([]);
    setPathUnmatchedCount(0);
  }, [goalText]);

  useEffect(() => {
    const loadSteps = async () => {
      if (!user?.id) return;
      if (pathIds.length === 0) {
        setPathSteps([]);
        return;
      }

      setPathStepsLoading(true);
      try {
        const steps = await Promise.all(
          pathIds.map(async (cid): Promise<LearningStep> => {
            const c =
              courseById.get(cid) ?? courseById.get(String(cid).trim().toLowerCase());
            const course: CourseDto =
              c ??
              ({
                id: String(cid),
                title: String(cid),
                description: '',
                level: '',
                category: '',
                instructorId: '',
                price: 0,
              } satisfies CourseDto);

            let progress: CourseProgressResponse | null = null;
            // Chỉ gọi progress khi course thật sự nằm trong catalog (tránh token/tên khóa)
            if (c) {
              try {
                progress = await courseApi.getCourseProgress(user.id, course.id);
              } catch {
                progress = null;
              }
            }

            const pct = progress?.progressPercentage ?? 0;
            let status: StepStatus = 'locked';
            if (pct >= 100) status = 'completed';
            else if (pct > 0) status = 'current';

            return { course, progress, status };
          })
        );

        setPathSteps(steps);
      } finally {
        setPathStepsLoading(false);
      }
    };

    void loadSteps();
  }, [pathIds, user?.id, courseById]);

  if (!isAuthenticated() || !user) {
    return (
      <div className="mx-auto max-w-3xl px-2 py-10">
        <div className="lms-glass p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-primary/80">AI</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Trợ lý học tập</h2>
          <p className="mt-2 text-slate-600">Đăng nhập để AI đồng hành theo tiến độ của bạn.</p>
          <Link
            to="/auth/login"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  const greetName =
    user.fullName?.split(/\s+/).filter(Boolean)[0] || user.email?.split('@')[0] || 'bạn';

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8 pt-2">
      <div className="lms-mesh-bg relative overflow-hidden rounded-[2rem] border border-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.07)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/55 via-transparent to-indigo-50/40" />
        <div className="relative px-4 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <div
                className="lms-ai-orb flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-primary via-indigo-500 to-indigo-700 text-white shadow-xl shadow-primary/30"
                aria-hidden
              >
                <span className="material-symbols-outlined text-[30px]">smart_toy</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-primary/90">Trợ lý học tập</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Chào {greetName}, mình đồng hành cùng bạn
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                  Đây không phải ô tìm kiếm — hãy nói mục tiêu của bạn như đang trò chuyện: mình sẽ gợi ý khóa, dựng lộ
                  trình và nhắc nhịp học phù hợp tiến độ.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {tabMeta.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                    tab === t.key
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15 ring-1 ring-slate-900/10'
                      : 'border border-slate-200/90 bg-white/85 text-slate-700 shadow-soft hover:bg-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {(tab === 'recommend' || tab === 'learning_path') && (
            <div className="mt-8 space-y-5 border-t border-slate-200/70 pt-8">
              <AssistantBubble>
                <p className="font-semibold text-slate-900">Bạn đang hướng tới điều gì?</p>
                <p className="mt-1.5 text-slate-600">
                  Gõ ngắn gọn cũng được — ví dụ &quot;học Python để làm API&quot; hoặc &quot;ôn React cho dự án công ty&quot;. Để trống thì
                  mình vẫn gợi ý khóa theo tiến độ của bạn; gợi ý khóa tự cập nhật sau khoảng nửa giây khi bạn ngừng gõ.
                </p>
              </AssistantBubble>

              <div className="flex flex-wrap gap-2 pl-[3.25rem] sm:pl-0">
                {QUICK_GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoalText(g)}
                    className="rounded-full border border-slate-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary/35 hover:bg-primary/[0.06] hover:text-primary"
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="pl-[3.25rem] sm:pl-0">
                <div className="relative rounded-[1.35rem] border border-slate-200/90 bg-slate-900/[0.03] p-1 shadow-inner shadow-slate-900/5">
                  <div className="absolute left-4 top-4 text-slate-400" aria-hidden>
                    <span className="material-symbols-outlined text-[22px]">edit_square</span>
                  </div>
                  <label htmlFor="ai-hub-goal" className="sr-only">
                    Mục tiêu học tập
                  </label>
                  <textarea
                    id="ai-hub-goal"
                    value={goalText}
                    onChange={(e) => setGoalText(e.target.value)}
                    rows={3}
                    placeholder="Viết vài dòng cho mình… (tuỳ chọn)"
                    className="w-full resize-none rounded-[1.2rem] bg-white px-4 py-3.5 pl-12 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none ring-1 ring-slate-200/80 focus:ring-2 focus:ring-primary/35"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {tab === 'recommend' ? (
                    <>
                      Ở tab này mình <span className="font-semibold text-slate-700">tự điều chỉnh gợi ý khóa</span> theo đoạn bạn
                      gõ — không cần bấm tìm.
                    </>
                  ) : (
                    <>
                      Ở tab <span className="font-semibold text-slate-700">Lộ trình</span>, sau khi gõ xong hãy bấm nút bên dưới để
                      mình dựng chuỗi bước học.
                    </>
                  )}
                </p>
              </div>

              {tab === 'learning_path' && (
                <div className="flex flex-col gap-3 pl-[3.25rem] sm:flex-row sm:items-center sm:pl-0">
                  <button
                    type="button"
                    onClick={fetchLearningPath}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/25 ring-1 ring-primary/30 transition hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/30 disabled:opacity-60 disabled:shadow-none disabled:ring-0"
                    disabled={pathLoading || !goalText.trim()}
                  >
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    {pathLoading ? 'Mình đang dựng lộ trình…' : 'Dựng lộ trình học cho mình'}
                  </button>
                  <p className="text-xs text-slate-500 sm:max-w-xs">
                    Kết hợp danh mục khóa trên hệ thống và tiến độ của bạn — không chỉ là một danh sách tĩnh.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {tab === 'recommend' && (
        <div className="lms-glass p-6 sm:p-8">
          {loadingCourses ? (
            <AiTypingLine label="Đang mở danh mục khóa trên hệ thống…" />
          ) : (
            <AISuggestions
              userId={user.id}
              courses={courses}
              limit={6}
              refreshToken={recRefresh}
              goalText={goalText}
              goalCourseId={goalCourseIdResolved}
              title={goalText.trim() ? 'Mình đã chọn vài khóa phù hợp mục tiêu của bạn' : 'Dựa trên tiến độ, mình gợi ý các khóa này'}
              subtitle={
                goalText.trim()
                  ? 'Trợ lý và mô hình gợi ý kết hợp tiến độ — bạn có thể đổi mục tiêu phía trên bất cứ lúc nào.'
                  : 'Bạn có thể thêm vài dòng mục tiêu ở khung phía trên để mình “hiểu” rõ hơn chủ đề bạn muốn.'
              }
              showNavLink={false}
              emptyFallbackCourses={fallbackCourses}
              fallbackNotice="Một vài khóa khác trong danh mục — xem thêm nếu bạn muốn mở rộng chủ đề."
              headerActions={
                <button
                  type="button"
                  onClick={() => setRecRefresh((x) => x + 1)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-soft transition hover:border-primary/25 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                  Gợi ý lại
                </button>
              }
            />
          )}
        </div>
      )}

      {tab === 'learning_path' && (
        <div className="lms-glass p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Lộ trình các bước học</h3>
              <p className="mt-1 text-sm text-slate-600">
                Sau khi bạn bấm <span className="font-semibold text-slate-800">Dựng lộ trình học cho mình</span> ở khung phía
                trên, mình ghép khóa trong catalog theo tiên quyết và mục tiêu — hiển thị dưới đây như một cuộc trả lời.
              </p>
            </div>
          </div>

          {pathError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {pathError}
            </div>
          )}

          {pathLoading ? (
            <div className="mt-2">
              <AiTypingLine label="Đang xếp thứ tự khóa theo catalog và mục tiêu của bạn…" />
            </div>
          ) : (
            <>
              {pathIds.length === 0 ? (
                <div className="mt-2">
                  <AssistantBubble>
                    {pathMessage ? (
                      <p className="font-medium text-slate-800">{pathMessage}</p>
                    ) : (
                      <p className="text-slate-700">
                        Chưa có chuỗi bước để hiển thị. Hãy gõ mục tiêu gần với{' '}
                        <span className="font-semibold">tên hoặc danh mục khóa</span> trên hệ thống, rồi bấm{' '}
                        <span className="font-semibold">Dựng lộ trình học cho mình</span> ở phần trên.
                      </p>
                    )}
                  </AssistantBubble>
                </div>
              ) : (
                <div className="mt-2 space-y-5">
                  {pathMessage ? (
                    <AssistantBubble>
                      <p className="font-semibold text-slate-900">Giải thích nhanh</p>
                      <p className="mt-1 text-slate-700">{pathMessage}</p>
                    </AssistantBubble>
                  ) : null}
                  {pathUnmatchedCount > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                      Có <span className="font-extrabold">{pathUnmatchedCount}</span> bước AI trả về chưa khớp chính xác với danh mục khóa trên hệ thống.
                      <span className="ml-1 font-normal text-amber-700">
                        (Thường do AI trả “tên khóa” khác nhẹ so với catalog.) Bạn thử gõ mục tiêu sát tên khóa/danh mục hơn để khớp tốt hơn.
                      </span>
                    </div>
                  ) : null}
                  {pathStepsLoading ? (
                    <div className="mt-2">
                      <AiTypingLine label="Đang tải tiến độ từng khóa để vẽ roadmap…" />
                    </div>
                  ) : isMobile ? (
                    <div className="relative space-y-8 pl-6">
                      <div className="absolute left-4 top-0 bottom-0 w-[2px] bg-blue-100" />
                      {pathSteps.map((step, idx) => {
                        const pct = step.progress?.progressPercentage ?? 0;
                        const icon =
                          step.status === 'completed'
                            ? 'check_circle'
                            : step.status === 'current'
                              ? 'play_circle'
                              : 'lock';
                        const isGoal = pathResolvedGoalId
                          ? String(step.course.id).toLowerCase() === String(pathResolvedGoalId).toLowerCase()
                          : false;

                        return (
                          <motion.div
                            key={`${step.course.id}-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.06, duration: 0.35, ease: 'easeOut' }}
                            className="relative flex items-center gap-5"
                          >
                            <div
                              className={`size-8 rounded-full z-10 flex items-center justify-center border-4 border-white shadow-sm ${
                                step.status === 'completed'
                                  ? 'bg-blue-600 text-white'
                                  : step.status === 'current'
                                    ? 'bg-white text-blue-600 border-blue-600'
                                    : 'bg-gray-200 text-gray-400'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">{icon}</span>
                            </div>

                            <div
                              className={`min-w-0 flex-1 rounded-2xl border p-4 transition-colors ${
                                isGoal
                                  ? 'border-primary/25 bg-primary/[0.06]'
                                  : step.status === 'current'
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-white/90 border-slate-200/70'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <p
                                    className={`truncate font-extrabold ${
                                      step.status === 'locked' ? 'text-gray-400' : 'text-slate-900'
                                    }`}
                                  >
                                    {step.course.title}
                                  </p>
                                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    {(isGoal ? 'Mục tiêu' : 'Bước') +
                                      ' · ' +
                                      (step.course.level || step.course.category || 'Khóa học')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-primary tabular-nums">{pct}%</span>
                                  <Link
                                    to={`/user/course/${step.course.id}`}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                                  >
                                    Vào học
                                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-full">
                      <RoadmapGraph steps={pathSteps} />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <p>
                          Mẹo: kéo để pan, cuộn để zoom, bấm vào một node để xem chi tiết.
                        </p>
                        {pathResolvedGoalId ? (
                          <p className="font-semibold text-slate-600">
                            Node mục tiêu: <span className="text-primary">{pathResolvedGoalId}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'dropout' && (
        <div className="lms-glass p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Nhịp học & động lực</h3>
              <p className="mt-1 text-sm text-slate-600">Gợi ý thân thiện dựa trên tiến độ — để bạn tự điều chỉnh, không phải “điểm trừ”.</p>
            </div>
            <button
              type="button"
              onClick={fetchDropout}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-soft transition hover:border-primary/25 hover:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Cập nhật
            </button>
          </div>

          {dropError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
              {dropError}
            </div>
          )}

          {dropLoading ? (
            <div className="mt-6">
              <AiTypingLine label="Đang đọc nhanh nhịp học gần đây của bạn…" />
            </div>
          ) : drop ? (
            (() => {
              const r = (drop.risk_level || '').toUpperCase();
              const chip = r === 'HIGH' ? 'Cần chút không gian' : r === 'MEDIUM' ? 'Có thể tăng nhịp nhẹ' : 'Đang ổn định';
              const tone = riskTone(drop.risk_level);
              const copy = rhythmHeadline(drop.risk_level);
              return (
                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/90 p-6 shadow-soft lg:col-span-2">
                    <p className="text-sm font-bold text-slate-800">{copy.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.hint}</p>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${tone.bg} ${tone.text}`}>
                        <span className={`size-2 rounded-full ${tone.dot}`} />
                        {chip}
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mức cần chú ý</p>
                        <p className="text-lg font-extrabold tabular-nums text-slate-800">{(drop.probability * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="mt-4 w-full">
                      <svg viewBox="0 0 100 6" className="h-2 w-full overflow-hidden rounded-full" preserveAspectRatio="none" role="img" aria-label="Mức cần chú ý (thấp hơn là nhẹ nhàng hơn)">
                        <defs>
                          <linearGradient id="ai-rhythm-bar" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="rgb(186, 230, 253)" />
                            <stop offset="100%" stopColor="rgb(99, 102, 241)" />
                          </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="100" height="6" rx="3" fill="rgb(241, 245, 249)" />
                        <rect x="0" y="0" width={clampPct(drop.probability * 100)} height="6" rx="3" fill="url(#ai-rhythm-bar)" />
                      </svg>
                      <p className="mt-2 text-xs text-slate-500">Chỉ là gợi ý — bạn vẫn là người quyết định lịch học.</p>
                    </div>
                    {drop.reasons && drop.reasons.length > 0 ? (
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-white/80 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Góc nhìn thêm</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                          {drop.reasons.slice(0, 4).map((line, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-primary">✓</span>
                              <span>{dropoutReasonVi(line)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {Object.entries(drop.factors || {}).map(([k, v]) => (
                        <div key={k} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{factorLabel(k)}</p>
                          <p className="mt-1 text-lg font-extrabold text-slate-900 tabular-nums">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-blue-100/80 bg-gradient-to-b from-blue-50/50 to-white p-6 shadow-soft">
                    <h4 className="text-sm font-extrabold text-slate-900">Thử hôm nay</h4>
                    <p className="mt-1 text-xs text-slate-500">Mấy ý nhỏ, không áp lực:</p>
                    <ul className="mt-4 space-y-3 text-sm font-medium leading-relaxed text-slate-700">
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Mở app 3 phút — chỉ cần xem lại bài đang dở.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Một bài học thôi, xong là thắng ngày.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>Bận thì học 10 phút; nghỉ cũng là một phần của tiến độ.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-600">
              Chưa có dữ liệu — bấm Cập nhật hoặc học thêm vài bài để AI có gì để “đồng hành” nhé.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
