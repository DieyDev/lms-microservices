import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { courseApi, CourseDto, CourseProgressResponse } from '../../services/api'; 
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';

// Cấu hình Animation
const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } }
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } }
};

const getCourseThumbnail = (course: CourseDto) => {
  const key = (course.category || course.title || '').toLowerCase();

  if (key.includes('jwt') || key.includes('auth')) {
    return 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1400&q=80';
  }
  if (key.includes('postgres') || key.includes('database')) {
    return 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&q=80';
  }
  if (key.includes('kafka') || key.includes('event')) {
    return 'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?auto=format&fit=crop&w=1400&q=80';
  }
  if (key.includes('react') || key.includes('frontend')) {
    return 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1400&q=80';
  }
  if (key.includes('microservices') || key.includes('.net')) {
    return 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80';
  }

  return 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80';
};

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
        </div>
        <div className="size-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const user = getCurrentUserFromToken();

  // ─── DỮ LIỆU THẬT TỪ DOCKER ──────────────────────
  const [currentCourse, setCurrentCourse] = useState<CourseDto | null>(null);
  const [currentProgress, setCurrentProgress] = useState<CourseProgressResponse | null>(null);
  const [coursesWithProgress, setCoursesWithProgress] = useState<Array<{ course: CourseDto; progress: CourseProgressResponse }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!isAuthenticated() || !user) {
          setCurrentCourse(null);
          setCurrentProgress(null);
          setCoursesWithProgress([]);
          return;
        }

        const coursesRes = await courseApi.getCourses();
        const courses = coursesRes.data ?? [];
        if (courses.length === 0) {
          setCurrentCourse(null);
          setCurrentProgress(null);
          setCoursesWithProgress([]);
          return;
        }

        const progressEntries = await Promise.all(
          courses.map(async (c) => {
            const p = await courseApi.getCourseProgress(user.id, c.id);
            return { course: c, progress: p };
          })
        );

        setCoursesWithProgress(progressEntries);

        // Chọn khóa "đang học": ưu tiên >0% và <100%, nếu không có thì lấy khóa có % cao nhất
        const sorted = [...progressEntries].sort(
          (a, b) => (b.progress.progressPercentage ?? 0) - (a.progress.progressPercentage ?? 0)
        );
        const inProgress = sorted.find(x => (x.progress.progressPercentage ?? 0) > 0 && (x.progress.progressPercentage ?? 0) < 100);
        const chosen = inProgress || sorted[0];
        setCurrentCourse(chosen.course);
        setCurrentProgress(chosen.progress);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
        .db-root { font-family: 'DM Sans', sans-serif; }
        .db-mono { font-family: 'DM Mono', monospace; }
        .mesh-bg { background-color: #f4f6fb; background-image: radial-gradient(at 20% 10%, rgba(99,122,255,0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(139,92,246,0.08) 0px, transparent 50%); }
        .glass { background: rgba(255,255,255,0.82); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.9); box-shadow: 0 2px 24px rgba(99,122,255,0.07); }
        .progress-bar { background: linear-gradient(90deg, #4f6ef7, #818cf8, #4f6ef7); background-size: 200% auto; animation: shimmer 2.8s linear infinite; }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .flame { animation: flicker 1.2s ease-in-out infinite; display: inline-block; }
        @keyframes flicker { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.05); } }
      `}</style>

      <motion.div variants={container} initial="hidden" animate="show" className="db-root mesh-bg min-h-screen p-6 md:p-10 flex gap-8 flex-col xl:flex-row max-w-[1440px] mx-auto">
        
        {/* ─── CỘT TRÁI (Nội dung chính) ──────────────── */}
        <div className="flex-1 space-y-8 min-w-0">
          <motion.section variants={item}>
            <div className="flex items-center justify-between mb-1">
              <p className="db-mono text-[11px] text-indigo-400 uppercase tracking-[0.2em] font-medium">Dashboard Hệ Thống</p>
              <span className="db-mono text-[11px] text-gray-400">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 mt-2">
              Chào trở lại,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500">
                {user?.fullName || 'Học viên'}
              </span>
            </h2>
          </motion.section>

          {/* Khóa học Đang học (Kết nối Docker) */}
          <motion.section variants={item}>
            <div className="glass rounded-3xl overflow-hidden border border-white/70">
              <div className="relative h-[220px] md:h-[240px]">
                {currentCourse ? (
                  <img
                    src={getCourseThumbnail(currentCourse)}
                    alt={currentCourse.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-indigo-50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                <div className="absolute inset-x-6 bottom-6 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        Đang học
                      </span>
                      <h3 className="text-xl md:text-2xl font-black mt-3 truncate">
                        {loading ? 'Đang tải...' : (currentCourse?.title || 'Chưa có khóa học')}
                      </h3>
                      <p className="text-xs text-white/70 font-semibold mt-1">
                        {currentCourse?.category || currentCourse?.level || 'Course'}
                        {currentProgress && (
                          <>
                            {' '}• {currentProgress.completedLessons}/{currentProgress.totalLessons} bài
                          </>
                        )}
                      </p>
                    </div>

                    {currentCourse && (
                      <Link
                        to={`/user/lesson/${currentCourse.id}`}
                        className="shrink-0 inline-flex bg-white text-gray-900 px-5 py-3 rounded-2xl font-black text-xs md:text-sm items-center gap-2 hover:bg-white/90 transition-colors"
                      >
                        Học tiếp <span className="material-symbols-outlined text-lg">play_arrow</span>
                      </Link>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">Tiến độ</span>
                      <span className="db-mono text-[11px] font-black text-white">
                        {loading ? '...' : `${currentProgress?.progressPercentage ?? 0}%`}
                      </span>
                    </div>
                    <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: `${currentProgress?.progressPercentage ?? 0}%` }}
                        transition={{ duration: 1.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-300 via-white to-violet-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Danh sách nhanh khóa học */}
          <motion.section variants={item} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Khóa học</h3>
              <Link to="/user/courses" className="text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">
                Xem tất cả
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(coursesWithProgress || [])
                .sort((a, b) => (b.progress.progressPercentage ?? 0) - (a.progress.progressPercentage ?? 0))
                .slice(0, 4)
                .map(({ course, progress }) => (
                  <Link
                    key={course.id}
                    to={`/user/course/${course.id}`}
                    className="glass rounded-3xl overflow-hidden group hover:shadow-xl hover:shadow-indigo-200/40 transition-shadow"
                  >
                    <div className="relative h-28">
                      <img
                        src={getCourseThumbnail(course)}
                        alt={course.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <span className="absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-black bg-black/55 text-white uppercase tracking-widest">
                        {course.category || course.level || 'Course'}
                      </span>
                    </div>
                    <div className="p-5">
                      <p className="font-black text-gray-900 line-clamp-2 min-h-[40px]">{course.title}</p>
                      <div className="mt-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                          <span>Tiến độ</span>
                          <span className="text-indigo-600">{progress.progressPercentage ?? 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all"
                            style={{ width: `${progress.progressPercentage ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </motion.section>
        </div>

        {/* ─── CỘT PHẢI (Thống kê & Mục tiêu) ─────────── */}
        <motion.div variants={item} className="w-full xl:w-72 space-y-5 flex-shrink-0">
          
          {/* Thống kê thật từ progress */}
          <div className="grid grid-cols-1 gap-3">
            <StatCard
              icon="menu_book"
              label="Khóa học đã enroll"
              value={loading ? '…' : `${coursesWithProgress.length}`}
            />
            <StatCard
              icon="done_all"
              label="Khóa đã hoàn thành"
              value={loading ? '…' : `${coursesWithProgress.filter(x => (x.progress.progressPercentage ?? 0) >= 100).length}`}
            />
            <StatCard
              icon="bar_chart"
              label="Tiến độ trung bình"
              value={loading ? '…' : `${Math.round(
                coursesWithProgress.length === 0
                  ? 0
                  : coursesWithProgress.reduce((a, x) => a + (x.progress.progressPercentage ?? 0), 0) / coursesWithProgress.length
              )}%`}
            />
            <StatCard
              icon="check_circle"
              label="Bài đã hoàn thành"
              value={loading ? '…' : `${coursesWithProgress.reduce((a, x) => a + (x.progress.completedLessons ?? 0), 0)}`}
            />
          </div>

          {/* Biểu đồ hoạt động */}
          <div className="glass rounded-3xl p-6">
            <h4 className="font-black text-gray-800 flex items-center gap-2 mb-4 text-xs uppercase tracking-widest">
              Hoạt động học tập
            </h4>
            <div className="space-y-2 text-xs font-bold text-gray-500">
              <p>
                • Bạn đã enroll{' '}
                <span className="text-indigo-600">
                  {loading ? '…' : coursesWithProgress.length}
                </span>{' '}
                khóa học.
              </p>
              <p>
                • Hoàn thành{' '}
                <span className="text-emerald-600">
                  {loading
                    ? '…'
                    : coursesWithProgress.filter(
                        x => (x.progress.progressPercentage ?? 0) >= 100
                      ).length}
                </span>{' '}
                khóa.
              </p>
              <p>
                • Tổng số bài đã hoàn thành:{' '}
                <span className="text-indigo-600">
                  {loading
                    ? '…'
                    : coursesWithProgress.reduce(
                        (a, x) => a + (x.progress.completedLessons ?? 0),
                        0
                      )}
                </span>
                .
              </p>
            </div>
          </div>

          {/* Mục tiêu hôm nay */}
          <div className="glass rounded-3xl p-6">
            <h4 className="font-black text-gray-800 text-xs uppercase mb-4">Mục tiêu hôm nay</h4>
            <div className="space-y-3 text-xs font-bold text-gray-500">
              {loading || coursesWithProgress.length === 0 ? (
                <p>
                  Hãy ghi danh và bắt đầu một khóa học. Hệ thống sẽ gợi ý mục tiêu dựa trên tiến độ của bạn.
                </p>
              ) : (
                <>
                  <p>
                    Đề xuất hôm nay:{' '}
                    <span className="text-indigo-600">
                      {Math.min(
                        3,
                        coursesWithProgress.reduce(
                          (a, x) =>
                            a +
                            Math.max(
                              0,
                              (x.progress.totalLessons ?? 0) -
                                (x.progress.completedLessons ?? 0)
                            ),
                          0
                        )
                      )}
                    </span>{' '}
                    bài học.
                  </p>
                  <p className="text-[11px] text-gray-400 font-medium">
                    Hoàn thành đều đặn 3 bài/ngày sẽ giúp bạn sớm mở khóa thêm nhiều huy hiệu mới.
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>

      </motion.div>
    </>
  );
};

export default Dashboard;