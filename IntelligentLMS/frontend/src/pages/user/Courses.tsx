import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { courseApi, CourseDto, CourseProgressResponse } from '../../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';
import { resolveCourseThumbnail } from '../../utils/courseImage';

const Courses = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const qRaw = (searchParams.get('q') || '').trim();
  const q = qRaw.toLowerCase();

  const [activeTab, setActiveTab] = useState('Tất cả');
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [progressByCourseId, setProgressByCourseId] = useState<Record<string, CourseProgressResponse>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const coursesRes = await courseApi.getCourses();
        const list = coursesRes.data ?? [];
        setCourses(list);

        if (!isAuthenticated()) {
          setProgressByCourseId({});
          return;
        }

        const user = getCurrentUserFromToken();
        if (!user) {
          setProgressByCourseId({});
          return;
        }

        const progressEntries = await Promise.all(
          list.map(async (c) => {
            try {
              const p = await courseApi.getCourseProgress(user.id, c.id);
              return [c.id, p] as const;
            } catch {
              return [c.id, { totalLessons: 0, completedLessons: 0, progressPercentage: 0 } as CourseProgressResponse] as const;
            }
          })
        );

        setProgressByCourseId(Object.fromEntries(progressEntries));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const tabs = ['Tất cả', 'Đang học', 'Hoàn thành'];

  const filteredCourses = useMemo(() => {
    if (activeTab === 'Tất cả') return courses;

    const withProgress = courses.map((c) => {
      const p = progressByCourseId[c.id];
      const pct = p?.progressPercentage ?? 0;
      return { course: c, pct };
    });

    if (activeTab === 'Đang học') {
      return withProgress
        .filter(x => x.pct > 0 && x.pct < 100)
        .map(x => x.course);
    }

    // Hoàn thành
    return withProgress
      .filter(x => x.pct >= 100)
      .map(x => x.course);
  }, [activeTab, courses, progressByCourseId]);

  const searchFiltered = useMemo(() => {
    if (!q) return filteredCourses;
    return filteredCourses.filter((c) => {
      const blob = `${c.title} ${c.category} ${c.description}`.toLowerCase();
      return blob.includes(q);
    });
  }, [filteredCourses, q]);

  const groups = useMemo(() => {
    const map = new Map<string, CourseDto[]>();
    for (const c of searchFiltered) {
      const key = (c.category || 'Khác').trim() || 'Khác';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    // sort nhóm theo số lượng giảm dần
    return Array.from(map.entries())
      .map(([title, list]) => ({
        title,
        list: list.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '')),
      }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [searchFiltered]);

  const scrollers = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRow = (key: string, dir: -1 | 1) => {
    const el = scrollers.current[key];
    if (!el) return;
    el.scrollBy({ left: dir * 420, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8 pb-6">
      {/* Header & tabs */}
      <div className="lms-glass px-5 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-primary/80">Học tập</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Danh mục khóa học</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? 'Đang tải...'
                : qRaw
                  ? `Tìm “${qRaw}”: ${searchFiltered.length} khóa khớp.`
                  : `Có ${filteredCourses.length} khóa học trong mục này.`}
            </p>
            {qRaw ? (
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('q');
                  setSearchParams(next, { replace: true });
                }}
                className="mt-2 text-xs font-bold text-primary hover:underline"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            ) : null}
          </div>

          <div className="flex w-fit rounded-2xl border border-slate-200/90 bg-white/80 p-1 shadow-soft backdrop-blur-sm">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  activeTab === tab
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-600">
              {qRaw
                ? `Không tìm thấy khóa khớp “${qRaw}”. Thử từ khóa khác hoặc xóa bộ lọc.`
                : 'Chưa có khóa học nào.'}
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.title} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">code</span>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{g.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollRow(g.title, -1)}
                      className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      aria-label="Cuộn trái"
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollRow(g.title, 1)}
                      className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      aria-label="Cuộn phải"
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/95 to-transparent dark:from-slate-900/70" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white/95 to-transparent dark:from-slate-900/70" />

                  <div
                    ref={(el) => {
                      scrollers.current[g.title] = el;
                    }}
                    className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
                  >
                    {g.list.map((course) => {
                      const progress = progressByCourseId[course.id]?.progressPercentage ?? 0;
                      const tag = course.level || course.category || 'Course';
                      return (
                        <Link
                          key={course.id}
                          to={`/user/course/${course.id}`}
                          className="group w-[220px] shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card dark:bg-slate-900/60"
                        >
                          <div className="relative h-[120px]">
                            <img
                              src={resolveCourseThumbnail(course)}
                              alt={course.title}
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                            <span className="absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                              {tag}
                            </span>
                          </div>

                          <div className="p-3">
                            <p className="course-title line-clamp-2 min-h-[34px] text-sm font-extrabold group-hover:text-primary">
                              {course.title}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="course-muted text-[10px] font-black uppercase tracking-widest">Tiến độ</span>
                              <span className="text-[10px] font-black text-primary tabular-nums">{progress}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-gradient-to-r from-primary to-blue-500" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Courses;