import { useResource, useResourceMutation } from '@/hooks/use-resource'
import { addComment, deleteComment, listComments, updateComment } from '../services/comment-service'
export const useComments = (taskId: string) => useResource(['comments', taskId], () => listComments(taskId), Boolean(taskId))
export function useCommentMutations(taskId: string) {
  const keys = [['comments', taskId], ['notifications'], ['board-task-badges']] as const
  const add = useResourceMutation(({ content, mentionIds }: { content: string; mentionIds: string[] }) => addComment(taskId, content, mentionIds), keys)
  const update = useResourceMutation(({ id, content, mentionIds }: { id: string; content: string; mentionIds: string[] }) => updateComment(id, content, mentionIds), keys)
  const remove = useResourceMutation(deleteComment, keys)
  return { add, update, remove }
}
