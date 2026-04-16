/**
 * @type {import('tailwindcss').Config}
 * Tailwind v4 không tự đọc `theme.extend` từ đây — nguồn thật là `src/index.css` (@theme).
 * Giữ file này cho IDE / tham chiếu; đổi màu brand ở index.css rồi cập nhật lại cho khớp.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 2px 16px rgba(15, 23, 42, 0.06)',
        card: '0 8px 30px rgba(43, 124, 238, 0.08)',
        nav: '0 1px 0 rgba(15, 23, 42, 0.06)',
      },
      colors: {
        primary: '#2b7cee',
        'primary-hover': '#1e64d8',
        sidebar: '#ffffff',
        'sidebar-text': '#64748b',
        background: '#f8fafc',
        'background-light': '#f4f6fb',
        'background-dark': '#0f172a',
        card: '#ffffff',
        'border-color': '#e2e8f0',
        'lms-orange': '#ff9f43',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};