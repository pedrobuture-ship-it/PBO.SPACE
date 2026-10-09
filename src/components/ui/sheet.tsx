import { motion, useReducedMotion } from "framer-motion"
import { useMotionTransition } from "@/lib/motion"
import * as React from "react"
import { cn } from "cn"
import { Dialog as SheetPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

const MotionOverlay = motion.create(SheetPrimitive.Overlay)
const MotionContent = motion.create(SheetPrimitive.Content)

const OpenContext = React.createContext(false)

function Sheet({ open, defaultOpen = false, onOpenChange, ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const currentOpen = open ?? internalOpen
  return <OpenContext.Provider value={currentOpen}><SheetPrimitive.Root {...props} open={currentOpen} onOpenChange={value => { setInternalOpen(value); onOpenChange?.(value) }} /></OpenContext.Provider>
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SheetPrimitive.Overlay>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart">) {
  const reduced = useReducedMotion()
  const transition = useMotionTransition(.18)
  const open = React.useContext(OpenContext)
  return (
    <MotionOverlay
        initial={reduced ? false : { opacity: 0 }}
        animate={open ? { opacity: 1 } : { opacity: 0 }}
        transition={transition}
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-(--overlay) duration-100 supports-backdrop-filter:backdrop-blur-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: Omit<React.ComponentProps<typeof SheetPrimitive.Content>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  const reduced = useReducedMotion()
  const transition = useMotionTransition(.24)
  const open = React.useContext(OpenContext)
  return (
    <SheetPortal>
      <SheetOverlay />
      <MotionContent
        initial={reduced ? false : { opacity: 0, x: side === "left" ? -32 : side === "right" ? 32 : 0, y: side === "top" ? -32 : side === "bottom" ? 32 : 0 }}
        animate={open ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: side === "left" ? -32 : side === "right" ? 32 : 0, y: side === "top" ? -32 : side === "bottom" ? 32 : 0 }}
        transition={transition}
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg outline-none",
          { top: "inset-x-0 top-0 h-auto border-b", bottom: "inset-x-0 bottom-0 h-auto border-t", left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm", right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm" }[side],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Fechar</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </MotionContent>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
