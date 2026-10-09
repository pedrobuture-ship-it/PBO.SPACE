import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatRelativeDate(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })
}
