import { Check, Layers3 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import type { BoardValues } from '@/schemas/board'
import { boardColors, boardIcons } from '../board-style'

export function BoardIcon({ name, className = 'size-5' }: { name: string; className?: string }) {
  const Icon = boardIcons[name as keyof typeof boardIcons] ?? Layers3
  return <Icon className={className} />
}
const iconNames: Record<string, string> = { layers: 'Camadas', layout: 'Painel', rocket: 'Foguete', sparkles: 'Destaque', target: 'Objetivo', lightbulb: 'Ideia' }
const colorNames = ['Azul', 'Ciano', 'Verde', 'Amarelo', 'Rosa', 'Roxo']

export function BoardStyleFields({ color, icon, onColor, onIcon }: { color: string; icon: string; onColor: (value: string) => void; onIcon: (value: BoardValues['icon']) => void }) {
  return <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Ícone</Label><div className="flex flex-wrap gap-2">{(Object.keys(boardIcons) as BoardValues['icon'][]).map(value => <button type="button" key={value} onClick={() => onIcon(value)} aria-label={`Ícone ${iconNames[value]}`} aria-pressed={icon === value} className={`grid size-9 place-items-center rounded-lg border transition-colors ${icon === value ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}><BoardIcon name={value} className="size-4" /></button>)}</div></div><div className="space-y-2"><Label>Cor</Label><div className="flex flex-wrap gap-2">{boardColors.map((value, index) => <button type="button" key={value} onClick={() => onColor(value)} aria-label={`Cor ${colorNames[index]}`} aria-pressed={color === value} className={`grid size-8 place-items-center rounded-full border-2 border-background transition-transform hover:scale-110 ${color === value ? 'ring-2 ring-primary' : ''}`} style={{ background: value }}>{color === value && <Check aria-hidden="true" className="size-4 text-background" />}</button>)}</div></div></div>
}
