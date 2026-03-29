import type { CourseDto, CourseProgressResponse } from '../services/api';

export type CourseWithProgress = { course: CourseDto; progress: CourseProgressResponse };

const pct = (p: CourseProgressResponse) => p.progressPercentage ?? 0;

const updatedMs = (p: CourseProgressResponse) =>
  new Date(p.updatedAt || 0).getTime();

/**
 * Chọn khóa phù hợp cho "Học tiếp" / widget tiến độ:
 * 1) Ưu tiên khóa chưa xong có 0% < tiến độ < 100% (mới học dở), lấy cập nhật gần nhất
 * 2) Nếu không có: khóa chưa xong còn 0% (mới ghi danh / chưa bắt đầu), lấy cập nhật gần nhất
 * 3) Nếu mọi khóa đều 100%: lấy khóa có updatedAt mới nhất (vừa hoàn thành)
 */
export function pickContinueLearningEntry(
  entries: CourseWithProgress[]
): CourseWithProgress | null {
  if (!entries.length) return null;

  const incomplete = entries.filter((e) => pct(e.progress) < 100);
  if (incomplete.length === 0) {
    return [...entries].sort((a, b) => updatedMs(b.progress) - updatedMs(a.progress))[0] ?? null;
  }

  const inProgress = incomplete.filter((e) => {
    const p = pct(e.progress);
    return p > 0 && p < 100;
  });
  if (inProgress.length > 0) {
    return [...inProgress].sort((a, b) => updatedMs(b.progress) - updatedMs(a.progress))[0]!;
  }

  return [...incomplete].sort((a, b) => updatedMs(b.progress) - updatedMs(a.progress))[0]!;
}
