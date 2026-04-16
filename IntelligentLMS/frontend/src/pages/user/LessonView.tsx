import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseApi, CourseDetailDto } from '../../services/api';
import { aiApi, ReviewResponse, ReviewStartResponse } from '../../services/aiApi';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';
import { getApiErrorMessage } from '../../utils/apiError';

const LessonView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUserFromToken();
  const [course, setCourse] = useState<CourseDetailDto | null>(null);
  const [currentLesson, setCurrentLesson] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const authed = isAuthenticated();
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // AI Review (chat)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSession, setReviewSession] = useState<ReviewStartResponse | null>(null);
  const [reviewAnswer, setReviewAnswer] = useState('');
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null);

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
  const isCompleted = !!lesson?.id && completedLessonIds.has(lesson.id);

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

  const resetReview = () => {
    setReviewError(null);
    setReviewSession(null);
    setReviewAnswer('');
    setReviewResult(null);
  };

  const startAiReview = async () => {
    if (!lesson?.id || !courseId) return;
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError(null);
    setReviewSession(null);
    setReviewAnswer('');
    setReviewResult(null);
    try {
      const res = await aiApi.startReview({
        lesson_id: lesson.id,
        course_id: courseId,
        lesson_title: lesson.title,
        lesson_content: lesson.content,
      });
      setReviewSession(res);
    } catch (e: any) {
      setReviewError(getApiErrorMessage(e) || 'Không gọi được AI ôn tập.');
    } finally {
      setReviewLoading(false);
    }
  };

  const submitAiAnswer = async () => {
    const sid = reviewSession?.session_id;
    const ans = reviewAnswer.trim();
    if (!sid) return;
    if (!ans) {
      setReviewError('Bạn hãy nhập câu trả lời trước khi gửi.');
      return;
    }
    if (ans.length < 20) {
      setReviewError('Câu trả lời đang quá ngắn. Bạn viết rõ hơn (ít nhất 20 ký tự) để AI chấm đúng nhé.');
      return;
    }
    setReviewLoading(true);
    setReviewError(null);
    setReviewResult(null);
    try {
      const res = await aiApi.submitReview({ session_id: sid, answer: ans });
      setReviewResult(res);

      // Auto complete chỉ khi đạt theo ngưỡng client (tránh backend trả "pass" quá dễ)
      const passByClient = !!res.is_pass && (res.score ?? 0) >= 70;
      if (passByClient && user && courseId && lesson?.id && !completedLessonIds.has(lesson.id)) {
        try {
          await courseApi.completeLesson({ userId: user.id, courseId, lessonId: lesson.id });
          setCompletedLessonIds((prev) => new Set(prev).add(lesson.id));
        } catch {
          // ignore: UI vẫn hiển thị kết quả chấm, user có thể thử lại sau
        }
      }
    } catch (e: any) {
      setReviewError(getApiErrorMessage(e) || 'AI chưa chấm được câu trả lời. Thử lại nhé.');
    } finally {
      setReviewLoading(false);
    }
  };

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
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white/70 animate-in fade-in duration-500">
      {/* SIDEBAR TRÁI */}
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col border-r border-blue-100 bg-white/95 shadow-[4px_0_24px_rgba(37,99,235,0.06)]">
        <div className="px-4 py-4 border-b border-blue-100">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Khóa học</p>
          <p className="mt-1 line-clamp-2 text-sm font-extrabold text-slate-900">{course?.title || '—'}</p>
          <p className="mt-2 text-[11px] font-bold text-slate-500">
            {lessons.length === 0 ? 0 : currentLesson + 1}/{lessons.length} • {completedLessonIds.size} hoàn thành
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3">
          {lessons.map((item, index) => {
            const done = item.id ? completedLessonIds.has(item.id) : false;
            const active = index === currentLesson;
            return (
              <button
                key={item.id || index}
                type="button"
                onClick={() => setCurrentLesson(index)}
                className={`w-full text-left rounded-xl px-3 py-2.5 mb-1 border transition ${
                  active ? 'bg-blue-50 border-blue-200' : 'bg-transparent border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-7 rounded-full flex items-center justify-center text-[11px] font-black ${
                      active ? 'bg-primary text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {done ? <span className="material-symbols-outlined text-[16px]">check</span> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {item.contentType || 'Lesson'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* NỘI DUNG PHẢI */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {course?.title || 'Khóa học'} / {lesson?.contentType || 'Lesson'}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{lesson?.title || 'Bài học'}</h1>
            </div>

            {lesson && user && (
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black border ${
                    isCompleted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <span className={`size-2 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {isCompleted ? 'Đã hoàn thành (đạt AI)' : 'Chưa hoàn thành'}
                </span>

                <button
                  type="button"
                  onClick={startAiReview}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white shadow-md shadow-primary/25 hover:bg-primary-hover"
                >
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  Ôn tập để hoàn thành
                </button>
              </div>
            )}
          </div>

          {/* BÀI HỌC */}
          <div className="mt-5 lms-content-panel p-5">
            {loading ? (
              <div className="text-sm text-slate-500">Đang tải...</div>
            ) : !lesson ? (
              <div className="text-sm text-slate-500">Chưa có bài học</div>
            ) : lesson.contentType?.toLowerCase() === 'video' && (youtubeEmbedUrl || lesson.contentUrl) ? (
              <div className="space-y-3">
                <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black">
                  {youtubeEmbedUrl ? (
                    <iframe className="h-full w-full" src={youtubeEmbedUrl} title="Lesson Video" allowFullScreen />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/70">Mở video bên ngoài</div>
                  )}
                </div>
                {lesson.contentUrl ? (
                  <a
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-900 hover:border-primary/25 hover:text-primary"
                    href={lesson.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    Mở video/tài liệu
                  </a>
                ) : null}
                {lesson.content ? <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{lesson.content}</p> : null}
              </div>
            ) : (
              <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{lesson.content}</div>
            )}
          </div>

          {/* ÔN TẬP AI */}
          {reviewOpen && (
            <div className="mt-5 lms-content-panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/40 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">Ôn tập bằng AI</p>
                  <p className="mt-1 truncate text-sm font-extrabold text-slate-900">Trả lời để hệ thống ghi nhận hoàn thành</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetReview();
                    setReviewOpen(false);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                {reviewError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                    {reviewError}
                  </div>
                )}

                {reviewLoading && !reviewSession ? (
                  <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
                    AI đang tạo câu hỏi từ nội dung bài...
                  </div>
                ) : reviewSession ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Câu hỏi</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 whitespace-pre-wrap">{reviewSession.question}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Câu trả lời của bạn</label>
                      <textarea
                        rows={3}
                        value={reviewAnswer}
                        onChange={(e) => setReviewAnswer(e.target.value)}
                        placeholder="Nhập câu trả lời..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={submitAiAnswer}
                          disabled={reviewLoading || !reviewAnswer.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-md shadow-primary/25 hover:bg-primary-hover disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[18px]">send</span>
                          {reviewLoading ? 'Đang chấm...' : 'Gửi để AI chấm'}
                        </button>
                        <button
                          type="button"
                          onClick={startAiReview}
                          disabled={reviewLoading}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-900 hover:border-primary/25 hover:text-primary disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[18px]">refresh</span>
                          Sinh câu hỏi khác
                        </button>
                      </div>
                    </div>

                    {reviewResult && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        {reviewResult.is_pass && (reviewResult.score ?? 0) < 70 ? (
                          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                            AI trả về “Đạt” nhưng điểm đang thấp. Hệ thống sẽ <span className="font-extrabold">không tự ghi nhận hoàn thành</span>.
                            Bạn trả lời kỹ hơn rồi gửi lại để chắc chắn nhé.
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-slate-900">
                            Kết quả: {reviewResult.is_pass && (reviewResult.score ?? 0) >= 70 ? 'Đạt' : 'Chưa đạt'}
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              reviewResult.is_pass && (reviewResult.score ?? 0) >= 70
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {reviewResult.score}/100
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{reviewResult.feedback}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentLesson <= 0}
              onClick={() => setCurrentLesson((i) => Math.max(0, i - 1))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              ← Bài trước
            </button>
            <button
              type="button"
              disabled={currentLesson >= lessons.length - 1}
              onClick={() => setCurrentLesson((i) => Math.min(lessons.length - 1, i + 1))}
              className="rounded-xl bg-primary px-4 py-3 text-xs font-black text-white shadow-md shadow-primary/25 hover:bg-primary-hover disabled:opacity-50"
            >
              Bài tiếp theo →
            </button>
          </div>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(37,99,235,0.18); border-radius: 10px; }
        `}</style>
      </main>
    </div>
  );
};

export default LessonView;