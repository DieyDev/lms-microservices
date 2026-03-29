import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getRole } from "../utils/auth";

const UserLayout = () => {
  // Trạng thái thu gọn: false là mở rộng, true là thu nhỏ
  const [isCollapsed, setIsCollapsed] = useState(false);
  const role = getRole();
  const canAccessAdminPanel = role === "admin" || role === "teacher";

  return (
    <div className="flex h-screen lms-mesh-bg overflow-hidden">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      {/* Không bọc Navbar trong overflow-hidden — tránh cắt mất nút Đăng nhập / cụm bên phải trên màn hẹp */}
      <div className="flex min-w-0 flex-1 flex-col min-h-0">
        <Navbar />

        {canAccessAdminPanel && (
          <div className="shrink-0 px-4 pt-4">
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-bold text-slate-800 shadow-soft backdrop-blur-sm transition hover:border-primary/30 hover:bg-white hover:shadow-card"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">admin_panel_settings</span>
              Vào {role === "admin" ? "Admin" : "Teacher"} Panel
            </Link>
          </div>
        )}

        {/* Cuộn chung: nội dung trang rồi tới footer — kéo xuống mới thấy footer */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-6 md:px-6">
          <Outlet />
          <Footer />
        </main>
      </div>
    </div>
  );
};

export default UserLayout;