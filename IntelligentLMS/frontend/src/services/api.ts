import axios from 'axios';

// 1. Định nghĩa cấu trúc dữ liệu cho User (Dữ liệu từ User Service)
export interface UserProfileResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
}

export interface CourseDto {
  id: string;
  title: string;
  description: string;
  level: string;
  category: string;
  instructorId: string;
  price: number;
  /** URL ảnh bìa (https hoặc data URL); để trống thì client dùng ảnh mặc định */
  thumbnailUrl?: string;
}

export interface LessonDto {
  id: string;
  courseId: string;
  title: string;
  content: string;
  order: number;
  contentUrl: string;
  contentType: string;
}

export interface CourseDetailDto extends CourseDto {
  lessons: LessonDto[];
}

export interface CourseUpsertRequest {
  title: string;
  description: string;
  level: string;
  category: string;
  price: number;
  thumbnailUrl?: string;
}

// 2. Định nghĩa cấu trúc dữ liệu cho Progress (Dữ liệu từ Progress Service)
export interface CourseProgressResponse {
  id: string;
  userId: string;
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  updatedAt: string;
  completedLessonIds?: string[];
}

// Cổng của Gateway trong Docker của bạn
const BASE_URL = 'http://localhost:5000'; 

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor xử lý Token tự động
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- AUTH API ---
export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  googleLogin: (data: { idToken: string }) => api.post('/auth/google-login', data),
  forgotPassword: (data: { email: string }) => api.post('/auth/forgot-password', data),
  resetPassword: (data: { email: string; otp: string; newPassword: string }) =>
    api.post('/auth/reset-password', data),
};

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isLocked: boolean;
  createdAt: string;
}

// --- ADMIN AUTH API (requires Admin JWT) ---
export const adminAuthApi = {
  listUsers: (role?: string) =>
    api.get<AdminUserRow[]>(`/auth/users${role ? `?role=${encodeURIComponent(role)}` : ''}`),
  createUser: (data: { email: string; fullName: string; role: string; password: string }) =>
    api.post<AdminUserRow>(`/auth/users`, data),
  updateUser: (id: string, data: { fullName?: string; role?: string; isLocked?: boolean }) =>
    api.put<AdminUserRow>(`/auth/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
};

// --- USER API ---
export const userApi = {
  getTeachers: () => api.get(`/auth/users?role=Teacher`),
  getProfile: (userId: string) => api.get(`/users/${userId}`),
  updateProfile: (userId: string, data: { fullName?: string; bio?: string; avatarUrl?: string | null; phoneNumber?: string }) =>
    api.put(`/users/${userId}`, {
      userId,
      fullName: data.fullName,
      bio: data.bio,
      // Gửi "" để xóa ảnh; bỏ qua field nếu undefined (backend giữ ảnh cũ)
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      phoneNumber: data.phoneNumber,
    }),
};

// --- COURSE & PROGRESS API ---
export const courseApi = {
  // Gateway: /courses/* -> course service /api/courses/*
  getCourses: () => api.get<CourseDto[]>(`/courses`),
  getMyCourses: () => api.get<CourseDto[]>(`/courses/me`),

  // Course detail + lessons (endpoint bổ sung ở Course service)
  getCourseDetail: (courseId: string) => api.get<CourseDetailDto>(`/courses/${courseId}/detail`),

  /**
   * Lấy tiến độ học tập từ Progress Service
   */
  getCourseProgress: async (userId: string, courseId: string): Promise<CourseProgressResponse> => {
    const response = await api.get<CourseProgressResponse>(`/progress/${userId}/${courseId}`);
    return response.data;
  },

  /**
   * Ghi danh khóa học (Progress Service)
   */
  enroll: (userId: string, courseId: string) =>
    api.post('/progress/enroll', { userId, courseId }),

  getEnrollments: (userId: string) =>
    api.get<Array<{ courseId: string; enrolledAt: string; status: string }>>(`/progress/enrollments/${userId}`),

  isEnrolled: async (userId: string, courseId: string): Promise<boolean> => {
    const res = await api.get<{ enrolled: boolean }>(`/progress/is-enrolled/${userId}/${courseId}`);
    return !!res.data?.enrolled;
  },

  /**
   * Đánh dấu bài học hoàn thành (Progress Service)
   */
  completeLesson: (data: { userId: string; courseId: string; lessonId: string }) =>
    api.post('/progress/complete', {
      userId: data.userId,
      lessonId: data.lessonId,
      courseId: data.courseId,
    }),
};

// --- PAYMENT API (VNPAY) ---
export const paymentApi = {
  createVnpayUrl: (courseId: string) =>
    api.post<{ paymentUrl: string; courseId: string }>('/payments/vnpay/create', { courseId }),
};

export const adminCourseApi = {
  createCourse: (data: CourseUpsertRequest) => api.post<CourseDto>('/courses', data),
  updateCourse: (id: string, data: CourseUpsertRequest) => api.put<CourseDto>(`/courses/${id}`, data),
  deleteCourse: (id: string) => api.delete(`/courses/${id}`),
};