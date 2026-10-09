import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useColumnMutations } from '../hooks/use-columns'
import type { BoardColumn } from '@/types/domain'

const schema = z.object({ name: z.string().trim().min(1, 'Informe o nome da coluna.').max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), wip: z.string().refine(value => !value || (/^[1-9]\d*$/.test(value) && Number(value) <= 999), 'Informe um limite entre 1 e 999.') })
type Values = z.infer<typeof schema>
const colors = ['#69dff1', '#4c8dff', '#8bd49c', '#efc56c', '#ec829a', '#ad93ef']
export function ColumnDialog({ boardId, column, open: controlledOpen, onOpenChange }: { boardId: string; column?: BoardColumn; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (value: boolean) => { setInternalOpen(value); onOpenChange?.(value) }
  const mutation = useColumnMutations(boardId)
  const { register, handleSubmit, setValue, control, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), values: { name: column?.name ?? '', color: column?.color ?? colors[0], wip: column?.wip_limit?.toString() ?? '' } })
  const color = useWatch({ control, name: 'color' })
  async function submit(values: Values) {
    try {
      if (column) await mutation.update.mutateAsync({ id: column.id, name: values.name, color: values.color, wip_limit: values.wip ? Number(values.wip) : null })
      else await mutation.create.mutateAsync({ name: values.name, color: values.color, wipLimit: values.wip ? Number(values.wip) : undefined })
      toast.success(column ? 'Coluna atualizada.' : 'Coluna criada.')
      setOpen(false); reset()
    } catch { toast.error('Não foi possível salvar a coluna. Confira suas permissões.') }
  }
  return <Dialog open={open} onOpenChange={setOpen}>{!column && <DialogTrigger asChild><Button variant="outline" className="h-11 w-72 shrink-0 justify-start border-dashed border-primary/30 bg-card/40 text-muted-foreground"><Plus className="size-4" /> Nova coluna</Button></DialogTrigger>}<DialogContent className="sm:max-w-[420px]"><DialogHeader><DialogTitle>{column ? 'Editar coluna' : 'Nova coluna'}</DialogTitle><DialogDescription>Organize uma etapa do fluxo de trabalho.</DialogDescription></DialogHeader><form onSubmit={handleSubmit(submit)} className="space-y-5 pt-2"><div className="space-y-2"><Label htmlFor="column-name">Nome</Label><Input id="column-name" autoFocus {...register('name')} aria-invalid={Boolean(errors.name)} />{errors.name && <p role="alert" className="text-xs text-destructive">{errors.name.message}</p>}</div><div className="space-y-2"><Label>Cor</Label><div className="flex gap-2">{colors.map(value => <button type="button" key={value} onClick={() => setValue('color', value)} aria-label={`Cor ${value}`} aria-pressed={color === value} className={`size-8 rounded-full border-2 border-background ${color === value ? 'ring-2 ring-primary' : ''}`} style={{ background: value }} />)}</div></div><div className="space-y-2"><Label htmlFor="column-wip">WIP Limit <span className="text-muted-foreground">(opcional)</span></Label><Input id="column-wip" inputMode="numeric" placeholder="Ex.: 5" {...register('wip')} />{errors.wip && <p role="alert" className="text-xs text-destructive">{errors.wip.message}</p>}</div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar coluna'}</Button></div></form></DialogContent></Dialog>
}
