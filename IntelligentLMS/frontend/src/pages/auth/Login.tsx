import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { authApi } from '../../services/api';
import { getRole } from '../../utils/auth';
import { useI18n } from '../../i18n/I18nProvider';

// --- Cấu hình hiệu ứng chuyển động giữa 2 Tab ---
const panelVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }),
};

// --- Component Input con để tái sử dụng và fix lỗi Accessibility ---
const InputField = ({ label, id, type = 'text', placeholder, value, onChange, icon, suffix }: any) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[13px] font-semibold text-slate-800 dark:text-slate-200">{label}</label>
    <div className="relative">
      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-500 dark:text-slate-400">{icon}</span>
      <input
        id={id} 
        type={type} 
        required 
        value={value} 
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-[14px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(43,124,238,0.18)] dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-white/10 dark:focus:shadow-[0_0_0_3px_rgba(43,124,238,0.25)]"
      />
      {suffix}
    </div>
  </div>
);

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (cfg: any) => void; renderButton: (el: HTMLElement, opts: any) => void } } };
  }
}

const GOOGLE_CLIENT_ID = '931279444936-163f973sgskne9s0cjfvfe052vm5msss.apps.googleusercontent.com';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '';
  const [[tab, dir], setTab] = useState<['login' | 'register', number]>(['login', 0]);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (res: { credential: string }) => {
        setGoogleLoading(true);
        try {
          const { data } = await authApi.googleLogin({ idToken: res.credential });
          localStorage.setItem('token', data.token);
          if (returnUrl) { navigate(returnUrl); return; }
          const role = getRole();
          if (role === 'admin') navigate('/admin/dashboard');
          else if (role === 'teacher') navigate('/admin/teachers');
          else navigate('/user/dashboard');
        } catch (err: any) {
          alert(err.response?.data?.message || t('auth.googleFailed'));
        } finally {
          setGoogleLoading(false);
        }
      },
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: 176,
    });
  }, [navigate]);

  // State cho các trường nhập liệu
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Sử dụng cho FullName khi Register
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Hàm chuyển đổi giữa Đăng nhập và Đăng ký
  const switchTab = (next: 'login' | 'register') => {
    if (next === tab) return;
    setTab([next, next === 'register' ? 1 : -1]);
    // Reset form khi chuyển tab
    setEmail('');
    setPassword('');
    setName('');
  };

  // ─── Hàm xử lý Submit chung cho cả Login và Register ───
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (tab === 'login') {
        // Xử lý Đăng nhập
        const response = await authApi.login({ email, password });
        localStorage.setItem('token', response.data.token);
        if (returnUrl) { navigate(returnUrl); return; }
        const role = getRole();
        if (role === 'admin') navigate('/admin/dashboard');
        else if (role === 'teacher') navigate('/admin/teachers');
        else navigate('/user/dashboard');
      } else {
        // Xử lý Đăng ký (Lưu thông tin vào bảng Users thông qua Auth Controller)
        const registerData = {
          fullName: name,
          email: email,
          password: password
        };
        
        await authApi.register(registerData);
        
        alert(t('auth.registerSuccess'));
        switchTab('login'); // Chuyển về tab login để người dùng đăng nhập
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || t('auth.systemError');
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lms-dot-bg flex min-h-screen items-center justify-center px-4 py-12 font-sans">
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .ring-spin { animation: spin-slow 12s linear infinite; }
      `}</style>

      <div className="w-full max-w-[400px] space-y-6">
        {/* Phần Logo Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 56 56" className="ring-spin absolute inset-0 h-full w-full" fill="none">
              <circle cx="28" cy="28" r="26" stroke="#2b7cee" strokeWidth="1.5" strokeDasharray="5 5" />
            </svg>
            <div className="absolute inset-2 rounded-full bg-[#18181b] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-2xl">rocket_launch</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100">IntelligentLMS</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">Nền tảng LMS Microservices</p>
          </div>
        </motion.div>

        {/* Thẻ Form Chính */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[20px] border border-slate-200/90 bg-white p-7 shadow-card dark:border-white/10 dark:bg-slate-950/60">
          {/* Thanh chuyển đổi Login/Register */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-7 relative border border-slate-200 dark:bg-white/5 dark:border-white/10">
            <motion.div 
              layoutId="t" 
              className="absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-white/10" 
              animate={{ left: tab === 'login' ? '4px' : 'calc(50%)' }} 
            />
            <button 
              type="button"
              className={`flex-1 py-2 text-[13px] font-black z-10 transition-colors ${
                tab === 'login'
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`} 
              onClick={() => switchTab('login')}
            >
              {t('auth.login')}
            </button>
            <button 
              type="button"
              className={`flex-1 py-2 text-[13px] font-black z-10 transition-colors ${
                tab === 'register'
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`} 
              onClick={() => switchTab('register')}
            >
              {t('auth.register')}
            </button>
          </div>

          <AnimatePresence mode="wait" custom={dir}>
            <motion.form 
              key={tab} 
              custom={dir} 
              variants={panelVariants} 
              initial="enter" 
              animate="center" 
              exit="exit" 
              onSubmit={handleSubmit} 
              className="space-y-4"
            >
              {/* Trường Họ và tên chỉ hiện khi Đăng ký */}
              {tab === 'register' && (
                <InputField 
                  label={t('auth.fullName')}
                  id="r-name" 
                  icon="person" 
                  placeholder="Nhập tên của bạn (VD: Diey)" 
                  value={name} 
                  onChange={setName} 
                />
              )}
              
              {/* Trường Email dùng chung */}
              <InputField 
                label={t('auth.email')}
                id="email" 
                icon="mail" 
                type="email" 
                placeholder="diey@example.com" 
                value={email} 
                onChange={setEmail} 
              />
              
              {/* Trường Mật khẩu dùng chung */}
              <InputField 
                label={t('auth.password')}
                id="pw" 
                icon="lock" 
                type={showPw ? 'text' : 'password'} 
                placeholder="••••••••" 
                value={password} 
                onChange={setPassword}
                suffix={
                  <button 
                    type="button" 
                    onClick={() => setShowPw(!showPw)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showPw ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                }
              />

              {tab === 'login' && (
                <button
                  type="button"
                  onClick={() => navigate('/auth/forgot-password')}
                  className="w-full text-right text-[11px] font-semibold text-primary hover:underline"
                  disabled={loading}
                >
                  {t('auth.forgotPassword')}
                </button>
              )}

              {/* Nút Submit động theo Tab */}
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition-all hover:bg-slate-800 disabled:bg-slate-400 dark:bg-primary dark:hover:bg-primary-hover dark:shadow-black/30"
              >
                {loading ? '...' : tab === 'login' ? t('auth.loginNow') : t('auth.createAccount')}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/10" />
                <span className="text-[10px] text-slate-500 font-black uppercase dark:text-slate-400">{t('auth.orContinueWith')}</span>
                <div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/10" />
              </div>

              {/* Social Login */}
              <div className="flex flex-col items-center gap-3">
                <div ref={googleBtnRef} />
                {googleLoading && <span className="text-xs text-slate-600 dark:text-slate-400">Đang đăng nhập...</span>}
              </div>
            </motion.form>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;