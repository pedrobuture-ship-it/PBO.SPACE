import { CircleMinus, SignalHigh, SignalLow, SignalMedium } from 'lucide-react'

export const priorityConfig = {
  none: { label: 'Sem prioridade', color: 'var(--muted-foreground)', icon: CircleMinus },
  urgent: { label: 'Urgente', color: 'var(--urgency)', icon: SignalHigh },
  high: { label: 'Alta', color: 'var(--warning)', icon: SignalHigh },
  medium: { label: 'Média', color: 'var(--info)', icon: SignalMedium },
  low: { label: 'Baixa', color: 'var(--cyan)', icon: SignalLow },
}
