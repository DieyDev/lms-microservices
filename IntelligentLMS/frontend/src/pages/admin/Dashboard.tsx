import { motion, Variants } from 'framer-motion';
import { useState, useEffect } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  MenuItem,
} from '@mui/material';
import { adminAuthApi, AdminUserRow } from '../../services/api';

// ─── Animation Variants ───────────────────────────────────────
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 280, damping: 20 } },
};

// ─── Mini Spark Bar Component ─────────────────────────────────
const SparkBar = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-[3px] h-10">
      {data.map((v, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 300 }}
          style={{ height: `${(v / max) * 100}%`, originY: 1 }}
          className={`w-1.5 rounded-full ${color} opacity-80`}
        />
      ))}
    </div>
  );
};

// ─── Ring Progress ─────────────────────────────────────────────
const RingProgress = ({
  value,
  size = 80,
  stroke = 6,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
}) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (value / 100) * circ }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
      />
    </svg>
  );
};

// ─── Live Ticker ───────────────────────────────────────────────
const LiveTicker = () => {
  const [count, setCount] = useState(247);
  useEffect(() => {
    const t = setInterval(() => setCount(c => c + Math.floor(Math.random() * 3)), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.span
      key={count}
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="tabular-nums"
    >
      {count.toLocaleString()}
    </motion.span>
  );
};

// ─── Main Component ────────────────────────────────────────────
const AdminDashboard = () => {
  const stats = [
    {
      label: 'Tổng học viên',
      value: '12,540',
      delta: '+8.2%',
      positive: true,
      icon: 'group',
      accent: '#3b82f6',
      spark: [30, 45, 38, 60, 52, 70, 65, 80, 74, 90],
    },
    {
      label: 'Khóa học hoạt động',
      value: '48',
      delta: '+3',
      positive: true,
      icon: 'auto_stories',
      accent: '#a855f7',
      spark: [20, 28, 35, 30, 45, 40, 50, 48, 55, 48],
    },
    {
      label: 'Doanh thu tháng',
      value: '$12,400',
      delta: '+14.5%',
      positive: true,
      icon: 'payments',
      accent: '#10b981',
      spark: [50, 40, 60, 55, 75, 65, 80, 70, 90, 85],
    },
    {
      label: 'Yêu cầu hỗ trợ',
      value: '12',
      delta: '-3',
      positive: false,
      icon: 'support_agent',
      accent: '#f43f5e',
      spark: [20, 18, 22, 15, 18, 12, 16, 10, 14, 12],
    },
  ];

  const services = [
    { name: 'Auth Service', status: 'online', latency: '12ms', uptime: 99.9, color: '#10b981' },
    { name: 'Course API', status: 'online', latency: '28ms', uptime: 99.4, color: '#10b981' },
    { name: 'AI Advisor', status: 'online', latency: '145ms', uptime: 97.8, color: '#f59e0b' },
    { name: 'Media CDN', status: 'online', latency: '8ms', uptime: 99.9, color: '#10b981' },
    { name: 'Analytics', status: 'degraded', latency: '320ms', uptime: 94.2, color: '#f43f5e' },
  ];

  const recentActivity = [
    { user: 'Trần Thị B', action: 'đăng ký khóa học React Advanced', time: '2 phút trước', type: 'enroll' },
    { user: 'Lê Văn C', action: 'hoàn thành TypeScript Mastery', time: '15 phút trước', type: 'complete' },
    { user: 'Phạm Thị D', action: 'gửi yêu cầu hỗ trợ #1042', time: '28 phút trước', type: 'support' },
    { user: 'Nguyễn Văn E', action: 'thanh toán gói Premium 1 năm', time: '1 giờ trước', type: 'payment' },
    { user: 'Đinh Thị F', action: 'đăng ký khóa học Node.js', time: '2 giờ trước', type: 'enroll' },
  ];

  const activityColor: Record<string, string> = {
    enroll: '#3b82f6',
    complete: '#10b981',
    support: '#f43f5e',
    payment: '#a855f7',
  };

  const activityIcon: Record<string, string> = {
    enroll: 'school',
    complete: 'verified',
    support: 'headset_mic',
    payment: 'credit_card',
  };

  // ── Teachers CRUD (dữ liệu thật từ Auth service) ─────────────────
  const [teacherRows, setTeacherRows] = useState<AdminUserRow[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(true);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [teacherEditing, setTeacherEditing] = useState<AdminUserRow | null>(null);
  const [teacherForm, setTeacherForm] = useState<{
    email: string;
    fullName: string;
    role: string;
    password: string;
    isLocked: boolean;
  }>({
    email: '',
    fullName: '',
    role: 'Teacher',
    password: 'Password123!',
    isLocked: false,
  });

  const loadTeachers = async () => {
    setTeacherLoading(true);
    try {
      const res = await adminAuthApi.listUsers('Teacher');
      setTeacherRows(res.data || []);
    } catch (e: any) {
      // Nếu không phải Admin hoặc token lỗi
      console.error(e);
    } finally {
      setTeacherLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const teacherFiltered = (() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teacherRows;
    return teacherRows.filter(r =>
      (r.fullName || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q)
    );
  })();

  const teacherColumns: GridColDef[] = [
    { field: 'fullName', headerName: 'Họ tên', flex: 1, minWidth: 170 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    { field: 'role', headerName: 'Role', width: 120 },
    {
      field: 'isLocked',
      headerName: 'Khóa',
      width: 110,
      renderCell: (params) => ((params.row as AdminUserRow).isLocked ? 'Yes' : 'No'),
    },
    {
      field: 'actions',
      headerName: 'Hành động',
      width: 220,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const r = params.row as AdminUserRow;
        return (
          <div className="flex gap-2">
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setTeacherEditing(r);
                setTeacherForm({
                  email: r.email,
                  fullName: r.fullName,
                  role: r.role,
                  password: 'Password123!',
                  isLocked: r.isLocked,
                });
                setTeacherOpen(true);
              }}
            >
              Sửa
            </Button>
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={async () => {
                if (!confirm(`Xóa giảng viên ${r.email}?`)) return;
                try {
                  await adminAuthApi.deleteUser(r.id);
                  setTeacherRows(prev => prev.filter(x => x.id !== r.id));
                } catch (e: any) {
                  alert(e?.response?.data?.message || 'Không thể xóa.');
                }
              }}
            >
              Xóa
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        className="max-w-[1400px] mx-auto space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* ── Header ───────────────────────────── */}
        <motion.div variants={fadeUp} className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-6 bg-blue-500 rounded-full" />
              <span className="text-xs font-bold tracking-[0.3em] text-blue-400 uppercase">
                Admin Control Center
              </span>
            </div>
            <h1
              className="text-5xl font-black tracking-tight leading-none"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Giám sát
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                {' '}Hệ thống
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {/* Live indicator */}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-green-500" />
              </span>
              <span className="text-xs font-bold text-green-400 tracking-widest uppercase">Live</span>
            </div>

            {/* Active users */}
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Đang trực tuyến</p>
              <p className="text-2xl font-black text-white tabular-nums">
                <LiveTicker />
              </p>
            </div>

            {/* Export button */}
            <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm transition-colors">
              <span className="material-symbols-outlined text-lg">download</span>
              Xuất báo cáo
            </button>
          </div>
        </motion.div>

        {/* ── Stat Cards ───────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              variants={scaleIn}
              whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400 } }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 group cursor-default"
            >
              {/* Glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${s.accent}18 0%, transparent 70%)`,
                }}
              />

              {/* Top row */}
              <div className="flex items-start justify-between mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${s.accent}20`, boxShadow: `0 0 20px ${s.accent}30` }}
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: s.accent }}
                  >
                    {s.icon}
                  </span>
                </div>

                {/* Delta badge */}
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                    s.positive
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {s.delta}
                </span>
              </div>

              {/* Value */}
              <p className="text-3xl font-black tabular-nums mb-1">{s.value}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
                {s.label}
              </p>

              {/* Spark */}
              <SparkBar
                data={s.spark}
                color={
                  s.accent === '#3b82f6'
                    ? 'bg-blue-400'
                    : s.accent === '#a855f7'
                    ? 'bg-purple-400'
                    : s.accent === '#10b981'
                    ? 'bg-emerald-400'
                    : 'bg-rose-400'
                }
              />

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-6 right-6 h-[1px] opacity-40"
                style={{ background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)` }}
              />
            </motion.div>
          ))}
        </div>

        {/* ── Middle Row ───────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* System Health */}
          <motion.div
            variants={fadeUp}
            className="xl:col-span-1 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-blue-400">monitor_heart</span>
              <h2 className="font-black text-sm uppercase tracking-widest">Hệ thống</h2>
            </div>

            <div className="space-y-4">
              {services.map((svc, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  {/* Status dot */}
                  <span
                    className="flex-shrink-0 w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: svc.color,
                      boxShadow: `0 0 8px ${svc.color}`,
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{svc.name}</p>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                      {svc.status}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black" style={{ color: svc.color }}>
                      {svc.latency}
                    </p>

                    {/* Mini uptime ring */}
                    <div className="relative inline-flex mt-1">
                      <RingProgress value={svc.uptime} size={32} stroke={3} color={svc.color} />
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[8px] font-black"
                        style={{ color: svc.color }}
                      >
                        {svc.uptime.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Resource Usage */}
          <motion.div
            variants={fadeUp}
            className="xl:col-span-1 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-purple-400">dns</span>
              <h2 className="font-black text-sm uppercase tracking-widest">Tài nguyên</h2>
            </div>

            {[
              { label: 'CPU', value: 43, color: '#3b82f6', icon: 'memory' },
              { label: 'RAM', value: 67, color: '#a855f7', icon: 'developer_board' },
              { label: 'Disk', value: 38, color: '#10b981', icon: 'storage' },
              { label: 'Network', value: 82, color: '#f59e0b', icon: 'wifi' },
            ].map((r, i) => (
              <div key={i} className="mb-5 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm" style={{ color: r.color }}>
                      {r.icon}
                    </span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {r.label}
                    </span>
                  </div>
                  <span className="text-xs font-black" style={{ color: r.color }}>
                    {r.value}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.value}%` }}
                    transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${r.color}80, ${r.color})`,
                      boxShadow: `0 0 8px ${r.color}60`,
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Big ring */}
            <div className="mt-6 flex items-center justify-center gap-8">
              {[
                { label: 'Uptime', value: 99, color: '#10b981' },
                { label: 'Health', value: 87, color: '#3b82f6' },
              ].map((r, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <RingProgress value={r.value} size={72} stroke={5} color={r.color} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-black" style={{ color: r.color }}>
                        {r.value}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                    {r.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Top Courses */}
          <motion.div
            variants={fadeUp}
            className="xl:col-span-1 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-emerald-400">leaderboard</span>
              <h2 className="font-black text-sm uppercase tracking-widest">Top khóa học</h2>
            </div>

            {[
              { name: 'React & TypeScript', students: 1240, pct: 92 },
              { name: 'Node.js Backend', students: 980, pct: 73 },
              { name: 'UI/UX Design', students: 860, pct: 64 },
              { name: 'Python Machine Learning', students: 740, pct: 55 },
              { name: 'Flutter Mobile', students: 610, pct: 45 },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-3 mb-4 last:mb-0">
                <span className="text-xs font-black text-gray-600 w-4 tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate mb-1">{c.name}</p>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                    />
                  </div>
                </div>
                <span className="text-xs font-black text-gray-400 tabular-nums flex-shrink-0">
                  {c.students.toLocaleString()}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Teachers CRUD Panel ───────────────── */}        
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-400">school</span>
              <div>
                <h2 className="font-black text-sm uppercase tracking-widest">Quản lý giảng viên</h2>
                <p className="text-xs text-gray-500">
                  CRUD dữ liệu thật (yêu cầu đăng nhập bằng <span className="font-black text-gray-300">Admin</span>)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => loadTeachers()}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10"
              >
                Tải lại
              </button>
              <button
                onClick={() => {
                  setTeacherEditing(null);
                  setTeacherForm({ email: '', fullName: '', role: 'Teacher', password: 'Password123!', isLocked: false });
                  setTeacherOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-black uppercase tracking-widest"
              >
                Thêm giảng viên
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-purple-500 transition-all text-sm"
              placeholder="Tìm theo tên hoặc email"
            />
          </div>

          <div className="w-full" style={{ height: 520 }}>
            <DataGrid
              rows={teacherFiltered}
              columns={teacherColumns}
              loading={teacherLoading}
              getRowId={(r) => (r as AdminUserRow).id}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              sx={{
                border: '1px solid rgba(148,163,184,0.4)',
                borderRadius: 16,
                color: '#0f172a',
                backgroundColor: '#ffffff',
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid rgba(148,163,184,0.5)',
                  color: '#111827',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                },
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid rgba(226,232,240,0.9)',
                  color: '#111827',
                  fontSize: '0.875rem',
                },
                '& .MuiDataGrid-row:hover': { backgroundColor: '#f9fafb' },
                '& .MuiTablePagination-root': { color: '#4b5563' },
              }}
            />
          </div>
        </motion.div>

        {/* ── Bottom Row ────────────────────────── */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">timeline</span>
              <h2 className="font-black text-sm uppercase tracking-widest">Hoạt động gần đây</h2>
            </div>
            <button className="text-xs font-bold text-gray-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
              Xem tất cả
            </button>
          </div>

          <div className="space-y-2">
            {recentActivity.map((a, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    background: `${activityColor[a.type]}20`,
                    boxShadow: `0 0 12px ${activityColor[a.type]}20`,
                  }}
                >
                  <span
                    className="material-symbols-outlined text-base"
                    style={{ color: activityColor[a.type] }}
                  >
                    {activityIcon[a.type]}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    <span className="text-blue-400">{a.user}</span>
                    {' '}
                    <span className="text-gray-400 font-medium">{a.action}</span>
                  </p>
                </div>

                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex-shrink-0">
                  {a.time}
                </span>

                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-60"
                  style={{ backgroundColor: activityColor[a.type] }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
      `}</style>

      <Dialog open={teacherOpen} onClose={() => setTeacherOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {teacherEditing ? 'Sửa giảng viên' : 'Thêm giảng viên'}
        </DialogTitle>
        <DialogContent style={{ paddingTop: 12 }}>
          <div className="flex flex-col gap-4">
            <TextField
              label="Email"
              value={teacherForm.email}
              disabled={!!teacherEditing}
              onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Họ tên"
              value={teacherForm.fullName}
              onChange={(e) => setTeacherForm((p) => ({ ...p, fullName: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Role"
              value={teacherForm.role}
              onChange={(e) => setTeacherForm((p) => ({ ...p, role: e.target.value }))}
              select
              fullWidth
            >
              <MenuItem value="Teacher">Teacher</MenuItem>
              <MenuItem value="Student">Student</MenuItem>
              <MenuItem value="Admin">Admin</MenuItem>
            </TextField>

            {!teacherEditing && (
              <TextField
                label="Mật khẩu tạm"
                value={teacherForm.password}
                onChange={(e) => setTeacherForm((p) => ({ ...p, password: e.target.value }))}
                fullWidth
              />
            )}

            {teacherEditing && (
              <TextField
                label="Khóa tài khoản"
                value={teacherForm.isLocked ? 'Yes' : 'No'}
                onChange={(e) => setTeacherForm((p) => ({ ...p, isLocked: e.target.value === 'Yes' }))}
                select
                fullWidth
              >
                <MenuItem value="No">No</MenuItem>
                <MenuItem value="Yes">Yes</MenuItem>
              </TextField>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeacherOpen(false)}>Hủy</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                if (teacherEditing) {
                  const res = await adminAuthApi.updateUser(teacherEditing.id, {
                    fullName: teacherForm.fullName,
                    role: teacherForm.role,
                    isLocked: teacherForm.isLocked,
                  });
                  setTeacherRows((prev) => prev.map((x) => (x.id === teacherEditing.id ? res.data : x)));
                } else {
                  const res = await adminAuthApi.createUser({
                    email: teacherForm.email,
                    fullName: teacherForm.fullName,
                    role: teacherForm.role,
                    password: teacherForm.password,
                  });
                  setTeacherRows((prev) => [res.data, ...prev]);
                }
                setTeacherOpen(false);
                setTeacherEditing(null);
              } catch (e: any) {
                alert(e?.response?.data?.message || 'Không thể lưu.');
              }
            }}
          >
            Lưu
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;