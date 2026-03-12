import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseApi, CourseDetailDto } from '../../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';

const LessonView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUserFromToken();
  const [course, setCourse] = useState<CourseDetailDto | null>(null);
  const [currentLesson, setCurrentLesson] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const authed = isAuthenticated();
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'docs'>('overview');

  useEffect(() => {
    if (!authed && courseId) {
      navigate('/auth/login?returnUrl=' + encodeURIComponent(`/user/lesson/${courseId}`));
    }
  }, [authed, courseId, navigate]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!authed || !user) return;
        if (!courseId) return;
        setLoadError(null);
        const res = await courseApi.getCourseDetail(courseId);
        setCourse(res.data);
        setCurrentLesson(0);
        try {
          const ok = await courseApi.isEnrolled(user.id, courseId);
          setEnrolled(ok);
        } catch {
          setEnrolled(false);
        }
        try {
          const progress = await courseApi.getCourseProgress(user.id, courseId);
          const ids = progress.completedLessonIds || [];
          setCompletedLessonIds(new Set(ids));
        } catch {
          // Chưa có tiến độ
        }
      } catch (err: any) {
        setCourse(null);
        setLoadError(err?.response?.status === 404 ? 'Không tìm thấy khóa học.' : 'Không tải được dữ liệu khóa học.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authed, courseId, user?.id]);

  const lessons = course?.lessons || [];
  const lesson = lessons[currentLesson];

  const isYoutube = (url?: string) =>
    !!url && (url.includes('youtube.com') || url.includes('youtu.be'));

  const youtubeEmbedUrl = useMemo(() => {
    if (!lesson?.contentUrl || !isYoutube(lesson.contentUrl)) return null;
    // chấp nhận cả dạng embed hoặc watch?v=
    if (lesson.contentUrl.includes('/embed/')) return lesson.contentUrl;
    const m = lesson.contentUrl.match(/v=([^&]+)/);
    if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`;
    return lesson.contentUrl;
  }, [lesson?.contentUrl]);

  const courseDocs = useMemo(() => {
    const items =
      (course?.lessons || [])
        .filter((l) => !!l.contentUrl)
        .map((l) => {
          const type = (l.contentType || '').toLowerCase();
          const url = l.contentUrl;
          const isVid = type === 'video' || isYoutube(url);
          const label = isVid ? 'Video' : (l.contentType || 'Tài liệu');
          return {
            id: l.id,
            title: l.title,
            url,
            label,
            order: l.order ?? 0,
          };
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // de-dupe theo URL (nếu trùng)
    const seen = new Set<string>();
    return items.filter((x) => {
      if (!x.url) return false;
      if (seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    });
  }, [course?.lessons]);

  if (!authed) {
    return (
      <div className="p-8 text-sm font-bold text-gray-500">
        Đang chuyển tới trang đăng nhập...
      </div>
    );
  }

  if (!loading && loadError) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-sm space-y-3">
          <p className="text-lg font-black text-gray-900">{loadError}</p>
          <p className="text-sm text-gray-500">
            Hãy vào trang Khóa học và chọn một khóa học hợp lệ để bắt đầu học.
          </p>
          <button
            type="button"
            onClick={() => navigate('/user/courses')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700"
          >
            <span className="material-symbols-outlined">menu_book</span>
            Về trang Khóa học
          </button>
        </div>
      </div>
    );
  }

  if (!loading && authed && user && courseId && !enrolled) {
    return (
      <div className="p-10 max-w-2xl mx-auto">
        <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-sm space-y-3">
          <p className="text-lg font-black text-gray-900">Bạn chưa ghi danh khóa học này.</p>
          <p className="text-sm text-gray-500">Nhấn ghi danh để bắt đầu học và lưu tiến độ.</p>
          <button
            type="button"
            disabled={enrolling}
            onClick={async () => {
              setEnrolling(true);
              try {
                await courseApi.enroll(user.id, courseId);
                setEnrolled(true);
              } catch (err: any) {
                const msg = err?.response?.data || 'Không thể ghi danh. Vui lòng thử lại.';
                alert(typeof msg === 'string' ? msg : 'Không thể ghi danh. Vui lòng thử lại.');
              } finally {
                setEnrolling(false);
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 disabled:bg-gray-400"
          >
            <span className="material-symbols-outlined">how_to_reg</span>
            {enrolling ? 'Đang ghi danh...' : 'Ghi danh khóa học'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] bg-white animate-in fade-in duration-500">
      
      {/* KHU VỰC BÊN TRÁI: Video & Nội dung */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Content */}
        <div className="aspect-video bg-black w-full shadow-lg relative flex items-center justify-center">
          {loading ? (
            <div className="text-white/70 text-sm font-bold">Đang tải...</div>
          ) : !lesson ? (
            <div className="text-white/70 text-sm font-bold">Chưa có bài học</div>
          ) : lesson.contentType?.toLowerCase() === 'video' && (youtubeEmbedUrl || lesson.contentUrl) ? (
            youtubeEmbedUrl ? (
              <iframe
                className="w-full h-full"
                src={youtubeEmbedUrl}
                title="Lesson Video"
                allowFullScreen
              />
            ) : (
              <div className="p-8 text-white/90 max-w-4xl">
                <p className="text-lg font-black mb-2">{lesson.title}</p>
                <p className="text-sm text-white/70 whitespace-pre-wrap mb-4">{lesson.content}</p>
                <a
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-bold hover:bg-white/15"
                  href={lesson.contentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="material-symbols-outlined">open_in_new</span>
                  Mở video/tài liệu
                </a>
              </div>
            )
          ) : (
            <div className="p-8 text-white/90 max-w-4xl">
              <p className="text-lg font-black mb-2">{lesson.title}</p>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{lesson.content}</p>
            </div>
          )}
        </div>

        <div className="p-8 max-w-4xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {lesson?.title || 'Bài học'}
              </h1>
              <p className="text-sm text-gray-400 mt-2">
                Khóa học: <span className="text-blue-600 font-bold">{course?.title || '—'}</span>
              </p>
            </div>
            {lesson && user && (
              <button
                disabled={completingId === lesson.id || completedLessonIds.has(lesson.id)}
                onClick={async () => {
                  if (!user || !courseId || !lesson) return;
                  setCompletingId(lesson.id);
                  try {
                    await courseApi.completeLesson({ userId: user.id, courseId, lessonId: lesson.id });
                    setCompletedLessonIds((prev) => new Set(prev).add(lesson.id));
                  } finally {
                    setCompletingId(null);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${
                  completedLessonIds.has(lesson.id)
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'border border-blue-100 text-blue-600 hover:bg-blue-50'
                }`}
              >
                <span className="material-symbols-outlined">
                  {completedLessonIds.has(lesson.id) ? 'check_circle' : 'check_circle_outline'}
                </span>
                {completedLessonIds.has(lesson.id) ? 'Đã hoàn thành' : completingId === lesson.id ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-8 border-b border-gray-100 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`pb-4 text-sm font-bold ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Tổng quan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('docs')}
              className={`pb-4 text-sm font-bold ${
                activeTab === 'docs'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Tài liệu
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="text-gray-600 text-sm leading-relaxed space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Giới thiệu khóa học</p>
                <p className="text-sm text-gray-700">{course?.description || '—'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-100 p-4 bg-white">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bài học</p>
                  <p className="text-xl font-black text-gray-900 mt-1">{lessons.length}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 p-4 bg-white">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đang học</p>
                  <p className="text-xl font-black text-gray-900 mt-1">
                    {lessons.length === 0 ? '—' : `${currentLesson + 1}/${lessons.length}`}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-100 p-4 bg-white">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hoàn thành</p>
                  <p className="text-xl font-black text-gray-900 mt-1">{completedLessonIds.size}</p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2">Mục tiêu bài học</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-blue-900/90 font-semibold">
                  <li>Nắm ý chính của bài: <span className="font-black">{lesson?.title || '—'}</span></li>
                  <li>Hoàn thành bài để cập nhật tiến độ và gợi ý học tiếp</li>
                  <li>Ôn lại nội dung ở tab Tài liệu khi cần</li>
                </ul>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={currentLesson <= 0}
                  onClick={() => setCurrentLesson((i) => Math.max(0, i - 1))}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white text-gray-700 font-black text-sm hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  ← Bài trước
                </button>
                <button
                  type="button"
                  disabled={currentLesson >= lessons.length - 1}
                  onClick={() => setCurrentLesson((i) => Math.min(lessons.length - 1, i + 1))}
                  className="px-4 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
                >
                  Bài tiếp theo →
                </button>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tài liệu & liên kết</p>
                <p className="text-sm text-gray-600">
                  Danh sách này tổng hợp các link video/tài liệu có trong khóa học. Bạn có thể mở nhanh để ôn tập.
                </p>
              </div>

              {courseDocs.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  Chưa có link tài liệu/video trong dữ liệu khóa học.
                </div>
              ) : (
                <div className="space-y-3">
                  {courseDocs.map((d) => (
                    <a
                      key={d.url}
                      className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className={`material-symbols-outlined ${d.label.toLowerCase() === 'video' ? 'text-red-500' : 'text-blue-600'}`}>
                        {d.label.toLowerCase() === 'video' ? 'play_circle' : 'description'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">{d.title}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{d.label}</p>
                      </div>
                      <span className="bg-white text-blue-600 p-2 rounded-lg border border-blue-100">
                        <span className="material-symbols-outlined">open_in_new</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KHU VỰC BÊN PHẢI: Syllabus động */}
      <aside className="w-full lg:w-96 bg-gray-50 border-l border-gray-100 flex flex-col h-full overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-white">
          <h3 className="font-bold text-gray-800">Nội dung học tập</h3>
          <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase">
            Tiến độ: {lessons.length === 0 ? 0 : currentLesson + 1}/{lessons.length} bài học
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {lessons.map((item, index) => {
            const isCompleted = item.id ? completedLessonIds.has(item.id) : false;
            return (
              <div
                key={item.id || index}
                onClick={() => setCurrentLesson(index)}
                className={`p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer border ${
                  index === currentLesson ? "bg-white border-blue-200 shadow-sm" : "bg-transparent hover:bg-white/50"
                }`}
              >
                <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                  index === currentLesson ? 'bg-blue-600 text-white' :
                  isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-sm">check</span>
                  ) : (
                    <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{item.title}</p>
                  <p className="text-[10px] text-gray-400">{item.contentType || 'Lesson'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #dbeafe; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default LessonView;