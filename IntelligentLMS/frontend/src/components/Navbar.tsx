import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfileResponse, userApi } from '../services/api';
import { getCurrentUserFromToken, isAuthenticated, logout } from '../utils/auth';

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserProfileResponse | null>(null);

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

  const getInitials = (name: string | undefined) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-[100] flex min-h-[4.25rem] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-2 shadow-nav backdrop-blur-xl md:gap-4 md:px-8">
      <div className="order-1 flex min-w-0 w-full max-w-full sm:max-w-xl sm:flex-1">
        <div className="relative w-full group">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition group-focus-within:text-primary">
            <span className="material-symbols-outlined text-[22px]">search</span>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 py-2.5 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary/40 focus:bg-slate-50 focus:ring-2 focus:ring-primary/20"
            placeholder="Tìm kiếm khóa học, bài học..."
          />
        </div>
      </div>

      <div className="order-2 flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto md:gap-3">
        {!user ? (
          <Link
            to="/auth/login"
            className="relative z-[1] inline-flex items-center gap-2 rounded-xl border border-[#2563eb]/30 bg-[#2b7cee] px-4 py-2.5 text-xs font-bold !text-white no-underline shadow-md shadow-[#2b7cee]/35 transition visited:bg-[#2b7cee] visited:!text-white hover:bg-[#1e64d8] hover:shadow-lg"
          >
            <span className="material-symbols-outlined text-[18px] !text-white">login</span>
            <span className="!text-white">Đăng nhập</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
          >
            Đăng xuất
          </button>
        )}

        {user ? (
        <Link
          to="/user/notifications"
          className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-primary"
          aria-label="Thông báo"
        >
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          <span className="absolute right-2 top-2 block h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </Link>
        ) : null}

        {user ? <div className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" /> : null}

        {user && (
          <Link
            to="/user/profile"
            className="group flex items-center gap-2.5 rounded-2xl py-1 pl-1 pr-2 transition hover:bg-slate-50 md:gap-3 md:pr-3"
          >
            <div className="hidden text-right lg:block">
              <p className="text-sm font-bold leading-tight text-slate-800 group-hover:text-primary">
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
                  className="h-10 w-10 rounded-xl object-cover shadow-md shadow-primary/20 ring-2 ring-white transition group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-sm font-bold text-white shadow-md shadow-primary/30 transition group-hover:scale-[1.03]">
                  {getInitials(user.fullName)}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400 shadow-sm" />
            </div>
          </Link>
        )}
      </div>
    </header>
  );
};

export default Navbar;
