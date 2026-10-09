import { useResource, useResourceMutation } from '@/hooks/use-resource'
import { addDependency, listDependencies, removeDependency } from '../services/dependency-service'
export const useDependencies = (id: string) => useResource(['dependencies', id], () => listDependencies(id), Boolean(id))
export function useDependencyMutations(taskId: string) {
  const keys = [['dependencies', taskId]] as const
  const add = useResourceMutation((dependsOn: string) => addDependency(taskId, dependsOn), keys)
  const remove = useResourceMutation(removeDependency, keys)
  return { add, remove }
}
