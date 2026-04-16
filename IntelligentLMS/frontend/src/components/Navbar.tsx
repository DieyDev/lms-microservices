import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { UserProfileResponse, userApi } from '../services/api';
import { getCurrentUserFromToken, isAuthenticated, logout } from '../utils/auth';
import { getUnreadNotificationCount } from '../utils/notificationsStore';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n/I18nProvider';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { isDark, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isAuthenticated()) {
        setUser(null);
        return;
      }

      const decoded = getCurrentUserFromToken();
      if (!decoded) {
        setUser(null);
        return;
      }

      const base: UserProfileResponse = {
        id: decoded.id,
        email: decoded.email || '',
        fullName: decoded.fullName || 'User',
        role: decoded.role || 'Student',
        avatarUrl: undefined,
      };

      try {
        const { data } = await userApi.getProfile(decoded.id);
        const d = data as { fullName?: string; FullName?: string; avatarUrl?: string; AvatarUrl?: string };
        if (cancelled) return;
        const av = d.avatarUrl ?? d.AvatarUrl;
        setUser({
          ...base,
          fullName: d.fullName || d.FullName || base.fullName,
          avatarUrl: typeof av === 'string' && av.length > 0 ? av : undefined,
        });
      } catch {
        if (!cancelled) setUser(base);
      }
    };

    load();

    const onProfileSaved = (e: Event) => {
      const ce = e as CustomEvent<{ avatarUrl?: string; fullName?: string }>;
      const d = ce.detail;
      if (!d) return;
      setUser((prev) =>
        prev
          ? {
              ...prev,
              ...(d.fullName != null ? { fullName: d.fullName } : {}),
              ...(d.avatarUrl !== undefined
                ? { avatarUrl: d.avatarUrl || undefined }
                : {}),
            }
          : prev
      );
    };
    window.addEventListener('lms-profile-updated', onProfileSaved);

    return () => {
      cancelled = true;
      window.removeEventListener('lms-profile-updated', onProfileSaved);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/user/courses') {
      setSearchQuery(searchParams.get('q') || '');
    }
  }, [location.pathname, searchParams]);

  useEffect(() => {
    const sync = () => setUnreadNotifications(getUnreadNotificationCount());
    sync();
    window.addEventListener('lms-notifications-changed', sync);
    return () => window.removeEventListener('lms-notifications-changed', sync);
  }, []);

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = searchQuery.trim();
    if (t) {
      navigate(`/user/courses?q=${encodeURIComponent(t)}`);
    } else {
      navigate('/user/courses');
    }
  };

  return (
    <header className="sticky top-0 z-[100] flex min-h-[4.25rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-2 shadow-nav backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/60 md:gap-4 md:px-8">
      <div className="order-1 flex min-w-0 w-full max-w-full sm:max-w-xl sm:flex-1">
        <form onSubmit={submitSearch} className="relative w-full group">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition group-focus-within:text-primary">
            <span className="material-symbols-outlined text-[22px]">search</span>
          </span>
          <input
            type="search"
            name="q"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 py-2.5 pl-11 pr-24 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary/40 focus:bg-slate-50 focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-white/10"
            placeholder={t('common.searchPlaceholder')}
          />
          <button
            type="submit"
            className="absolute inset-y-1 right-1 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-sm transition hover:bg-primary/90"
          >
            {t('common.search')}
          </button>
        </form>
      </div>

      <div className="order-2 flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto md:gap-3">
        <div className="hidden sm:flex items-center">
          <label className="sr-only" htmlFor="lms-lang">
            {t('common.language')}
          </label>
          <select
            id="lms-lang"
            value={lang}
            onChange={(e) => {
              const v = (e.target.value as 'vi' | 'en') || 'vi';
              setLang(v);
            }}
            className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-soft outline-none transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            aria-label="Chọn ngôn ngữ"
          >
            <option value="vi">VI</option>
            <option value="en">EN</option>
          </select>
        </div>

        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 p-2.5 text-slate-600 shadow-soft transition hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          title={isDark ? 'Chế độ tối' : 'Chế độ sáng'}
        >
          <span className="material-symbols-outlined text-[22px]">
            {isDark ? 'dark_mode' : 'light_mode'}
          </span>
        </button>

        {!user ? (
          <Link
            to="/auth/login"
            className="relative z-[1] inline-flex items-center gap-2 rounded-xl border border-[#2563eb]/30 bg-[#2b7cee] px-4 py-2.5 text-xs font-bold !text-white no-underline shadow-md shadow-[#2b7cee]/35 transition visited:bg-[#2b7cee] visited:!text-white hover:bg-[#1e64d8] hover:shadow-lg"
          >
            <span className="material-symbols-outlined text-[18px] !text-white">login</span>
            <span className="!text-white">{t('common.login')}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            {t('common.logout')}
          </button>
        )}

        {user ? (
        <Link
          to="/user/notifications"
          className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label={t('common.notifications')}
        >
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          {unreadNotifications > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          ) : null}
        </Link>
        ) : null}

        {user ? <div className="mx-1 hidden h-7 w-px bg-slate-200 dark:bg-white/10 sm:block" /> : null}

        {user && (
          <Link
            to="/user/profile"
            className="group flex items-center gap-2.5 rounded-2xl py-1 pl-1 pr-2 transition hover:bg-slate-50 dark:hover:bg-white/5 md:gap-3 md:pr-3"
          >
            <div className="hidden text-right lg:block">
              <p className="text-sm font-bold leading-tight text-slate-800 group-hover:text-primary dark:text-slate-100 dark:group-hover:text-white">
                {user.fullName}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {user.role === "Student" ? "Học viên" : user.role}
              </p>
            </div>

            <div className="relative">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover shadow-md shadow-primary/20 ring-2 ring-white transition group-hover:scale-[1.03] dark:ring-slate-950"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-sm font-bold text-white shadow-md shadow-primary/30 transition group-hover:scale-[1.03]">
                  {getInitials(user.fullName)}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400 shadow-sm dark:border-slate-950" />
            </div>
          </Link>
        )}
      </div>
    </header>
  );
};

export default Navbar;
