import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { getRole } from "./utils/auth";

// Layouts
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";

// Auth
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";

// User Pages
import Dashboard from "./pages/user/Dashboard";
import Courses from "./pages/user/Courses";
import LearningPath from "./pages/user/LearningPath";
import Achievements from "./pages/user/Achievements";
import Profile from "./pages/user/Profile";
import Notifications from "./pages/user/Notifications";
import LessonView from "./pages/user/LessonView";
import CourseDetail from "./pages/user/CourseDetail";
import PaymentResult from "./pages/user/PaymentResult";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import SystemMonitor from "./pages/admin/SystemMonitor";
import Teachers from "./pages/admin/Teachers";
import Users from "./pages/admin/Users";
import CoursesAdmin from "./pages/admin/Courses";
import TeacherDashboard from "./pages/teacher/Dashboard";

function RoleBasedDashboard() {
  const role = getRole();
  if (role === "teacher") return <TeacherDashboard />;
  return <AdminDashboard />;
}

function AdminOnly({ children }: { children: ReactElement }) {
  const role = getRole();
  if (role !== "admin") return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      {/* 1. PUBLIC ROUTES */}
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/forgot-password" element={<ForgotPassword />} />

      {/* 2. USER ROUTES */}
      <Route element={<UserLayout />}>
        <Route path="/user/dashboard" element={<Dashboard />} />
        <Route path="/user/courses" element={<Courses />} />
        <Route path="/user/course/:id" element={<CourseDetail />} />
        <Route path="/user/learning-path" element={<LearningPath />} />
        <Route path="/user/achievements" element={<Achievements />} />
        <Route path="/user/profile" element={<Profile />} />
        <Route path="/user/notifications" element={<Notifications />} />
        <Route path="/user/lesson/:courseId" element={<LessonView />} />
      </Route>

      {/* 3. ADMIN ROUTES */}
      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<RoleBasedDashboard />} />
        <Route path="/admin/monitor" element={<AdminOnly><SystemMonitor /></AdminOnly>} />
        <Route path="/admin/teachers" element={<AdminOnly><Teachers /></AdminOnly>} />
        <Route path="/admin/users" element={<AdminOnly><Users /></AdminOnly>} />
        <Route path="/admin/courses" element={<CoursesAdmin />} />
      </Route>

      {/* Payment result (sau khi VNPAY redirect) */}
      <Route path="/payment/result" element={<PaymentResult />} />

      {/* 4. DEFAULT REDIRECT */}
      <Route path="/" element={<Navigate to="/user/dashboard" />} />
      <Route path="/courses" element={<Navigate to="/user/courses" />} />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="lms-mesh-bg flex min-h-screen flex-col items-center justify-center px-6 py-16">
            <div className="max-w-md text-center">
              <p className="font-mono text-sm font-bold uppercase tracking-[0.35em] text-primary/70">Lỗi 404</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">Trang không tồn tại</h1>
              <p className="mt-3 text-slate-500">
                Đường dẫn bạn mở không có trong hệ thống. Hãy quay lại trang chủ hoặc kiểm tra URL.
              </p>
              <a
                href="/user/dashboard"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition hover:bg-primary-hover"
              >
                <span className="material-symbols-outlined text-[20px]">home</span>
                Về trang chủ
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default App;