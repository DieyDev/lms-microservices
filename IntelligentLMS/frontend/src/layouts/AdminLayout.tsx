import { Outlet, Navigate, NavLink, Link } from 'react-router-dom';
import { getRole, isAuthenticated } from '../utils/auth';

const AdminLayout = () => {
  if (!isAuthenticated()) return <Navigate to="/auth/login" replace />;

  const role = getRole();
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';

  if (!isAdmin && !isTeacher) return <Navigate to="/user/dashboard" replace />;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-4 py-2.5 text-sm font-bold transition ${
      isActive
        ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-md shadow-primary/25'
        : 'border border-slate-200/90 bg-white/90 text-slate-700 shadow-soft hover:border-primary/25 hover:text-primary'
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/35 to-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary/80">Quản trị</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              {isAdmin ? 'Admin Panel' : 'Teacher Panel'}
            </h1>
          </div>
          <Link
            to="/user/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-soft transition hover:border-primary/30 hover:bg-white hover:shadow-card"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">person</span>
            Sang User
          </Link>
        </div>

        <nav className="mb-8 flex flex-wrap gap-2">
          <NavLink to="/admin/dashboard" className={navClass}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/courses" className={navClass}>
            Courses
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/admin/users" className={navClass}>
                Users
              </NavLink>
              <NavLink to="/admin/teachers" className={navClass}>
                Teachers
              </NavLink>
              <NavLink to="/admin/monitor" className={navClass}>
                Monitor
              </NavLink>
            </>
          )}
        </nav>

        <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur-md md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
