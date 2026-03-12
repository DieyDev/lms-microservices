import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const UserLayout = () => {
  // Trạng thái thu gọn: false là mở rộng, true là thu nhỏ
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      {/* Truyền biến và hàm vào Sidebar */}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        
        <main className="flex-1 overflow-y-auto flex flex-col bg-gray-50/50">
          <div className="flex-1 p-4">
            <Outlet />
          </div>
          <Footer /> 
        </main>
      </div>
    </div>
  );
};

export default UserLayout;