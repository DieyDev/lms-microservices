import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { courseApi, userApi, CourseProgressResponse } from '../../services/api';
import { getCurrentUserFromToken, isAuthenticated } from '../../utils/auth';

const roleLabel = (role: string | undefined) => {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'Quản trị viên';
  if (r === 'teacher') return 'Giảng viên';
  return 'Học viên';
};

const roleColor = (role: string | undefined) => {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' };
  if (r === 'teacher') return { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' };
  return { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' };
};

const Profile = () => {
  const user = getCurrentUserFromToken();
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progressStats, setProgressStats] = useState<{
    total: number;
    completed: number;
    avgProgress: number;
    totalLessons: number;
  }>({ total: 0, completed: 0, avgProgress: 0, totalLessons: 0 });
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('');
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const MAX_AVATAR_BYTES = 350 * 1024;

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!isAuthenticated() || !user) {
          setProgressStats({ total: 0, completed: 0, avgProgress: 0, totalLessons: 0 });
          return;
        }
        try {
          const { data } = await userApi.getProfile(user.id);
          const d = data as {
            fullName?: string;
            FullName?: string;
            bio?: string;
            Bio?: string;
            avatarUrl?: string;
            AvatarUrl?: string;
          };
          if (d?.fullName ?? d?.FullName) setFullName(d.fullName || d.FullName || '');
          if (d?.bio ?? d?.Bio) setBio(d.bio || d.Bio || '');
          const av = d.avatarUrl ?? d.AvatarUrl;
          if (typeof av === 'string') setAvatarUrl(av);
        } catch {
          setFullName(user.fullName || '');
        }
        const coursesRes = await courseApi.getCourses();
        const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        if (courses.length === 0) {
          setProgressStats({ total: 0, completed: 0, avgProgress: 0, totalLessons: 0 });
          return;
        }
        const entries: { p: CourseProgressResponse }[] = [];
        for (const c of courses) {
          try {
            const p = await courseApi.getCourseProgress(user.id, c.id);
            entries.push({ p });
          } catch {
            // Chưa ghi danh → bỏ qua
          }
        }
        const total = entries.length;
        const completed = entries.filter((x) => (x.p.progressPercentage ?? 0) >= 100).length;
        const avgProgress =
          total === 0
            ? 0
            : Math.round(entries.reduce((a, x) => a + (x.p.progressPercentage ?? 0), 0) / total);
        const totalLessons = entries.reduce((a, x) => a + (x.p.completedLessons ?? 0), 0);
        setProgressStats({ total, completed, avgProgress, totalLessons });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const initials =
    (user?.fullName || user?.email || 'U')
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0))
      .join('')
      .toUpperCase() || 'U';

  if (!user) {
    return (
      <>
        <style>{profileStyles}</style>
        <div className="profile-page-wrapper">
          <div className="profile-empty-state">
            <div className="empty-icon">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
            <h2>Chưa đăng nhập</h2>
            <p>Vui lòng đăng nhập để xem hồ sơ của bạn.</p>
            <Link to="/auth/login" className="btn-primary">
              <span className="material-symbols-outlined">login</span>
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </>
    );
  }

  const rc = roleColor(user.role);

  const stats = [
    {
      label: 'Khóa đã ghi danh',
      value: loading ? null : progressStats.total,
      icon: 'menu_book',
      accent: '#6366f1',
      bg: '#eef2ff',
    },
    {
      label: 'Hoàn thành',
      value: loading ? null : progressStats.completed,
      icon: 'task_alt',
      accent: '#10b981',
      bg: '#ecfdf5',
    },
    {
      label: 'Tiến độ TB',
      value: loading ? null : `${progressStats.avgProgress}%`,
      icon: 'trending_up',
      accent: '#8b5cf6',
      bg: '#f5f3ff',
    },
    {
      label: 'Bài đã học',
      value: loading ? null : progressStats.totalLessons,
      icon: 'checklist',
      accent: '#f59e0b',
      bg: '#fffbeb',
    },
  ];

  return (
    <>
      <style>{profileStyles}</style>
      <div className="profile-page-wrapper">
        {/* Hero Card */}
        <div className="profile-hero-card">
          <div className="hero-cover">
            <div className="cover-orb cover-orb-1" />
            <div className="cover-orb cover-orb-2" />
            <div className="cover-orb cover-orb-3" />
            <div className="cover-grid" />
          </div>

          <div className="hero-body">
            <div className="hero-left">
              <div className="avatar-ring">
                <div className="avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="avatar-status" />
              </div>
              <div className="hero-info">
                <h1 className="hero-name">{user.fullName || 'Học viên'}</h1>
                <p className="hero-email">
                  <span className="material-symbols-outlined">alternate_email</span>
                  {user.email}
                </p>
                <span
                  className="role-badge"
                  style={{ background: rc.bg, color: rc.text }}
                >
                  <span
                    className="role-dot"
                    style={{ background: rc.dot }}
                  />
                  {roleLabel(user.role)}
                </span>
              </div>
            </div>
            <button type="button" className="btn-edit-hero" onClick={() => document.getElementById('profile-form')?.scrollIntoView({ behavior: 'smooth' })}>
              <span className="material-symbols-outlined">edit</span>
              Chỉnh sửa
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-grid">
          {stats.map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.bg, color: s.accent }}>
                <span className="material-symbols-outlined">{s.icon}</span>
              </div>
              <div className="stat-content">
                <span className="stat-value" style={{ color: s.accent }}>
                  {s.value === null ? (
                    <span className="stat-skeleton" />
                  ) : (
                    s.value
                  )}
                </span>
                <span className="stat-label">{s.label}</span>
              </div>
              {progressStats.avgProgress > 0 && s.label === 'Tiến độ TB' && (
                <div className="stat-mini-bar">
                  <div
                    className="stat-mini-fill"
                    style={{
                      width: `${progressStats.avgProgress}%`,
                      background: s.accent,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Personal Info Form */}
        <div id="profile-form" className="profile-form-card">
          <div className="form-card-header">
            <div className="form-card-title-group">
              <span className="material-symbols-outlined form-icon">person</span>
              <h3>Thông tin cá nhân</h3>
            </div>
            <p className="form-card-subtitle">Cập nhật thông tin hiển thị trên hồ sơ của bạn</p>
          </div>

            <div className="form-grid">
            <div className="form-field full-width avatar-field">
              <label htmlFor="profile-avatar-file">
                <span className="material-symbols-outlined">account_circle</span>
                Ảnh đại diện
              </label>
              <p className="avatar-hint">Chọn ảnh từ máy (tối đa 350KB) hoặc dán URL ảnh công khai (https://…)</p>
              <div className="avatar-actions">
                <input
                  id="profile-avatar-file"
                  ref={avatarFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  aria-label="Chọn ảnh đại diện từ máy"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    if (!f.type.startsWith('image/')) {
                      setSaveMsg({ type: 'error', text: 'Chỉ chọn file ảnh (JPEG, PNG, WebP, GIF).' });
                      return;
                    }
                    if (f.size > MAX_AVATAR_BYTES) {
                      setSaveMsg({ type: 'error', text: 'Ảnh quá lớn. Vui lòng chọn file dưới 350KB hoặc dùng URL.' });
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setAvatarUrl(typeof reader.result === 'string' ? reader.result : '');
                      setSaveMsg(null);
                    };
                    reader.readAsDataURL(f);
                  }}
                />
                <button
                  type="button"
                  className="btn-avatar-pick"
                  onClick={() => avatarFileRef.current?.click()}
                >
                  <span className="material-symbols-outlined">add_photo_alternate</span>
                  Chọn ảnh
                </button>
                <input
                  type="url"
                  className="avatar-url-input"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value.trim())}
                />
                {avatarUrl ? (
                  <button type="button" className="btn-avatar-clear" onClick={() => setAvatarUrl('')}>
                    Xóa ảnh
                  </button>
                ) : null}
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="full-name">
                <span className="material-symbols-outlined">badge</span>
                Họ và tên
              </label>
              <input
                id="full-name"
                type="text"
                placeholder="Nhập họ và tên đầy đủ"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="email">
                <span className="material-symbols-outlined">mail</span>
                Email
                <span className="field-locked">
                  <span className="material-symbols-outlined">lock</span>
                  Không thể thay đổi
                </span>
              </label>
              <input
                id="email"
                type="email"
                readOnly
                className="readonly"
                value={user.email || ''}
              />
            </div>

            <div className="form-field full-width">
              <label htmlFor="bio">
                <span className="material-symbols-outlined">notes</span>
                Giới thiệu ngắn
              </label>
              <textarea
                id="bio"
                rows={3}
                placeholder="Viết vài dòng về bản thân, kinh nghiệm hoặc mục tiêu học tập..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>

          {saveMsg && (
            <p className={saveMsg.type === 'success' ? 'text-emerald-600 text-sm font-semibold' : 'text-rose-500 text-sm font-semibold'}>
              {saveMsg.text}
            </p>
          )}

          <div className="form-actions">
            <Link to="/user/dashboard" className="btn-ghost">
              Hủy bỏ
            </Link>
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setSaveMsg(null);
                try {
                  await userApi.updateProfile(user.id, { fullName, bio, avatarUrl });
                  window.dispatchEvent(
                    new CustomEvent('lms-profile-updated', {
                      detail: { fullName, avatarUrl: avatarUrl || undefined },
                    })
                  );
                  setSaveMsg({ type: 'success', text: 'Đã lưu thay đổi thành công.' });
                } catch (err: unknown) {
                  setSaveMsg({ type: 'error', text: 'Không thể lưu. Vui lòng thử lại.' });
                } finally {
                  setSaving(false);
                }
              }}
            >
              <span className="material-symbols-outlined">save</span>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const profileStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');

  .profile-page-wrapper {
    font-family: 'Be Vietnam Pro', sans-serif;
    max-width: 900px;
    margin: 0 auto;
    padding: 32px 20px 60px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── HERO CARD ── */
  .profile-hero-card {
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(99,102,241,0.10), 0 1px 4px rgba(0,0,0,0.06);
    background: #fff;
  }

  .hero-cover {
    height: 160px;
    background: linear-gradient(135deg, #312e81 0%, #4f46e5 45%, #7c3aed 100%);
    position: relative;
    overflow: hidden;
  }

  .cover-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(40px);
    opacity: 0.5;
  }
  .cover-orb-1 {
    width: 220px; height: 220px;
    background: #818cf8;
    top: -80px; left: -40px;
  }
  .cover-orb-2 {
    width: 160px; height: 160px;
    background: #a78bfa;
    bottom: -60px; right: 60px;
  }
  .cover-orb-3 {
    width: 100px; height: 100px;
    background: #60a5fa;
    top: 10px; right: 20%;
    opacity: 0.3;
  }
  .cover-grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size: 32px 32px;
  }

  .hero-body {
    padding: 0 28px 24px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: -24px;
    position: relative;
    z-index: 1;
  }

  .hero-left {
    display: flex;
    align-items: flex-end;
    gap: 18px;
  }

  .avatar-ring {
    position: relative;
    flex-shrink: 0;
  }

  .avatar {
    width: 88px;
    height: 88px;
    border-radius: 20px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border: 4px solid #fff;
    box-shadow: 0 8px 24px rgba(99,102,241,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -1px;
    overflow: hidden;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 16px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .avatar-field .avatar-hint {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
    margin: 0 0 10px;
    text-transform: none;
    letter-spacing: 0;
  }

  .avatar-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .btn-avatar-pick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 12px;
    background: #eef2ff;
    color: #4f46e5;
    font-size: 13px;
    font-weight: 700;
    border: 1.5px solid #c7d2fe;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-avatar-pick:hover {
    background: #e0e7ff;
  }

  .avatar-url-input {
    flex: 1;
    min-width: 200px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    font-size: 13px;
    font-family: inherit;
    outline: none;
  }

  .avatar-url-input:focus {
    border-color: #6366f1;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(99,102,241,0.10);
  }

  .btn-avatar-clear {
    padding: 10px 14px;
    border-radius: 12px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid #fecaca;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-avatar-clear:hover {
    background: #fee2e2;
  }

  .avatar-status {
    position: absolute;
    bottom: 6px;
    right: 6px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #10b981;
    border: 2.5px solid #fff;
    box-shadow: 0 0 0 3px rgba(16,185,129,0.2);
  }

  .hero-info {
    padding-bottom: 4px;
  }

  .hero-name {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 4px;
    letter-spacing: -0.5px;
  }

  .hero-email {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
    margin: 0 0 10px;
    max-width: 100%;
    word-break: break-all;
  }

  .hero-email .material-symbols-outlined {
    font-size: 15px;
    color: #94a3b8;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 4px 8px;
    border-radius: 100px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .role-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .btn-edit-hero {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 12px;
    background: #f1f5f9;
    color: #475569;
    font-size: 13px;
    font-weight: 600;
    border: 1.5px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.18s;
    font-family: inherit;
    align-self: flex-end;
    margin-bottom: 4px;
  }

  .btn-edit-hero:hover {
    background: #e0e7ff;
    color: #4f46e5;
    border-color: #c7d2fe;
  }

  .btn-edit-hero .material-symbols-outlined {
    font-size: 17px;
  }

  /* ── STATS GRID ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  @media (max-width: 700px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .stat-card {
    background: #fff;
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: transform 0.18s, box-shadow 0.18s;
    position: relative;
    overflow: hidden;
  }

  .stat-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: currentColor;
    opacity: 0;
    transition: opacity 0.2s;
    border-radius: 3px 3px 0 0;
  }

  .stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(0,0,0,0.10);
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stat-icon .material-symbols-outlined {
    font-size: 22px;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .stat-value {
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -1px;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .stat-skeleton {
    display: inline-block;
    width: 48px;
    height: 26px;
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 6px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .stat-mini-bar {
    height: 4px;
    background: #f1f5f9;
    border-radius: 99px;
    overflow: hidden;
  }

  .stat-mini-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 1s cubic-bezier(.4,0,.2,1);
  }

  /* ── FORM CARD ── */
  .profile-form-card {
    background: #fff;
    border-radius: 24px;
    padding: 32px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
  }

  .form-card-header {
    margin-bottom: 28px;
    padding-bottom: 24px;
    border-bottom: 1px solid #f1f5f9;
  }

  .form-card-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .form-card-title-group h3 {
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.3px;
  }

  .form-icon {
    font-size: 22px;
    color: #6366f1;
    background: #eef2ff;
    padding: 6px;
    border-radius: 10px;
  }

  .form-card-subtitle {
    font-size: 13px;
    color: #94a3b8;
    font-weight: 500;
    margin: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 640px) {
    .form-grid { grid-template-columns: 1fr; }
    .full-width { grid-column: 1 !important; }
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-field label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-field label .material-symbols-outlined {
    font-size: 15px;
    color: #94a3b8;
  }

  .field-locked {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
    font-size: 10px;
    color: #94a3b8;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    background: #f8fafc;
    padding: 2px 8px;
    border-radius: 99px;
    border: 1px solid #e2e8f0;
  }

  .field-locked .material-symbols-outlined {
    font-size: 12px;
  }

  .form-field input,
  .form-field textarea {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    font-size: 14px;
    font-weight: 500;
    color: #0f172a;
    font-family: inherit;
    outline: none;
    transition: all 0.18s;
    resize: none;
  }

  .form-field input:focus,
  .form-field textarea:focus {
    border-color: #6366f1;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(99,102,241,0.10);
  }

  .form-field input.readonly {
    background: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
    border-color: transparent;
  }

  .form-field input::placeholder,
  .form-field textarea::placeholder {
    color: #cbd5e1;
    font-weight: 400;
  }

  /* ── ACTIONS ── */
  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 24px;
    margin-top: 24px;
    border-top: 1px solid #f1f5f9;
  }

  .btn-ghost {
    padding: 10px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    text-decoration: none;
    transition: all 0.18s;
    font-family: inherit;
  }

  .btn-ghost:hover {
    background: #f1f5f9;
    color: #334155;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 11px 22px;
    border-radius: 12px;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    border: none;
    cursor: pointer;
    transition: all 0.18s;
    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
    text-decoration: none;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(99,102,241,0.45);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-primary .material-symbols-outlined {
    font-size: 18px;
  }

  /* ── EMPTY STATE ── */
  .profile-empty-state {
    background: #fff;
    border-radius: 24px;
    padding: 64px 32px;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .empty-icon {
    width: 72px;
    height: 72px;
    border-radius: 20px;
    background: #eef2ff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .empty-icon .material-symbols-outlined {
    font-size: 36px;
    color: #6366f1;
  }

  .profile-empty-state h2 {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
  }

  .profile-empty-state p {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }
`;

export default Profile;
