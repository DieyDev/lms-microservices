import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { authApi } from '../../services/api';
import { getRole } from '../../utils/auth';

// --- Cấu hình hiệu ứng chuyển động giữa 2 Tab ---
const panelVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } }),
};

// --- Component Input con để tái sử dụng và fix lỗi Accessibility ---
const InputField = ({ label, id, type = 'text', placeholder, value, onChange, icon, suffix }: any) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[13px] font-semibold text-[#52525b]">{label}</label>
    <div className="relative">
      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#a1a1aa]">{icon}</span>
      <input
        id={id} 
        type={type} 
        required 
        value={value} 
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-10 pr-10 py-3 rounded-xl text-[14px] text-[#18181b] bg-[#f4f4f5] border border-transparent outline-none transition-all focus:bg-white focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
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
          alert(err.response?.data?.message || 'Đăng nhập Google thất bại');
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
  const handleSubmit = async (e: React.FormEvent) => {
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
        
        alert("Đăng ký tài khoản thành công! Bây giờ bạn có thể đăng nhập.");
        switchTab('login'); // Chuyển về tab login để người dùng đăng nhập
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Lỗi hệ thống! Vui lòng kiểm tra Docker Auth-Service.";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap dot-bg min-h-screen flex items-center justify-center px-4 py-12 font-['Sora']">
      <style>{`
        .dot-bg { background-color: #fafafa; background-image: radial-gradient(#e4e4e7 1px, transparent 1px); background-size: 24px 24px; }
        .auth-card { background: #ffffff; border: 1px solid #e4e4e7; border-radius: 20px; box-shadow: 0 4px 32px rgba(0,0,0,0.07); }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .ring-spin { animation: spin-slow 12s linear infinite; }
      `}</style>

      <div className="w-full max-w-[400px] space-y-6">
        {/* Phần Logo Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 56 56" className="ring-spin absolute inset-0 w-full h-full" fill="none">
              <circle cx="28" cy="28" r="26" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="5 5" />
            </svg>
            <div className="absolute inset-2 rounded-full bg-[#18181b] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-2xl">rocket_launch</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold text-[#18181b]">IntelligentLMS</p>
            <p className="text-[11px] text-[#a1a1aa]">Nền tảng LMS Microservices</p>
          </div>
        </motion.div>

        {/* Thẻ Form Chính */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-card p-7">
          {/* Thanh chuyển đổi Login/Register */}
          <div className="flex bg-[#f4f4f5] p-1 rounded-xl mb-7 relative">
            <motion.div 
              layoutId="t" 
              className="absolute inset-y-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm" 
              animate={{ left: tab === 'login' ? '4px' : 'calc(50%)' }} 
            />
            <button 
              type="button"
              className={`flex-1 py-2 text-[13px] font-bold z-10 transition-colors ${tab === 'login' ? 'text-black' : 'text-gray-400'}`} 
              onClick={() => switchTab('login')}
            >
              Đăng nhập
            </button>
            <button 
              type="button"
              className={`flex-1 py-2 text-[13px] font-bold z-10 transition-colors ${tab === 'register' ? 'text-black' : 'text-gray-400'}`} 
              onClick={() => switchTab('register')}
            >
              Đăng ký
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
                  label="Họ và tên" 
                  id="r-name" 
                  icon="person" 
                  placeholder="Nhập tên của bạn (VD: Diey)" 
                  value={name} 
                  onChange={setName} 
                />
              )}
              
              {/* Trường Email dùng chung */}
              <InputField 
                label="Email" 
                id="email" 
                icon="mail" 
                type="email" 
                placeholder="diey@example.com" 
                value={email} 
                onChange={setEmail} 
              />
              
              {/* Trường Mật khẩu dùng chung */}
              <InputField 
                label="Mật khẩu" 
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#6366f1] transition-colors"
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
                  className="text-[11px] text-[#6366f1] font-semibold hover:underline text-right w-full"
                  disabled={loading}
                >
                  Quên mật khẩu?
                </button>
              )}

              {/* Nút Submit động theo Tab */}
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-3 bg-[#18181b] text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-gray-200 disabled:bg-gray-400"
              >
                {loading ? 'Đang xử lý...' : tab === 'login' ? 'Đăng nhập ngay' : 'Tạo tài khoản mới'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-[1px] bg-gray-100" />
                <span className="text-[10px] text-gray-400 font-bold uppercase">Hoặc tiếp tục với</span>
                <div className="flex-1 h-[1px] bg-gray-100" />
              </div>

              {/* Social Login */}
              <div className="flex flex-col items-center gap-3">
                <div ref={googleBtnRef} />
                {googleLoading && <span className="text-xs text-gray-500">Đang đăng nhập...</span>}
              </div>
            </motion.form>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;