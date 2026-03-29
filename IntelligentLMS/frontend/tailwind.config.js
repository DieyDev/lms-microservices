/** @type {import('tailwindcss').Config} */
export default {
  // 1. Ép web luôn ở chế độ sáng để không bị "đen thui" do cài đặt máy tính
  darkMode: false, 
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 2px 16px rgba(15, 23, 42, 0.06)",
        card: "0 8px 30px rgba(43, 124, 238, 0.08)",
        nav: "0 1px 0 rgba(15, 23, 42, 0.06)",
      },
      colors: {
        // 2. CHỈNH MÀU TÙY THÍCH Ở ĐÂY:
        "primary": "#2b7cee",      // Màu xanh thương hiệu chính
        "primary-hover": "#1e64d8", // Màu khi di chuột vào nút
        
        "sidebar": "#ffffff",      // Nền Sidebar (Chỉnh thành màu trắng cho sang)
        "sidebar-text": "#64748b", // Màu chữ xám nhẹ cho menu
        
        "background": "#f8fafc",   // Màu nền trang web (xám cực nhẹ)
        "card": "#ffffff",         // Màu nền của các ô khóa học
        
        "border-color": "#e2e8f0", // Màu của các đường kẻ ranh giới
        
        // Bạn có thể thêm màu mới tùy thích:
        "lms-orange": "#ff9f43", 
      },
      // 3. Thêm font chữ Inter cho giống bản thiết kế
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}