import { useResource, useResourceMutation } from '@/hooks/use-resource'
import { deleteAttachment, listAttachments, uploadAttachment } from '../services/attachment-service'
export const useAttachments = (taskId: string) => useResource(['attachments', taskId], () => listAttachments(taskId), Boolean(taskId))
export function useAttachmentMutations(boardId: string, taskId: string) {
  const keys = [['attachments', taskId], ['board-task-badges']] as const
  const upload = useResourceMutation((file: File) => uploadAttachment({ boardId, taskId, file }), keys)
  const remove = useResourceMutation(deleteAttachment, keys)
  return { upload, remove }
}
