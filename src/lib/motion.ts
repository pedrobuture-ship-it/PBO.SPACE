import { useReducedMotion, type Transition, type Variants } from 'framer-motion'

export const motionTiming = { fast: .14, base: .18, slow: .24 } as const
export const motionEase = [.22, 1, .36, 1] as const

export function useMotionTransition(duration: number = motionTiming.base): Transition {
  const reduced = useReducedMotion()
  return { duration: reduced ? 0 : duration, ease: motionEase }
}

export const staggerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: .035 } },
}

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: motionTiming.base, ease: motionEase } },
}
