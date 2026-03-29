import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="mt-12 border-t border-slate-200/80 bg-gradient-to-b from-white/90 to-slate-50/90 pb-8 pt-10 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          
          {/* Cột 1: Thông tin nền tảng */}
          <div className="col-span-1 md:col-span-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined">school</span>
              </div>
              <span className="text-lg font-bold text-slate-800">LMS Platform</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Nền tảng học tập thông minh — học mọi lúc, theo dõi tiến độ rõ ràng.
            </p>
          </div>

          {/* Cột 2: Khóa học trọng tâm */}
          <div>
            <h4 className="mb-5 text-sm font-bold text-slate-800">Học tập</h4>
            <ul className="space-y-3 text-xs font-bold text-slate-500">
              <li><Link to="/user/courses" className="transition-colors hover:text-primary">Danh sách khóa học</Link></li>
              <li><Link to="/user/learning-path" className="transition-colors hover:text-primary">Lộ trình</Link></li>
              <li><Link to="/user/achievements" className="transition-colors hover:text-primary">Thành tích</Link></li>
            </ul>
          </div>

          {/* Cột 3: Hỗ trợ học viên */}
          <div>
            <h4 className="mb-5 text-sm font-bold text-slate-800">Hỗ trợ</h4>
            <ul className="space-y-3 text-xs font-bold text-slate-500">
              <li><a href="#" className="transition-colors hover:text-primary">Trung tâm trợ giúp</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">Cộng đồng</a></li>
              <li><a href="#" className="transition-colors hover:text-primary">Liên hệ</a></li>
            </ul>
          </div>

          {/* Cột 4: Đăng ký bản tin */}
          <div>
            <h4 className="mb-5 text-sm font-bold text-slate-800">Bản tin</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Email của bạn"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
              <button type="button" className="rounded-xl bg-primary p-2.5 text-white transition hover:bg-primary-hover" aria-label="Đăng ký">
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bản quyền & Social */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 md:flex-row">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            © 2026 IntelligentLMS. All rights reserved.
          </p>
          <div className="flex gap-6 text-slate-400">
            <a href="#" className="transition-colors hover:text-primary" aria-label="Web"><span className="material-symbols-outlined text-lg">language</span></a>
            <a href="#" className="transition-colors hover:text-primary" aria-label="Dev"><span className="material-symbols-outlined text-lg">terminal</span></a>
            <a href="#" className="transition-colors hover:text-primary" aria-label="Hub"><span className="material-symbols-outlined text-lg">hub</span></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;