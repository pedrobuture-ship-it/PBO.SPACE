import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { cardVariants, staggerVariants, useMotionTransition } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function MotionGroup({ children, className, ...props }: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotion()
  return <motion.div className={className} variants={reduced ? undefined : staggerVariants} initial={reduced ? false : 'hidden'} animate="visible" {...props}>{children}</motion.div>
}

export function MotionCard({ children, className, ...props }: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotion()
  const transition = useMotionTransition()
  return <motion.div className={cn('workspace-card', className)} variants={reduced ? undefined : cardVariants} whileHover={reduced ? undefined : { y: -2 }} transition={transition} {...props}>{children}</motion.div>
}

export function MotionPage({ children, className, ...props }: HTMLMotionProps<'div'>) {
  const reduced = useReducedMotion()
  const transition = useMotionTransition(.14)
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -4, transition: { duration: .12 } }} transition={transition} {...props}>{children}</motion.div>
}
