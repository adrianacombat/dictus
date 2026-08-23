import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showWordmark?: boolean;
  /** Esconde o wordmark em telas pequenas (uso em headers compactos). */
  compact?: boolean;
}

const SIZES = {
  sm: { box: 'w-8 h-8', text: 'text-sm', wordmark: 'text-base' },
  md: { box: 'w-10 h-10', text: 'text-base', wordmark: 'text-xl' },
  lg: { box: 'w-14 h-14', text: 'text-xl', wordmark: 'text-2xl' },
};

/** Marca da plataforma — monograma "F" (Falari) em gradiente + wordmark. */
export function Logo({ size = 'md', className, showWordmark = true, compact = false }: LogoProps) {
  const s = SIZES[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shrink-0 shadow-sm',
          s.box,
        )}
      >
        <span className={cn('font-bold text-white', s.text)}>F</span>
      </div>
      {showWordmark && (
        <span className={cn('font-bold text-slate-900 tracking-tight', compact && 'hidden sm:block', s.wordmark)}>
          Falari
        </span>
      )}
    </div>
  );
}
