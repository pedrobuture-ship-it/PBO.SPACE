import { FieldError } from '@/components/ui/field-message'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateTask } from '../hooks/use-task-mutations'
import { taskSchema, type TaskValues } from '@/schemas/task'

export function CreateTaskDialog({ boardId, columnId, disabled = false, compact = false }: { boardId: string; columnId: string; disabled?: boolean; compact?: boolean }) {
  if (compact) return <QuickCreate boardId={boardId} columnId={columnId} disabled={disabled} />
  return <FullCreate boardId={boardId} columnId={columnId} disabled={disabled} />
}

function QuickCreate({ boardId, columnId, disabled }: { boardId: string; columnId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const mutation = useCreateTask(boardId)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = taskSchema.safeParse({ title, priority: 'none' })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Informe um título válido.'); return }
    try { await mutation.mutateAsync({ boardId, columnId, ...parsed.data }); toast.success('Tarefa adicionada.'); setTitle(''); setError(''); setOpen(false) }
    catch { toast.error('Não foi possível criar a tarefa.') }
  }
  if (!open) return <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(true)} className="w-full justify-start text-muted-foreground"><Plus className="size-4" /> Adicionar tarefa</Button>
  return <form onSubmit={submit} className="space-y-2"><Input autoFocus value={title} onChange={event => { setTitle(event.target.value); setError('') }} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); setTitle('') } }} placeholder="Título da tarefa" aria-label="Título da nova tarefa" aria-invalid={Boolean(error)} maxLength={160} />{error && <FieldError className="text-xs text-destructive">{error}</FieldError>}<div className="flex gap-2"><Button size="sm" type="submit" loading={mutation.isPending}>Adicionar</Button><Button size="sm" variant="ghost" type="button" onClick={() => { setOpen(false); setTitle(''); setError('') }}>Cancelar</Button></div></form>
}

function FullCreate({ boardId, columnId, disabled }: { boardId: string; columnId: string; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const mutation = useCreateTask(boardId)
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<TaskValues>({ resolver: zodResolver(taskSchema), defaultValues: { title: '', priority: 'medium' } })
  async function submit(values: TaskValues) {
    try {
      await mutation.mutateAsync({ boardId, columnId, ...values })
      toast.success('Tarefa adicionada.')
      setOpen(false)
      reset()
    } catch { toast.error('Não foi possível adicionar a tarefa. Confira suas permissões e tente novamente.') }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={disabled}><Plus className="size-4" /> Nova tarefa</Button></DialogTrigger><DialogContent className="sm:max-w-[450px]"><DialogHeader><DialogTitle>Nova tarefa</DialogTitle><DialogDescription>Defina o próximo passo do projeto.</DialogDescription></DialogHeader><form onSubmit={handleSubmit(submit)} className="space-y-5 pt-3"><div className="space-y-2"><Label htmlFor="task-title">O que precisa ser feito?</Label><Input id="task-title" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "task-title-error" : undefined} autoFocus placeholder="Ex.: Revisar a página inicial" {...register('title')} />{errors.title && <FieldError id="task-title-error" className="text-xs text-destructive">{errors.title.message}</FieldError>}</div><div className="space-y-2"><Label htmlFor="task-priority">Prioridade</Label><Select defaultValue="medium" onValueChange={value => setValue('priority', value as TaskValues['priority'])}><SelectTrigger id="task-priority" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem prioridade</SelectItem><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="urgent">Urgente</SelectItem></SelectContent></Select></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={mutation.isPending}>{mutation.isPending ? 'Salvando...' : 'Adicionar tarefa'}</Button></div></form></DialogContent></Dialog>
}
