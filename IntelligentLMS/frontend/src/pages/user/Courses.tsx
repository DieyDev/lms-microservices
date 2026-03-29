import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { courseApi, CourseDto, CourseProgressResponse } from '../../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';
import { resolveCourseThumbnail } from '../../utils/courseImage';

const Courses = () => {
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

  return (
    <div className="space-y-8 pb-4">
      {/* Header & tabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary/80">Học tập</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Khóa học của tôi</h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? 'Đang tải...' : `Bạn có ${courses.length} khóa học.`}
          </p>
        </div>

        <div className="flex w-fit rounded-2xl border border-slate-200/90 bg-white/80 p-1 shadow-soft backdrop-blur-sm">
          {tabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
        {filteredCourses.map((course) => {
          const progress = progressByCourseId[course.id]?.progressPercentage ?? 0;
          const completed = progressByCourseId[course.id]?.completedLessons ?? 0;
          const total = progressByCourseId[course.id]?.totalLessons ?? 0;
          const lessonsText = total > 0 ? `${completed}/${total} bài` : 'Chưa có tiến độ';
          const tag = course.category || course.level || 'Course';

          return (
          <Link
            key={course.id}
            to={`/user/course/${course.id}`}
            className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card"
          >
            {/* Thumbnail khóa học */}
            <div className="h-44 rounded-2xl mb-5 overflow-hidden relative">
              <img
                src={resolveCourseThumbnail(course)}
                alt={course.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
              <span className="absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-bold bg-black/60 text-white uppercase tracking-widest">
                {tag}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  {tag}
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  {course.price > 0
                    ? `${course.price.toLocaleString('vi-VN')} đ`
                    : 'Miễn phí'}
                </span>
              </div>

              <h4 className="line-clamp-2 h-10 font-bold text-slate-800 transition-colors group-hover:text-primary">
                {course.title}
              </h4>

              {/* Thanh tiến độ học tập */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Tiến độ</span>
                  <span className="text-[10px] font-bold text-primary">{progress}%</span>
                </div>
                <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                   <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                   />
                </div>
              </div>

              {/* Nút học tiếp chỉ hiện khi hover */}
              <div className="pt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-lg shadow-primary/20">
                  Vào học ngay <span className="material-symbols-outlined text-sm">play_arrow</span>
                </button>
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Courses;