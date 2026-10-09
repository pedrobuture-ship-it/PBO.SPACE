import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

type SketchProps = SVGProps<SVGSVGElement>
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const, focusable: false }

export function SketchArrow({ className, ...props }: SketchProps) {
  return <svg {...base} viewBox="0 0 100 48" className={cn('sketch size-14', className)} {...props}><path d="M5 38C25 40 33 20 53 22c14 1 22 6 36-13M73 9l17-2-1 16" /><path d="M6 42c10 0 17-5 22-11" opacity=".3" /></svg>
}

export function SketchUnderline({ className, ...props }: SketchProps) {
  return <svg {...base} preserveAspectRatio="none" viewBox="0 0 200 12" className={cn('sketch h-2 w-full', className)} {...props}><path d="M3 7c42-6 76 2 113-1 28-2 53-4 81-1" /><path d="M12 10c53-3 92 0 154-3" opacity=".25" /></svg>
}

export function SketchCircle({ className, ...props }: SketchProps) {
  return <svg {...base} viewBox="0 0 120 90" className={cn('sketch h-20 w-28', className)} {...props}><path d="M102 18C79-1 25 4 11 30-5 59 18 80 57 81c37 0 62-17 53-42C99 10 61 3 31 13" /><path d="M95 75c-14 11-50 12-68 2" opacity=".3" /></svg>
}

export function SketchSpark({ className, ...props }: SketchProps) {
  return <svg {...base} viewBox="0 0 40 40" className={cn('sketch size-8', className)} {...props}><path d="m20 4 2 11 12-3-8 9 10 6-13-1-3 11-3-12-12 4 8-9-7-6 11 2Z" /></svg>
}

export function SketchDivider({ className, ...props }: SketchProps) {
  return <svg {...base} preserveAspectRatio="none" viewBox="0 0 240 6" className={cn('sketch h-1 w-full', className)} {...props}><path d="m2 3 60-1 55 2 68-1 53 1" strokeWidth="1" /></svg>
}

export function SketchCross({ className, ...props }: SketchProps) {
  return <svg {...base} viewBox="0 0 24 24" className={cn('sketch size-5', className)} {...props}><path d="M6 5c5 5 8 8 13 14M18 5 5 18" /></svg>
}

export function SketchConnector({ className, ...props }: SketchProps) {
  return <svg {...base} viewBox="0 0 100 60" className={cn('sketch h-10 w-16', className)} {...props}><path d="M7 8c19-2 20 44 43 43 18 0 26-17 42-17M84 28l10 5-7 8" strokeDasharray="3 5" /></svg>
}

export function SketchCorner({ className, ...props }: SketchProps) {
  return <svg {...base} viewBox="0 0 36 36" className={cn('sketch size-8', className)} {...props}><path d="M6 29 5 7c9-1 17 0 25-1M10 25l-1-14 16-1" opacity=".7" /></svg>
}

// Compatibility names keep existing screens using the same centralized SVGs.
export function HandDrawnArrow(props: SketchProps) { return <SketchArrow {...props} /> }
export function DoodleCircle(props: SketchProps) { return <SketchCircle {...props} /> }
export function DoodleStar(props: SketchProps) { return <SketchSpark {...props} /> }
