import { requireSupabase } from '@/services/supabase/client'
export type { TaskAttachment } from '@/types/domain'
export async function listAttachments(taskId: string) {
  const { data, error } = await requireSupabase().from('attachments').select('*').eq('task_id', taskId).order('created_at')
  if (error) throw error
  return data
}
export async function uploadAttachment(input: { boardId: string; taskId: string; file: File }) {
  if (input.file.size > 10 * 1024 * 1024) throw new Error('O arquivo deve ter até 10 MB.')
  const allowed: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', pdf: 'application/pdf', txt: 'text/plain' }
  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = allowed[extension]
  if (!mime || input.file.type !== mime) throw new Error('Tipo de arquivo não permitido.')
  const header = new Uint8Array(await input.file.slice(0, 16).arrayBuffer())
  const ascii = String.fromCharCode(...header)
  const signatureValid = mime === 'image/jpeg' ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : mime === 'image/png' ? ascii.startsWith('\x89PNG\r\n\x1a\n')
    : mime === 'image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
    : mime === 'image/avif' ? ascii.slice(4, 12).includes('ftypavif') || ascii.slice(4, 16).includes('ftypavis')
    : mime === 'application/pdf' ? ascii.startsWith('%PDF-')
    : !header.some(byte => byte === 0)
  if (!signatureValid) throw new Error('O conteúdo do arquivo não corresponde ao formato informado.')
  const client = requireSupabase()
  const path = `${input.boardId}/${input.taskId}/${crypto.randomUUID()}`
  const { error: uploadError } = await client.storage.from('task-attachments').upload(path, input.file, { contentType: mime })
  if (uploadError) throw uploadError
  const { data, error } = await client.from('attachments').insert({ task_id: input.taskId, file_name: input.file.name, file_url: path, file_type: mime, file_size: input.file.size }).select().single()
  if (error) { await client.storage.from('task-attachments').remove([path]); throw error }
  return data
}
export async function getAttachmentUrl(path: string) {
  const { data, error } = await requireSupabase().storage.from('task-attachments').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}
export async function getAttachmentDownloadUrl(path: string, fileName: string) {
  const { data, error } = await requireSupabase().storage.from('task-attachments').createSignedUrl(path, 60, { download: fileName })
  if (error) throw error
  return data.signedUrl
}
export async function deleteAttachment(id: string) {
  const client = requireSupabase()
  const attachment = await client.from('attachments').select('file_url').eq('id', id).single()
  if (attachment.error) throw attachment.error
  const { error: storageError } = await client.storage.from('task-attachments').remove([attachment.data.file_url])
  if (storageError) throw storageError
  const { error } = await client.from('attachments').delete().eq('id', id)
  if (error) throw error
}
