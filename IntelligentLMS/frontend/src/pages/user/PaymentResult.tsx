import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

const REDIRECT_SECONDS = 2;

const PaymentResult = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get('status');
  const message = searchParams.get('message') || '';
  const courseId = searchParams.get('courseId');

  const success = status === 'success';
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!success || !courseId) return;

    setSecondsLeft(REDIRECT_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    const go = setTimeout(() => {
      navigate(`/user/lesson/${encodeURIComponent(courseId)}`, { replace: true });
    }, REDIRECT_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(go);
    };
  }, [success, courseId, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="lms-mesh-bg flex min-h-screen flex-col items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-8 text-center shadow-card backdrop-blur-sm">
        {success ? (
          <>
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-100">
              <span className="material-symbols-outlined text-5xl text-emerald-600">check_circle</span>
            </div>
            <h2 className="mb-2 text-2xl font-black text-gray-800">Thanh toán thành công</h2>
            <p className="mb-4 text-gray-500">Bạn đã được ghi danh vào khóa học.</p>
            {courseId ? (
              <>
                <p className="mb-6 text-sm font-semibold text-primary">
                  Đang chuyển vào trang học sau {secondsLeft}s…
                </p>
                <Link
                  to={`/user/lesson/${encodeURIComponent(courseId)}`}
                  className="inline-block w-full rounded-2xl bg-primary py-4 text-center font-black text-white transition-colors hover:bg-primary-hover"
                >
                  VÀO HỌC NGAY
                </Link>
              </>
            ) : (
              <Link
                to="/user/courses"
                className="inline-block w-full rounded-2xl bg-primary py-4 text-center font-black text-white transition-colors hover:bg-primary-hover"
              >
                VỀ DANH SÁCH KHÓA HỌC
              </Link>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-red-100">
              <span className="material-symbols-outlined text-5xl text-red-600">error</span>
            </div>
            <h2 className="mb-2 text-2xl font-black text-gray-800">Thanh toán thất bại</h2>
            <p className="mb-6 text-gray-500">{message || 'Đã xảy ra lỗi. Vui lòng thử lại.'}</p>
            <Link
              to="/user/courses"
              className="inline-block w-full rounded-2xl bg-gray-800 py-4 text-center font-black text-white transition-colors hover:bg-gray-900"
            >
              VỀ DANH SÁCH KHÓA HỌC
            </Link>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default PaymentResult;
