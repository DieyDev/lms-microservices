import type { CourseDto } from '../services/api';

/**
 * Từ quá chung trong tiếng Việt — nếu dùng để “cộng điểm” từng từ sẽ khiến
 * mục tiêu kiểu “Machine learning cơ bản” khớp nhầm sang “Lập trình web cơ bản”
 * vì cả hai đều có “cơ bản”.
 */
const VN_STOPWORDS = new Set([
  'cơ',
  'bản',
  'các',
  'cho',
  'và',
  'với',
  'những',
  'để',
  'trong',
  'một',
  'của',
  'cùng',
  'này',
  'đó',
  'the',
  'for',
  'and',
  'with',
]);

function courseBlob(c: CourseDto): string {
  return `${c.title} ${c.category} ${c.description} ${c.level}`.toLowerCase();
}

/**
 * Điểm khớp mục tiêu — ưu tiên cụm có nghĩa + từ không quá chung.
 */
function scoreGoalAgainstCourse(goal: string, c: CourseDto): number {
  const q = goal.trim().toLowerCase();
  const blob = courseBlob(c);
  if (!q) return 0;

  let s = 0;
  if (blob.includes(q)) s += 24;

  // Cụm trong mục tiêu → khớp trong khóa (trọng số cao hơn từng từ rời)
  const phraseWeights: Array<[RegExp, RegExp, number]> = [
    [/machine learning|học máy|deep learning/i, /machine learning|học máy|deep learning|neural|tensorflow|pytorch|scikit|keras|mô hình/i, 18],
    [/lập trình web|web development|frontend|backend/i, /lập trình web|web development|html|css|javascript|react|node/i, 16],
    [/react|typescript/i, /react|typescript|next\.js|nextjs/i, 14],
    [/python/i, /python|django|fastapi|flask/i, 12],
    [/docker|devops/i, /docker|devops|kubernetes|ci\/cd|jenkins/i, 14],
    [/phân tích dữ liệu|data analysis|data science/i, /phân tích|data|pandas|numpy|sql|tableau|power bi/i, 16],
    [/an toàn|bảo mật|cybersecurity|infosec/i, /an toàn|bảo mật|owasp|penetration|mạng|security/i, 16],
  ];

  for (const [goalRe, blobRe, w] of phraseWeights) {
    if (goalRe.test(q) && blobRe.test(blob)) s += w;
  }

  const words = q
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 2 && !VN_STOPWORDS.has(w));

  for (const w of words) {
    if (blob.includes(w)) s += 2;
  }

  return s;
}

/**
 * Tìm khóa trong catalog (title/category/description) khớp mục tiêu người dùng nhập.
 * Dùng cho lộ trình AI: gửi `goal_course_id` thật thay vì chỉ `goal_text` (CSV AI thiếu title).
 */
export function findCourseIdMatchingGoal(goal: string, courses: CourseDto[]): string | undefined {
  const q = goal.trim().toLowerCase();
  if (!q || !courses.length) return undefined;

  for (const c of courses) {
    const title = (c.title || '').toLowerCase();
    const cat = (c.category || '').toLowerCase();
    const desc = (c.description || '').toLowerCase();
    const level = (c.level || '').toLowerCase();
    if (title.includes(q) || cat.includes(q) || desc.includes(q) || level.includes(q)) {
      return c.id;
    }
  }

  let best: { id: string; score: number } | undefined;
  for (const c of courses) {
    const score = scoreGoalAgainstCourse(goal, c);
    if (score > 0 && (!best || score > best.score)) {
      best = { id: c.id, score };
    }
  }
  return best?.id;
}

/** Sắp xếp khóa theo độ khớp mục tiêu — dùng khi gợi ý AI fallback catalog. */
export function rankCoursesByGoal(goal: string, courses: CourseDto[]): CourseDto[] {
  const q = goal.trim().toLowerCase();
  if (!q || !courses.length) return [...courses];

  return [...courses].sort((a, b) => scoreGoalAgainstCourse(goal, b) - scoreGoalAgainstCourse(goal, a));
}
