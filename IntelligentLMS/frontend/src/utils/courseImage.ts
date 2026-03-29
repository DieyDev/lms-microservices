import type { CourseDetailDto, CourseDto } from '../services/api';

/** Ảnh bìa khóa: ưu tiên URL do admin cấu hình, không thì ảnh mặc định theo từ khóa */
export function resolveCourseThumbnail(
  course: Pick<CourseDto, 'thumbnailUrl' | 'category' | 'title'> | CourseDetailDto
): string {
  const custom = course.thumbnailUrl?.trim();
  if (custom) return custom;

  const key = (course.category || course.title || '').toLowerCase();

  if (key.includes('jwt') || key.includes('auth')) {
    return 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1200&q=80';
  }
  if (key.includes('postgres') || key.includes('database')) {
    return 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80';
  }
  if (key.includes('kafka') || key.includes('event')) {
    return 'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?auto=format&fit=crop&w=1200&q=80';
  }
  if (key.includes('react') || key.includes('frontend')) {
    return 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80';
  }
  if (key.includes('microservices') || key.includes('.net')) {
    return 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80';
  }

  return 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80';
}
