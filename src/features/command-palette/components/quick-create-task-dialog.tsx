import { FieldError } from '@/components/ui/field-message'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/features/auth/auth-context'
import { useCreateTask } from '@/features/tasks/hooks/use-task-mutations'
import { taskSchema, type TaskValues } from '@/schemas/task'
import { useUiStore } from '@/stores/ui-store'
import { listBoardColumns, listCreatableBoards } from '../services/global-search-service'

export function QuickCreateTaskDialog({ open, onOpenChange, currentBoardId }: { open: boolean; onOpenChange: (open: boolean) => void; currentBoardId?: string }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const setActiveWorkspaceId = useUiStore(state => state.setActiveWorkspaceId)
  const [boardId, setBoardId] = useState('')
  const [columnId, setColumnId] = useState('')
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<TaskValues>({ resolver: zodResolver(taskSchema), defaultValues: { title: '', priority: 'medium' } })
  const boards = useQuery({ queryKey: ['command-creatable-boards', session?.user.id], queryFn: () => listCreatableBoards(session!.user.id), enabled: open && Boolean(session), staleTime: 0, gcTime: 0 })
  const selectedBoard = boards.data?.find(board => board.id === boardId) ?? boards.data?.find(board => board.id === currentBoardId) ?? boards.data?.[0]
  const selectedBoardId = selectedBoard?.id ?? ''
  const columns = useQuery({ queryKey: ['command-board-columns', selectedBoardId], queryFn: () => listBoardColumns(selectedBoardId), enabled: open && Boolean(selectedBoardId), staleTime: 0, gcTime: 0 })
  const selectedColumn = columns.data?.find(column => column.id === columnId) ?? columns.data?.[0]
  const firstColumnId = selectedColumn?.id
  const mutation = useCreateTask(selectedBoardId)

  const noBoards = boards.isSuccess && boards.data.length === 0
  const columnsError = columns.isError

  async function submit(values: TaskValues) {
    if (!selectedBoard || !firstColumnId) return
    try {
      const task = await mutation.mutateAsync({ boardId: selectedBoard.id, columnId: firstColumnId, ...values })
      setActiveWorkspaceId(selectedBoard.workspaceId)
      toast.success('Tarefa criada.')
      onOpenChange(false)
      reset()
      navigate(`/app/board/${selectedBoard.id}?task=${task.id}`, { state: { taskDrawerOpened: true } })
    } catch {
      toast.error('Não foi possível criar a tarefa. Confira suas permissões e tente novamente.')
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100svh-1rem)] overflow-y-auto sm:max-w-[480px]"><DialogHeader><DialogTitle className="text-xl">Criar tarefa</DialogTitle><DialogDescription>Adicione o próximo passo a um quadro acessível.</DialogDescription></DialogHeader>
    {boards.isPending ? <p className="py-6 text-sm text-muted-foreground">Carregando seus quadros…</p> : boards.isError ? <div className="space-y-3 py-2"><FieldError className="text-sm text-muted-foreground">Não foi possível carregar seus quadros.</FieldError><Button variant="outline" onClick={() => void boards.refetch()}>Tentar novamente</Button></div> : noBoards ? <p className="py-5 text-sm text-muted-foreground">Você não tem quadros com permissão para criar tarefas.</p> : <form onSubmit={handleSubmit(submit)} className="space-y-5 pt-2">
      <div className="space-y-2"><Label htmlFor="quick-task-board">Quadro</Label><Select value={selectedBoardId} onValueChange={setBoardId}><SelectTrigger id="quick-task-board" className="w-full"><SelectValue placeholder="Selecione um quadro" /></SelectTrigger><SelectContent>{boards.data?.map(board => <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="quick-task-title">Tarefa</Label><Input id="quick-task-title" aria-describedby={errors.title ? "quick-task-title-error" : undefined} autoFocus placeholder="Ex.: Revisar a página inicial" maxLength={160} aria-invalid={Boolean(errors.title)} {...register('title')} />{errors.title && <FieldError id="quick-task-title-error" className="text-xs text-destructive">{errors.title.message}</FieldError>}</div>
      {columns.isSuccess && columns.data.length > 0 && <div className="space-y-2"><Label htmlFor="quick-task-column">Coluna</Label><Select value={selectedColumn?.id} onValueChange={setColumnId}><SelectTrigger id="quick-task-column" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{columns.data.map(column => <SelectItem key={column.id} value={column.id}>{column.name}</SelectItem>)}</SelectContent></Select></div>}
      <div className="space-y-2"><Label htmlFor="quick-task-priority">Prioridade</Label><Select defaultValue="medium" onValueChange={value => setValue('priority', value as TaskValues['priority'])}><SelectTrigger id="quick-task-priority" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem prioridade</SelectItem><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="urgent">Urgente</SelectItem></SelectContent></Select></div>
      {columns.isPending && <p className="text-xs text-muted-foreground">Carregando colunas…</p>}{columnsError && <div className="flex items-center justify-between gap-2 text-xs text-destructive"><span>Não foi possível carregar as colunas.</span><Button type="button" variant="ghost" size="sm" onClick={() => void columns.refetch()}>Tentar novamente</Button></div>}{columns.isSuccess && columns.data.length === 0 && <p className="text-xs text-muted-foreground">Este quadro ainda não tem colunas.</p>}
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" loading={mutation.isPending} disabled={!selectedBoard || !firstColumnId || columnsError}>{mutation.isPending ? 'Criando…' : 'Criar tarefa'}</Button></div>
    </form>}
  </DialogContent></Dialog>
}
