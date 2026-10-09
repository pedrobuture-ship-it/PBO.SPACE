import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="field-description" className={cn('field-hint', className)} {...props} />
}

export function FieldError({ className, ...props }: ComponentProps<'p'>) {
  return <p role="alert" data-slot="field-error" className={cn('field-error', className)} {...props} />
}
