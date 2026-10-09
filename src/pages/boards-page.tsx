import { MotionGroup } from '@/components/common/motion'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeading } from '@/components/common/page-heading'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Input } from '@/components/ui/input'
import { BoardCard } from '@/features/boards/components/board-card'
import { CreateBoardDialog } from '@/features/boards/components/create-board-dialog'
import { useBoards } from '@/features/boards/hooks/use-boards'
import { useUiStore } from '@/stores/ui-store'

export function BoardsPage() {

  const { data, isLoading, error, refetch } = useBoards()
  const search = useUiStore(s => s.boardSearch)
  const setSearch = useUiStore(s => s.setBoardSearch)
  const boards = (data ?? []).filter(board => `${board.name} ${board.description}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <PageHeading eyebrow="Seu acervo" title="Projetos" description="Cada grande entrega começa com um espaço para pensar." action={<CreateBoardDialog />} />
    <div className="mb-6 flex items-center justify-between gap-3"><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar projetos" placeholder="Buscar projetos..." className="h-10 bg-card pl-10" /></div><span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5" /> {boards.length} projetos</span></div>
    {error && <ErrorState message="Não foi possível carregar os projetos." onRetry={() => refetch()} />}
    {isLoading && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-[190px] rounded-xl" />)}</div>}
    {!isLoading && !error && (boards.length ? <MotionGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{boards.map((board, index) => <BoardCard key={board.id} board={board} index={index} />)}</MotionGroup> : <EmptyState title={search ? 'Nenhum projeto encontrado' : 'Seu espaço está pronto'} description={search ? 'Tente buscar por outro nome.' : 'Crie seu primeiro projeto para começar a organizar o trabalho.'} />)}
  </>
}
