import { FieldError } from '@/components/ui/field-message'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { useUiStore } from '@/stores/ui-store'
import { useCreateBoard } from '../hooks/use-boards'
import { boardSchema, type BoardValues } from '@/schemas/board'
import { BoardStyleFields } from './board-style-fields'
import { boardColors } from '../board-style'

type CreateBoardDialogProps = { open?: boolean; onOpenChange?: (open: boolean) => void; showTrigger?: boolean }

export function CreateBoardDialog({ open: controlledOpen, onOpenChange, showTrigger = true }: CreateBoardDialogProps) {
  const navigate = useNavigate()
  const mutation = useCreateBoard()
  const { data: workspaces, workspace } = useActiveWorkspace()
  const setActiveWorkspaceId = useUiStore(state => state.setActiveWorkspaceId)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (value: boolean) => { if (controlledOpen === undefined) setInternalOpen(value); onOpenChange?.(value) }
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(workspace?.id)
  const [openAfter, setOpenAfter] = useState(false)
  const eligible = workspaces?.filter(item => item.access_role === 'owner' || item.access_role === 'admin') ?? []
  const selected = eligible.find(item => item.id === (workspaceId ?? workspace?.id))
  const { register, handleSubmit, setValue, control, reset, formState: { errors } } = useForm<BoardValues>({ resolver: zodResolver(boardSchema), defaultValues: { name: '', description: '', icon: 'layers', color: boardColors[0] } })
  const color = useWatch({ control, name: 'color' })
  const icon = useWatch({ control, name: 'icon' })
  async function submit(values: BoardValues) {
    if (!selected) { toast.error('Selecione um workspace em que você pode criar quadros.'); return }
    try {
      const board = await mutation.mutateAsync({ values, workspaceId: selected.id })
      setActiveWorkspaceId(selected.id)
      toast.success('Quadro criado com sucesso.')
      setOpen(false); reset()
      if (openAfter) navigate(`/app/board/${board.id}`)
    } catch { toast.error('Não foi possível criar o quadro. Confira suas permissões e tente novamente.') }
  }
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) setWorkspaceId(workspace?.id) }}>{showTrigger && <DialogTrigger asChild><Button disabled={eligible.length === 0}><Plus className="size-4" /> Novo Quadro</Button></DialogTrigger>}<DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-[510px]"><DialogHeader><DialogTitle className="text-xl">Novo Quadro</DialogTitle><DialogDescription>Defina um espaço claro para o próximo trabalho da equipe.</DialogDescription></DialogHeader><form onSubmit={handleSubmit(submit)} className="space-y-5 pt-2"><div className="space-y-2"><Label htmlFor="board-workspace">Workspace</Label><Select value={selected?.id} onValueChange={setWorkspaceId}><SelectTrigger id="board-workspace" className="h-10 w-full"><SelectValue placeholder="Selecione um workspace" /></SelectTrigger><SelectContent>{eligible.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="board-name">Nome</Label><Input id="board-name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'board-name-error' : undefined} placeholder="Ex.: Lançamento do produto" {...register('name')} />{errors.name && <FieldError id="board-name-error" className="text-xs text-destructive">{errors.name.message}</FieldError>}</div><div className="space-y-2"><Label htmlFor="board-description">Descrição <span className="text-muted-foreground">(opcional)</span></Label><Textarea id="board-description" placeholder="Qual é o foco deste quadro?" {...register('description')} />{errors.description && <FieldError className="text-xs text-destructive">{errors.description.message}</FieldError>}</div><BoardStyleFields color={color} icon={icon} onColor={value => setValue('color', value)} onIcon={value => setValue('icon', value)} /><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={openAfter} onChange={event => setOpenAfter(event.target.checked)} className="accent-primary" />Abrir quadro após criar</label><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={mutation.isPending} disabled={!selected}>{mutation.isPending ? 'Criando...' : 'Criar quadro'}</Button></div></form></DialogContent></Dialog>
}
