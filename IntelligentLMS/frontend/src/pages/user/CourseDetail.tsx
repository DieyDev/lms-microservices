import { motion, Variants } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { courseApi, paymentApi, CourseDetailDto } from '../../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';
import { resolveCourseThumbnail } from '../../utils/courseImage';

// ─── Variants Chuyển Động ──────────────────────────────────────────────────
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
};

const CourseDetail = () => {
  const { id } = useParams(); // Lấy ID khóa học từ URL
  const navigate = useNavigate();
  const user = getCurrentUserFromToken();
  const [course, setCourse] = useState<CourseDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!id) return;
        const res = await courseApi.getCourseDetail(id);
        setCourse(res.data);
        if (isAuthenticated() && user) {
          try {
            const ok = await courseApi.isEnrolled(user.id, id);
            setEnrolled(ok);
          } catch {
            setEnrolled(false);
          }
        } else {
          setEnrolled(false);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user?.id]);

  const instructorLabel = useMemo(() => {
    if (!course?.instructorId) return 'Chưa rõ';
    return `${course.instructorId.slice(0, 8)}...`;
  }, [course?.instructorId]);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-8 max-w-[1200px] mx-auto space-y-8 font-sans"
    >
      {/* 1. Nút Quay lại & Breadcrumb */}
      <motion.div variants={itemVariants}>
        <Link to="/user/courses" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-bold text-sm">
          <span className="material-symbols-outlined">arrow_back</span>
          Quay lại danh sách khóa học
        </Link>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* CỘT TRÁI: Thông tin chi tiết */}
        <div className="flex-1 space-y-8">
          {/* Cover image */}
          {course && (
            <motion.div variants={itemVariants} className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
              <div className="aspect-video relative">
                <img
                  src={resolveCourseThumbnail(course)}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              </div>
            </motion.div>
          )}

          {/* Header khóa học */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h1 className="text-4xl font-black text-gray-800 leading-tight">
              {loading ? 'Đang tải...' : (course?.title || 'Không tìm thấy khóa học')}
            </h1>
            <p className="text-gray-500 text-lg leading-relaxed">{course?.description || ''}</p>
            
            <div className="flex flex-wrap gap-6 items-center pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 fill-1">star</span>
                <span className="font-bold text-gray-800">—</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span className="material-symbols-outlined">group</span>
                <span className="text-sm font-medium">— học viên</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span className="material-symbols-outlined">person</span>
                <span className="text-sm font-medium">Giảng viên: {instructorLabel}</span>
              </div>
            </div>
          </motion.div>

          {/* Danh sách bài học (Curriculum) */}
          <motion.section variants={itemVariants} className="space-y-4">
            <h3 className="text-xl font-black text-gray-800">Nội dung bài học</h3>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              {(course?.lessons || []).map((lesson, index) => (
                <div 
                  key={lesson.id} 
                  className="flex items-center justify-between p-5 border-b border-gray-50 last:border-none group hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{lesson.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {lesson.contentType || 'Lesson'}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-blue-600 transition-all">
                    {lesson.contentType?.toLowerCase() === 'video' ? 'play_circle' : 'description'}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* CỘT PHẢI: Card đăng ký (Sticky) */}
        <motion.div 
          variants={itemVariants}
          className="w-full lg:w-80"
        >
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-blue-500/5 sticky top-24">
            <div className="aspect-video mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-slate-100 shadow-inner">
              {course ? (
                <img
                  src={resolveCourseThumbnail(course)}
                  alt={course.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full min-h-[140px] items-center justify-center bg-slate-100 text-slate-300">
                  <span className="material-symbols-outlined text-5xl">image</span>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-black text-blue-600">
                  {course?.price && course.price > 0
                    ? `${course.price.toLocaleString('vi-VN')} đ`
                    : 'Miễn phí'}
                </span>
              </div>
              
              {isAuthenticated() ? (
                enrolled ? (
                  <Link
                    to={`/user/lesson/${id}`}
                    className="block w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-center text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                  >
                    VÀO HỌC NGAY
                  </Link>
                ) : course?.price && course.price > 0 ? (
                  <button
                    type="button"
                    disabled={paying || !user || !id}
                    onClick={async () => {
                      if (!user || !id) return;
                      setPaying(true);
                      try {
                        const res = await paymentApi.createVnpayUrl(id);
                        const url = res.data?.paymentUrl;
                        if (url) window.location.href = url;
                        else alert('Không thể tạo link thanh toán.');
                      } catch (err: any) {
                        const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Không thể tạo link thanh toán.';
                        alert(typeof msg === 'string' ? msg : 'Không thể tạo link thanh toán.');
                      } finally {
                        setPaying(false);
                      }
                    }}
                    className="block w-full py-4 bg-amber-500 text-white rounded-2xl font-black text-center text-sm shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all disabled:bg-gray-400"
                  >
                    {paying ? 'ĐANG CHUYỂN...' : 'THANH TOÁN VNPAY & GHI DANH'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={enrolling || !user || !id}
                    onClick={async () => {
                      if (!user || !id) return;
                      setEnrolling(true);
                      try {
                        await courseApi.enroll(user.id, id);
                        setEnrolled(true);
                        navigate(`/user/lesson/${id}`);
                      } catch (err: any) {
                        const msg = err?.response?.data || 'Không thể ghi danh. Vui lòng thử lại.';
                        alert(typeof msg === 'string' ? msg : 'Không thể ghi danh. Vui lòng thử lại.');
                      } finally {
                        setEnrolling(false);
                      }
                    }}
                    className="block w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-center text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:bg-gray-400"
                  >
                    {enrolling ? 'ĐANG GHI DANH...' : 'GHI DANH & VÀO HỌC'}
                  </button>
                )
              ) : (
                <Link
                  to="/auth/login"
                  className="block w-full py-4 bg-gray-200 text-gray-600 rounded-2xl font-black text-center text-sm hover:bg-gray-300 transition-all"
                >
                  Đăng nhập để học
                </Link>
              )}
              
              <div className="pt-4 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center mb-4">Khóa học này bao gồm</p>
                <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
                  <span className="material-symbols-outlined text-blue-600 text-lg">description</span>
                  Tài liệu PE File Static Analysis
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
                  <span className="material-symbols-outlined text-blue-600 text-lg">terminal</span>
                  Source Code Engine mẫu
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-gray-600">
                  <span className="material-symbols-outlined text-blue-600 text-lg">verified</span>
                  Chứng chỉ hoàn thành
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default CourseDetail;