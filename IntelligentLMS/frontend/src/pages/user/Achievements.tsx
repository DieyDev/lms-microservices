import { useEffect, useState } from 'react';
import { courseApi, CourseDto, CourseProgressResponse } from '../../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';

interface ProgressSummary {
  totalCourses: number;
  enrolledCourses: number;
  completedCourses: number;
  totalLessonsCompleted: number;
}

const Achievements = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!isAuthenticated()) {
          setSummary(null);
          return;
        }
        const user = getCurrentUserFromToken();
        if (!user) {
          setSummary(null);
          return;
        }

        const coursesRes = await courseApi.getCourses();
        const courses = (coursesRes.data ?? []) as CourseDto[];
        if (courses.length === 0) {
          setSummary({
            totalCourses: 0,
            enrolledCourses: 0,
            completedCourses: 0,
            totalLessonsCompleted: 0,
          });
          return;
        }

        const entries = await Promise.all(
          courses.map(async (c) => {
            try {
              const p = await courseApi.getCourseProgress(user.id, c.id);
              return { course: c, progress: p as CourseProgressResponse };
            } catch {
              return null;
            }
          })
        );

        const valid = entries.filter((e): e is { course: CourseDto; progress: CourseProgressResponse } => !!e);
        const enrolledCourses = valid.filter(x => (x.progress.progressPercentage ?? 0) > 0).length;
        const completedCourses = valid.filter(x => (x.progress.progressPercentage ?? 0) >= 100).length;
        const totalLessonsCompleted = valid.reduce(
          (acc, x) => acc + (x.progress.completedLessons ?? 0),
          0
        );

        setSummary({
          totalCourses: courses.length,
          enrolledCourses,
          completedCourses,
          totalLessonsCompleted,
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const badges = (() => {
    const s = summary;
    return [
      {
        label: 'Bắt đầu hành trình',
        desc: 'Hoàn thành ít nhất 1 bài học.',
        icon: 'flag',
        unlocked: (s?.totalLessonsCompleted ?? 0) >= 1,
        color: 'text-emerald-500',
      },
      {
        label: 'Hoàn thành khóa đầu tiên',
        desc: 'Hoàn thành 1 khóa học bất kỳ.',
        icon: 'emoji_events',
        unlocked: (s?.completedCourses ?? 0) >= 1,
        color: 'text-yellow-500',
      },
      {
        label: 'Học viên chăm chỉ',
        desc: 'Hoàn thành từ 20 bài học trở lên.',
        icon: 'local_fire_department',
        unlocked: (s?.totalLessonsCompleted ?? 0) >= 20,
        color: 'text-orange-500',
      },
      {
        label: 'Chuyên cần 3 khóa',
        desc: 'Hoàn thành ít nhất 3 khóa học.',
        icon: 'star',
        unlocked: (s?.completedCourses ?? 0) >= 3,
        color: 'text-purple-500',
      },
    ];
  })();

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Thành tích & Kỷ lục</h2>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? 'Đang đồng bộ dữ liệu học tập...'
              : !summary
              ? 'Hãy đăng nhập và bắt đầu một khóa học để mở khóa huy hiệu đầu tiên.'
              : `Bạn đã hoàn thành ${summary.totalLessonsCompleted} bài học và ${summary.completedCourses} khóa.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {badges.map((item, i) => {
          const unlocked = item.unlocked;
          return (
            <div
              key={i}
              className={`p-6 rounded-3xl border text-center flex flex-col items-center gap-3 ${
                unlocked
                  ? 'bg-white border-emerald-100 shadow-sm shadow-emerald-50'
                  : 'bg-gray-50 border-dashed border-gray-200 opacity-80'
              }`}
            >
              <div
                className={`size-16 rounded-full flex items-center justify-center mb-2 ${
                  unlocked ? 'bg-emerald-50' : 'bg-gray-100'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-4xl ${
                    unlocked ? item.color : 'text-gray-400'
                  }`}
                >
                  {item.icon}
                </span>
              </div>
              <p
                className={`text-sm font-bold leading-tight ${
                  unlocked ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {item.label}
              </p>
              <p className="text-[11px] text-gray-400 font-medium">{item.desc}</p>
              {!unlocked && !loading && summary && (
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Chưa đạt
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Achievements;