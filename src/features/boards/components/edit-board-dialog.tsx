import { FieldError } from '@/components/ui/field-message'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { boardSchema, type BoardValues } from '@/schemas/board'
import { updateBoard } from '../services/board-service'
import { useQueryClient } from '@tanstack/react-query'
import type { HomeBoard } from '../services/home-service'
import { BoardStyleFields } from './board-style-fields'
import { boardIcons } from '../board-style'

export function EditBoardDialog({ board, open, onOpenChange, mode = 'edit' }: { board: Pick<HomeBoard, 'id' | 'name' | 'description' | 'color' | 'icon'>; open: boolean; onOpenChange: (open: boolean) => void; mode?: 'edit' | 'settings' }) {
  const client = useQueryClient()
  const { register, handleSubmit, setValue, control, reset, formState: { errors, isSubmitting } } = useForm<BoardValues>({ resolver: zodResolver(boardSchema), defaultValues: { name: board.name, description: board.description ?? '', color: board.color, icon: board.icon in boardIcons ? board.icon as BoardValues['icon'] : 'layers' } })
  useEffect(() => { if (open) reset({ name: board.name, description: board.description ?? '', color: board.color, icon: board.icon in boardIcons ? board.icon as BoardValues['icon'] : 'layers' }) }, [board, open, reset])
  const color = useWatch({ control, name: 'color' })
  const icon = useWatch({ control, name: 'icon' })
  async function submit(values: BoardValues) {
    try {
      await updateBoard(board.id, { name: values.name, description: values.description || null, icon: values.icon, color: values.color })
      await Promise.all([client.invalidateQueries({ queryKey: ['home-overview'] }), client.invalidateQueries({ queryKey: ['boards'] }), client.invalidateQueries({ queryKey: ['board', board.id] })])
      toast.success('Quadro atualizado.'); onOpenChange(false)
    } catch { toast.error('Não foi possível atualizar o quadro. Confira suas permissões e tente novamente.') }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-[510px]"><DialogHeader><DialogTitle>{mode === 'settings' ? 'Configurações do quadro' : 'Editar quadro'}</DialogTitle><DialogDescription>Atualize a identidade e a descrição do quadro.</DialogDescription></DialogHeader><form onSubmit={handleSubmit(submit)} className="space-y-5 pt-2"><div className="space-y-2"><Label htmlFor="edit-board-name">Nome</Label><Input id="edit-board-name" aria-describedby={errors.name ? "edit-board-name-error" : undefined} {...register('name')} aria-invalid={Boolean(errors.name)} />{errors.name && <FieldError id="edit-board-name-error" className="text-xs text-destructive">{errors.name.message}</FieldError>}</div><div className="space-y-2"><Label htmlFor="edit-board-description">Descrição</Label><Textarea id="edit-board-description" {...register('description')} />{errors.description && <FieldError className="text-xs text-destructive">{errors.description.message}</FieldError>}</div><BoardStyleFields color={color} icon={icon} onColor={value => setValue('color', value)} onIcon={value => setValue('icon', value)} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" loading={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar alterações'}</Button></div></form></DialogContent></Dialog>
}
