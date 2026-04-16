export type Lang = 'vi' | 'en';

export type TranslationKey =
  | 'common.search'
  | 'common.searchPlaceholder'
  | 'common.login'
  | 'common.logout'
  | 'common.notifications'
  | 'common.language'
  | 'sidebar.home'
  | 'sidebar.courses'
  | 'sidebar.roadmap'
  | 'sidebar.ai'
  | 'sidebar.hof'
  | 'sidebar.profile'
  | 'auth.login'
  | 'auth.register'
  | 'auth.fullName'
  | 'auth.email'
  | 'auth.password'
  | 'auth.forgotPassword'
  | 'auth.loginNow'
  | 'auth.createAccount'
  | 'auth.orContinueWith'
  | 'auth.googleFailed'
  | 'auth.registerSuccess'
  | 'auth.systemError';

export const translations: Record<Lang, Record<TranslationKey, string>> = {
  vi: {
    'common.search': 'Tìm',
    'common.searchPlaceholder': 'Tìm khóa theo tên, danh mục… (Enter)',
    'common.login': 'Đăng nhập',
    'common.logout': 'Đăng xuất',
    'common.notifications': 'Thông báo',
    'common.language': 'Ngôn ngữ',

    'sidebar.home': 'Trang chủ',
    'sidebar.courses': 'Khóa học',
    'sidebar.roadmap': 'Lộ trình',
    'sidebar.ai': 'AI (cá nhân hóa)',
    'sidebar.hof': 'Bảng vàng',
    'sidebar.profile': 'Cá nhân',

    'auth.login': 'Đăng nhập',
    'auth.register': 'Đăng ký',
    'auth.fullName': 'Họ và tên',
    'auth.email': 'Email',
    'auth.password': 'Mật khẩu',
    'auth.forgotPassword': 'Quên mật khẩu?',
    'auth.loginNow': 'Đăng nhập ngay',
    'auth.createAccount': 'Tạo tài khoản mới',
    'auth.orContinueWith': 'Hoặc tiếp tục với',
    'auth.googleFailed': 'Đăng nhập Google thất bại',
    'auth.registerSuccess': 'Đăng ký tài khoản thành công! Bây giờ bạn có thể đăng nhập.',
    'auth.systemError': 'Lỗi hệ thống! Vui lòng kiểm tra Docker Auth-Service.',
  },
  en: {
    'common.search': 'Search',
    'common.searchPlaceholder': 'Search courses by name, category… (Enter)',
    'common.login': 'Login',
    'common.logout': 'Logout',
    'common.notifications': 'Notifications',
    'common.language': 'Language',

    'sidebar.home': 'Home',
    'sidebar.courses': 'Courses',
    'sidebar.roadmap': 'Roadmap',
    'sidebar.ai': 'AI (personalized)',
    'sidebar.hof': 'Hall of Fame',
    'sidebar.profile': 'Profile',

    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.fullName': 'Full name',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot password?',
    'auth.loginNow': 'Login now',
    'auth.createAccount': 'Create new account',
    'auth.orContinueWith': 'Or continue with',
    'auth.googleFailed': 'Google login failed',
    'auth.registerSuccess': 'Account created successfully! You can login now.',
    'auth.systemError': 'System error! Please check Docker Auth-Service.',
  },
};

