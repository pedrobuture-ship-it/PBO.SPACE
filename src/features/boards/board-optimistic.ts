import type { QueryClient } from '@tanstack/react-query'
import type { BoardWithColumns } from '../../types/domain.ts'

export async function commitBoardMove(client: QueryClient, key: readonly unknown[], next: BoardWithColumns, persist: () => Promise<unknown>, refresh: () => Promise<unknown>, onRollback: (previous: BoardWithColumns) => void) {
  await client.cancelQueries({ queryKey: key })
  const previous = client.getQueryData<BoardWithColumns>(key)
  client.setQueryData(key, next)
  let saved = false
  try { await persist(); saved = true }
  catch {
    if (previous) { client.setQueryData(key, previous); onRollback(previous) }
  }
  await refresh()
  return saved
}
