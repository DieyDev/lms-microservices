import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface CourseCardProps {
  id: string;
  title: string;
  price: string;
  tag: string;
  author: string;
}

const CourseCard = ({ id, title, price, tag, author }: CourseCardProps) => {
  return (
    <Link to={`/user/course/${id}`}>
      <motion.div
        whileHover={{ y: -6 }}
        className="group cursor-pointer rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-soft transition-all hover:border-primary/25 hover:shadow-card"
      >
        <div className="relative mb-4 aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-100">
          <div className="absolute inset-0 bg-primary/0 transition-all group-hover:bg-primary/5" />
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <span className="material-symbols-outlined text-5xl">image</span>
          </div>
        </div>

        <div className="space-y-3">
          <span className="inline-block rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
            {tag}
          </span>
          <h3 className="line-clamp-2 font-bold text-slate-800 transition-colors group-hover:text-primary">
            {title}
          </h3>
          <p className="text-xs font-medium text-slate-500">Giảng viên: {author}</p>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm font-black text-primary">{price}</span>
            <span className="material-symbols-outlined text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary">
              arrow_forward
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default CourseCard;
