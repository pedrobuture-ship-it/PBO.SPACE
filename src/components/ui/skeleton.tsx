import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotion()
  return <motion.div aria-hidden="true" data-slot="skeleton" className={cn('rounded-lg bg-muted', className)} animate={reduced ? { opacity: .8 } : { opacity: [.6, .9, .6] }} transition={{ duration: 1.4, repeat: reduced ? 0 : Infinity, ease: 'easeInOut' }} {...props} />
}
export { Skeleton }
