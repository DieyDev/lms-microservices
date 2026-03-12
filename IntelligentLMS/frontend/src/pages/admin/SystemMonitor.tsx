import { motion, Variants } from 'framer-motion';
import { useState, useEffect } from 'react';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

// ── Live gauge animation ──────────────────────────────────────
const AnimatedValue = ({ target }: { target: number }) => {
  const [val, setVal] = useState(target);
  useEffect(() => {
    const t = setInterval(() => {
      setVal(target + (Math.random() - 0.5) * 6);
    }, 2500);
    return () => clearInterval(t);
  }, [target]);
  return <span className="tabular-nums">{Math.min(100, Math.max(0, val)).toFixed(1)}</span>;
};

// ── Arc Gauge SVG ─────────────────────────────────────────────
const ArcGauge = ({ value, color, size = 140 }: { value: number; color: string; size?: number }) => {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const startAngle = -210, endAngle = 30;
  const range = endAngle - startAngle;
  const angle = startAngle + (value / 100) * range;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (a1: number, a2: number) => {
    const x1 = cx + r * Math.cos(toRad(a1));
    const y1 = cy + r * Math.sin(toRad(a1));
    const x2 = cx + r * Math.cos(toRad(a2));
    const y2 = cy + r * Math.sin(toRad(a2));
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const circ = 2 * Math.PI * r;
  const totalArc = ((range + 360) % 360) / 360;
  const dashTotal = circ * totalArc;
  const dashFill = (value / 100) * dashTotal;

  return (
    <svg width={size} height={size}>
      {/* Track */}
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeLinecap="round" />
      {/* Fill */}
      <motion.path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${dashTotal} ${circ}`}
        initial={{ strokeDashoffset: dashTotal }}
        animate={{ strokeDashoffset: dashTotal - dashFill }}
        transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
      {/* Needle dot */}
      <motion.circle
        cx={cx + r * Math.cos(toRad(angle))}
        cy={cy + r * Math.sin(toRad(angle))}
        r={5}
        fill={color}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
};

// ── Spark Line ────────────────────────────────────────────────
const SparkLine = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const w = 120, h = 32;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── Main ──────────────────────────────────────────────────────
const SystemMonitor = () => {
  const metrics = [
    {
      name: 'CPU Usage',
      val: 35,
      icon: 'memory',
      color: '#3b82f6',
      unit: '%',
      status: 'Normal',
      spark: [28, 35, 32, 40, 36, 33, 38, 35, 30, 35],
      details: [
        { label: 'Cores', value: '8' },
        { label: 'Threads', value: '16' },
        { label: 'Temp', value: '62°C' },
      ],
    },
    {
      name: 'RAM Memory',
      val: 62,
      icon: 'developer_board',
      color: '#a855f7',
      unit: '%',
      status: 'Moderate',
      spark: [50, 58, 62, 55, 65, 60, 63, 61, 58, 62],
      details: [
        { label: 'Used', value: '9.9 GB' },
        { label: 'Total', value: '16 GB' },
        { label: 'Swap', value: '1.2 GB' },
      ],
    },
    {
      name: 'Storage SSD',
      val: 88,
      icon: 'storage',
      color: '#f43f5e',
      unit: '%',
      status: 'Critical',
      spark: [80, 83, 85, 84, 86, 87, 85, 88, 87, 88],
      details: [
        { label: 'Used', value: '704 GB' },
        { label: 'Total', value: '800 GB' },
        { label: 'Free', value: '96 GB' },
      ],
    },
  ];

  const network = [
    { label: 'Latency', value: '12ms', icon: 'network_ping', good: true },
    { label: 'Upload', value: '45 MB/s', icon: 'upload', good: true },
    { label: 'Download', value: '210 MB/s', icon: 'download', good: true },
    { label: 'Requests/s', value: '1,248', icon: 'http', good: true },
  ];

  const services = [
    { name: 'Gateway', status: 'online', port: 5000 },
    { name: 'Auth', status: 'online', port: 5001 },
    { name: 'Course API', status: 'online', port: 5002 },
    { name: 'Progress', status: 'online', port: 5004 },
    { name: 'AI Service', status: 'degraded', port: 8000 },
    { name: 'Database', status: 'online', port: 5432 },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        className="max-w-6xl mx-auto space-y-8"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-6 bg-rose-500 rounded-full" />
              <span className="text-xs font-bold tracking-[0.3em] text-rose-400 uppercase">Infrastructure</span>
            </div>
            <h1 className="text-5xl font-black tracking-tight">
              Trạng thái{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400">
                Máy chủ
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-bold text-green-400 tracking-widest uppercase">All Systems</span>
          </div>
        </motion.div>

        {/* Gauge Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((m, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6"
            >
              {/* Glow */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(circle at 50% 0%, ${m.color}10 0%, transparent 70%)`,
              }} />

              {/* Top */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                    background: `${m.color}20`, boxShadow: `0 0 16px ${m.color}30`,
                  }}>
                    <span className="material-symbols-outlined text-lg" style={{ color: m.color }}>{m.icon}</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{m.name}</p>
                    <p className="text-[10px] font-bold" style={{ color: m.color }}>{m.status}</p>
                  </div>
                </div>
                <SparkLine data={m.spark} color={m.color} />
              </div>

              {/* Arc Gauge */}
              <div className="flex justify-center relative">
                <ArcGauge value={m.val} color={m.color} size={140} />
                <div className="absolute bottom-6 text-center pointer-events-none">
                  <p className="text-3xl font-black tabular-nums" style={{ color: m.color }}>
                    <AnimatedValue target={m.val} />
                    <span className="text-base">%</span>
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {m.details.map((d, j) => (
                  <div key={j} className="text-center p-2 rounded-lg bg-white/5">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">{d.label}</p>
                    <p className="text-xs font-black mt-0.5" style={{ color: m.color }}>{d.value}</p>
                  </div>
                ))}
              </div>

              {/* Bottom bar */}
              <div className="mt-4">
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${m.val}%` }}
                    transition={{ duration: 1.4, delay: i * 0.15, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${m.color}80, ${m.color})`, boxShadow: `0 0 8px ${m.color}60` }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Network + Services Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Network */}
          <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-blue-400">wifi</span>
              <h2 className="font-black text-sm uppercase tracking-widest">Network I/O</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {network.map((n, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-colors">
                  <span className="material-symbols-outlined text-blue-400 text-xl">{n.icon}</span>
                  <p className="text-xl font-black mt-2 tabular-nums text-white">{n.value}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">{n.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Services */}
          <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-purple-400">hub</span>
              <h2 className="font-black text-sm uppercase tracking-widest">Microservices</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {services.map((s, i) => {
                const online = s.status === 'online';
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="relative flex size-2">
                      {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                      <span className={`relative inline-flex size-2 rounded-full ${online ? 'bg-green-500' : 'bg-amber-500'}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-600 font-bold">:{s.port}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default SystemMonitor;