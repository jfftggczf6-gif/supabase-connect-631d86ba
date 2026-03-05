import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';

export default function EsonoLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = {
    sm: { box: 'h-8 w-8', text: 'text-sm', label: 'text-xs' },
    md: { box: 'h-10 w-10', text: 'text-base', label: 'text-sm' },
    lg: { box: 'h-12 w-12', text: 'text-lg', label: 'text-base' },
  };
  const s = sizeMap[size];

  return (
    <div className="flex items-center gap-2">
      <div className={`${s.box} rounded-lg bg-primary flex items-center justify-center`}>
        <span className={`${s.text} font-display font-bold text-primary-foreground`}>ES</span>
      </div>
    </div>
  );
}
