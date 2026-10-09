import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMotionTransition } from '@/lib/motion'

const AccordionContext = React.createContext('')
const ItemContext = React.createContext('')
type SingleAccordionProps = Extract<React.ComponentProps<typeof AccordionPrimitive.Root>, { type: 'single' }>

function Accordion({ value, defaultValue = '', onValueChange, ...props }: SingleAccordionProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = value ?? internalValue
  return <AccordionContext.Provider value={currentValue}><AccordionPrimitive.Root {...props} value={currentValue} onValueChange={(next: string) => { setInternalValue(next); onValueChange?.(next) }} /></AccordionContext.Provider>
}

function AccordionItem({ className, value, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <ItemContext.Provider value={value}><AccordionPrimitive.Item value={value} data-slot="accordion-item" className={cn('border-b border-border last:border-b-0', className)} {...props} /></ItemContext.Provider>
}

function AccordionTrigger({ children, className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  const open = React.useContext(AccordionContext) === React.useContext(ItemContext)
  const transition = useMotionTransition(.18)
  return <AccordionPrimitive.Header><AccordionPrimitive.Trigger data-slot="accordion-trigger" className={cn('flex min-h-12 w-full items-center justify-between gap-4 rounded-md py-3 text-left text-sm font-medium hover:text-cyan', className)} {...props}>{children}<motion.span aria-hidden="true" animate={{ rotate: open ? 180 : 0 }} transition={transition}><ChevronDown className="size-4 text-muted-foreground" /></motion.span></AccordionPrimitive.Trigger></AccordionPrimitive.Header>
}

function AccordionContent({ children, className, ...props }: Omit<React.ComponentProps<typeof AccordionPrimitive.Content>, 'asChild' | 'forceMount'>) {
  const open = React.useContext(AccordionContext) === React.useContext(ItemContext)
  const reduced = useReducedMotion()
  const transition = useMotionTransition(.18)
  return <AnimatePresence initial={false}>{open && <AccordionPrimitive.Content key="content" forceMount asChild {...props}><motion.div data-slot="accordion-content" initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={transition} className="overflow-hidden"><div className={cn('pb-4 text-sm leading-relaxed text-muted-foreground', className)}>{children}</div></motion.div></AccordionPrimitive.Content>}</AnimatePresence>
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
