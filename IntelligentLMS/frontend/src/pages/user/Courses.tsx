import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { courseApi, CourseDto, CourseProgressResponse } from '../../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';

// Map khóa học -> thumbnail đẹp (Unsplash)
const getCourseThumbnail = (course: CourseDto) => {
  const key = (course.category || course.title || '').toLowerCase();

  if (key.includes('jwt') || key.includes('auth')) {
    return 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=900&q=80';
  }
  if (key.includes('postgres') || key.includes('database')) {
    return 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80';
  }
  if (key.includes('kafka') || key.includes('event')) {
    return 'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?auto=format&fit=crop&w=900&q=80';
  }
  if (key.includes('react') || key.includes('frontend')) {
    return 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=900&q=80';
  }
  if (key.includes('microservices') || key.includes('.net')) {
    return 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80';
  }

  return 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80';
};

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
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Header & Bộ lọc Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Khóa học của tôi</h2>
          <p className="text-sm text-gray-400 mt-1">
            {loading ? 'Đang tải...' : `Bạn có ${courses.length} khóa học.`}
          </p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Danh sách Khóa học */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
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
            className="group bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer relative overflow-hidden"
          >
            {/* Thumbnail khóa học */}
            <div className="h-44 rounded-2xl mb-5 overflow-hidden relative">
              <img
                src={getCourseThumbnail(course)}
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
                <span className="text-[10px] font-bold text-gray-400">{lessonsText}</span>
              </div>

              <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 h-10">
                {course.title}
              </h4>

              {/* Thanh tiến độ học tập */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Tiến độ</span>
                  <span className="text-[10px] font-bold text-blue-600">{progress}%</span>
                </div>
                <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                   <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                   />
                </div>
              </div>

              {/* Nút học tiếp chỉ hiện khi hover */}
              <div className="pt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
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