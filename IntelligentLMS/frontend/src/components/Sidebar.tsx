import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { courseApi } from '../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../utils/auth';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
}

const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [studentCode, setStudentCode] = useState<string>('');

  useEffect(() => {
    const fetchProgress = async () => {
      if (!isAuthenticated()) {
        setProgress(0);
        setStudentCode('');
        return;
      }

      const user = getCurrentUserFromToken();
      if (!user) {
        setProgress(0);
        setStudentCode('');
        return;
      }

      const codeBase =
        user.email?.split('@')[0] || user.fullName?.split(' ')[0] || user.id.slice(0, 8);
      setStudentCode(`#${codeBase.toUpperCase()}`);

      try {
        const coursesRes = await courseApi.getCourses();
        const firstCourseId = coursesRes.data?.[0]?.id;
        if (!firstCourseId) {
          setProgress(0);
          return;
        }
        const data = await courseApi.getCourseProgress(user.id, firstCourseId);
        setProgress(data.progressPercentage ?? 0);
      } catch {
        setProgress(0);
      }
    };

    if (!isCollapsed) fetchProgress();
  }, [isCollapsed]);

  const menuItems = [
    { path: '/user/dashboard', icon: 'dashboard', label: 'Trang chủ' },
    { path: '/user/courses', icon: 'menu_book', label: 'Khóa học' },
    { path: '/user/learning-path', icon: 'trending_up', label: 'Lộ trình' },
    { path: '/user/achievements', icon: 'workspace_premium', label: 'Bảng vàng' },
    { path: '/user/profile', icon: 'account_circle', label: 'Cá nhân' },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 z-50 shadow-sm overflow-hidden"
    >
      
      {/* 1. BRANDING */}
      <div className={`h-20 flex items-center px-6 mb-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3 overflow-hidden"
            >
              <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <div className="flex flex-col min-w-[120px]">
                <span className="font-black text-gray-800 tracking-tighter text-lg leading-tight">
                  <span className="text-blue-600">Intelligent</span>LMS
                </span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Learning Platform</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 text-gray-400 hover:text-blue-600 rounded-xl transition-all">
          <span className="material-symbols-outlined text-[24px]">
            {isCollapsed ? 'last_page' : 'first_page'}
          </span>
        </button>
      </div>

      {/* 2. MENU */}
      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="block relative group">
              <div className={`flex items-center gap-4 p-3.5 rounded-2xl transition-all ${
                isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* 3. WIDGET TIẾN ĐỘ THẬT */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 mx-4 mb-6 bg-blue-600 rounded-2xl text-white shadow-xl relative overflow-hidden group"
          >
            <div className="relative z-10">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">Mã học viên</p>
              <p className="text-sm font-black mb-3">{studentCode || '#INTLMS-STUDENT'}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 h-1 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }} 
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="bg-white h-full" 
                  />
                </div>
                <span className="text-[10px] font-bold">{progress}%</span>
              </div>
            </div>
            <span className="material-symbols-outlined absolute -bottom-2 -right-2 text-6xl opacity-10 rotate-12">
              auto_awesome
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};

export default Sidebar;