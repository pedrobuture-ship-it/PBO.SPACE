import { useReducedMotion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import { CheckCircle2, CircleAlert, Clock3, Layers3, Timer, TrendingUp } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeading } from '@/components/common/page-heading'
import { ErrorState } from '@/components/common/states'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-workspaces'
import { useAnalytics } from '@/features/dashboard/hooks/use-analytics'
import { listBoards } from '@/features/boards/services/board-service'
import { useResource } from '@/hooks/use-resource'
import { useWorkspaceDirectory } from '@/features/members/hooks/use-member-directory'
import { priorityConfig } from '@/features/tasks/priority'
import type { AnalyticsFilters } from '@/features/dashboard/services/analytics-service'

type RangePreset = '7' | '30' | '90' | 'custom'
const palette = ['var(--primary)', 'var(--cyan)', 'var(--info)', 'var(--success)', 'var(--warning)', 'var(--urgency)']
const priorityColors = Object.fromEntries(Object.entries(priorityConfig).map(([key, value]) => [key, value.color]))
const priorityNames = Object.fromEntries(Object.entries(priorityConfig).map(([key, value]) => [key, value.label]))
function elapsedTime(hours: number) {
  if (hours === 0) return '0 min'
  if (hours < 1 / 60) return '<1 min'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} d`
}
function comparisonText(current:number|undefined, previous:number|undefined) {
  if (current===undefined||previous===undefined) return null
  if (previous===0) return current===0 ? null : 'Sem base comparável no período anterior'
  const change=((current-previous)/previous)*100
  return `${change>0?'+':''}${change.toFixed(0)}% vs. período anterior`
}

function ChartTooltip({ active, payload, label, formatLabel }: { formatLabel?:(label:string|number)=>string; active?:boolean; payload?:{name?:string;value?:number;color?:string;payload?:{color?:string}}[]; label?:string|number }) {
  if (!active || !payload?.length) return null
  return <div className="min-w-32 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
    {label !== undefined && <div className="mb-1.5 font-medium text-foreground">{formatLabel ? formatLabel(label) : String(label)}</div>}
    {payload.map((item,index)=><div className="flex items-center justify-between gap-5 py-0.5 text-muted-foreground" key={`${item.name}-${index}`}>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{background:item.color ?? item.payload?.color ?? palette[index%palette.length]}}/>{item.name}</span>
      <strong className="font-semibold tabular-nums text-foreground">{item.name === 'Horas' ? elapsedTime(Number(item.value ?? 0)) : item.value ?? 0}</strong>
    </div>)}
  </div>
}

function Panel({ title, description, children, className=''}:{title:string;description?:string;children:React.ReactNode;className?:string}) {
  return <section className={`min-w-0 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5 ${className}`}>
    <div className="mb-4"><h2 className="text-sm font-semibold">{title}</h2>{description&&<p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
    {children}
  </section>
}

function EmptyChart({ children='Ainda não existem dados suficientes para este gráfico.' }:{children?:React.ReactNode}) {
  return <div className="grid h-[250px] place-items-center rounded-lg border border-dashed border-border px-5 text-center text-sm text-muted-foreground">{children}</div>
}

function ChartFrame({ children }:{children:React.ReactNode}) { return <div className="h-[250px] min-w-0 w-full">{children}</div> }

function dateBounds(preset:RangePreset, customFrom:string, customTo:string, today:Date) {
  if (preset==='custom') {
    const from=customFrom ? new Date(`${customFrom}T00:00:00`) : subDays(today,29)
    const to=customTo ? addDays(new Date(`${customTo}T00:00:00`),1) : addDays(today,1)
    return { from, to }
  }
  const days=Number(preset)
  return { from:subDays(today,days-1), to:addDays(today,1) }
}

export function DashboardPage() {
  const reduced = useReducedMotion()
  const chartMotion = { isAnimationActive: !reduced, animationDuration: 180 }
  const { workspace, isLoading:workspaceLoading, error:workspaceError, refetch:retryWorkspace }=useActiveWorkspace()
  const boardsQuery=useResource(['analytics-boards',workspace?.id],()=>listBoards(workspace!.id),Boolean(workspace?.id))
  const membersQuery=useWorkspaceDirectory(workspace?.id ?? '')
  const [boardSelection,setBoardSelection]=useState({workspaceId:'',value:'all'})
  const [assigneeSelection,setAssigneeSelection]=useState({workspaceId:'',value:'all'})
  const boardId=boardSelection.workspaceId===workspace?.id?boardSelection.value:'all'
  const assigneeId=assigneeSelection.workspaceId===workspace?.id?assigneeSelection.value:'all'
  const [priority,setPriority]=useState('all')
  const [preset,setPreset]=useState<RangePreset>('30')
  const [customFrom,setCustomFrom]=useState(()=>format(subDays(startOfDay(new Date()),29),'yyyy-MM-dd'))
  const [customTo,setCustomTo]=useState(()=>format(new Date(),'yyyy-MM-dd'))
  const [today] = useState(()=>startOfDay(new Date()))
  const bounds=dateBounds(preset,customFrom,customTo,today)
  const periodDays=(bounds.to.getTime()-bounds.from.getTime())/86_400_000
  const validPeriod=Number.isFinite(periodDays)&&periodDays>0&&periodDays<=366
  const selectedBoard=boardId!=='all'&&boardsQuery.data&&!boardsQuery.data.some(board=>board.id===boardId)?'all':boardId
  const selectedAssignee=assigneeId!=='all'&&membersQuery.data&&!membersQuery.data.some(member=>member.user_id===assigneeId)?'all':assigneeId
  const filters:AnalyticsFilters|null=workspace&&validPeriod ? ({
    workspaceId:workspace.id, boardId:selectedBoard==='all'?null:selectedBoard,
    from:bounds.from.toISOString(), to:bounds.to.toISOString(),
    assigneeId:selectedAssignee==='all'?null:selectedAssignee,
    priority:priority==='all'?null:priority as AnalyticsFilters['priority'],
  }):null
  const query=useAnalytics(filters)
  const data=query.data

  if (workspaceError) return <ErrorState message="Não foi possível carregar o workspace para Analytics." onRetry={()=>retryWorkspace()} />

  const periodLabel=preset==='custom' ? `${customFrom} – ${customTo}` : `Últimos ${preset} dias`
  const summary=data?.summary
  const metrics=[
    {label:'Total de tarefas',value:summary?.total,detail:summary?`${summary.created_in_period} criadas no período`:'No escopo atual',comparison:comparisonText(summary?.created_in_period,summary?.previous_created),icon:Layers3,color:'var(--primary)'},
    {label:'Em andamento',value:summary?.in_progress,detail:'Ainda não concluídas',icon:Clock3,color:'var(--cyan)'},
    {label:'Concluídas',value:summary?.completed,detail:`No período · ${periodLabel}`,comparison:comparisonText(summary?.completed,summary?.previous_completed),icon:CheckCircle2,color:'var(--success)'},
    {label:'Atrasadas',value:summary?.overdue,detail:'Em aberto após o prazo',icon:CircleAlert,color:'var(--urgency)'},
    {label:'Taxa de conclusão',value:summary?.completion_rate===null||summary?.completion_rate===undefined?'—':`${summary.completion_rate}%`,detail:'Concluídas / tarefas totais',icon:TrendingUp,color:'var(--info)'},
    {label:'Tempo médio',value:summary?.avg_completion_hours===null||summary?.avg_completion_hours===undefined?'—':elapsedTime(summary.avg_completion_hours),detail:'Criação até conclusão',icon:Timer,color:'var(--warning)'},
  ]

  return <div className="space-y-6">
    <PageHeading eyebrow="Panorama do trabalho" title="Analytics" description="Entenda o ritmo, os gargalos e a distribuição do trabalho no workspace." />

    <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card/70 p-3 sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr_1fr]">
      <label className="space-y-1 text-[11px] text-muted-foreground"><span>Workspace</span><div className="flex min-h-9 items-center rounded-lg border border-input px-2.5 text-xs text-foreground">{workspaceLoading?'Carregando…':workspace?.name ?? 'Workspace indisponível'}</div></label>
      <label className="space-y-1 text-[11px] text-muted-foreground"><span>Quadro</span><Select value={boardId} onValueChange={value=>setBoardSelection({workspaceId:workspace?.id??'',value})}><SelectTrigger aria-label="Quadro" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os quadros</SelectItem>{boardsQuery.data?.map(board=><SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>)}</SelectContent></Select></label>
      <label className="space-y-1 text-[11px] text-muted-foreground"><span>Período</span><Select value={preset} onValueChange={value=>setPreset(value as RangePreset)}><SelectTrigger aria-label="Período" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 dias</SelectItem><SelectItem value="30">30 dias</SelectItem><SelectItem value="90">90 dias</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent></Select></label>
      <label className="space-y-1 text-[11px] text-muted-foreground"><span>Responsável</span><Select value={assigneeId} onValueChange={value=>setAssigneeSelection({workspaceId:workspace?.id??'',value})}><SelectTrigger aria-label="Responsável" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as pessoas</SelectItem>{membersQuery.data?.map(member=><SelectItem key={member.user_id} value={member.user_id}>{member.display_name || member.email || 'Membro'}</SelectItem>)}</SelectContent></Select></label>
      <label className="space-y-1 text-[11px] text-muted-foreground"><span>Prioridade</span><Select value={priority} onValueChange={setPriority}><SelectTrigger aria-label="Prioridade" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{Object.entries(priorityNames).map(([value,name])=><SelectItem key={value} value={value}>{name}</SelectItem>)}</SelectContent></Select></label>
      {preset==='custom'&&<div className="col-span-full flex flex-wrap items-center gap-2 pt-1"><label className="text-[11px] text-muted-foreground">De <Input aria-label="Data inicial" type="date" value={customFrom} onChange={event=>setCustomFrom(event.target.value)} className="mt-1 w-full sm:mt-0 sm:ml-2 sm:w-auto" /></label><label className="text-[11px] text-muted-foreground">Até <Input aria-label="Data final" type="date" value={customTo} onChange={event=>setCustomTo(event.target.value)} className="mt-1 w-full sm:mt-0 sm:ml-2 sm:w-auto" /></label></div>}
    </div>

    {!validPeriod&&<div role="alert" className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted-foreground">Escolha uma data final posterior à inicial e um intervalo de até 366 dias.</div>}
    {(boardsQuery.isError || membersQuery.isError) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm"><span className="text-muted-foreground">Algumas opções de filtro não puderam ser carregadas.</span><Button variant="outline" size="sm" onClick={()=>{void boardsQuery.refetch();void membersQuery.refetch()}}>Tentar novamente</Button></div>}

    {query.isError ? <ErrorState message="Não foi possível carregar as métricas de Analytics." onRetry={()=>query.refetch()} /> : <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map(item=><article key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{item.label}</span><item.icon aria-hidden="true" className="size-4" style={{color:item.color}} /></div>
          {query.isLoading||workspaceLoading?<Skeleton className="mt-4 h-8 w-20"/>:<div className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{item.value ?? '—'}</div>}
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.detail}</p>{'comparison' in item&&item.comparison&&<p className="mt-1 truncate text-[10px] text-cyan">{item.comparison}</p>}
        </article>)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Tarefas por status" description="Distribuição atual nas colunas acessíveis.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.status.length?<ChartFrame><ResponsiveContainer><BarChart accessibilityLayer data={data.status} margin={{top:8,right:8,left:-22,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="name" tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar {...chartMotion} dataKey="value" name="Tarefas" radius={[5,5,0,0]} maxBarSize={46}>{data.status.map((item,index)=><Cell key={item.id} fill={item.color||palette[index%palette.length]}/>)}</Bar></BarChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Tarefas por prioridade" description="Carga atual separada pela prioridade definida.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.priority.length?<ChartFrame><ResponsiveContainer><PieChart><Pie {...chartMotion} data={data.priority.map(item=>({...item,name:priorityNames[item.name??'']??item.name}))} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} >{data.priority.map(item=><Cell key={item.name} fill={priorityColors[item.name ?? 'none']}/>)}</Pie><Tooltip content={<ChartTooltip/>}/><Legend formatter={(name,entry)=>`${name}: ${entry.payload && 'value' in entry.payload ? entry.payload.value : ''}`} wrapperStyle={{fontSize:11,color:'var(--muted-foreground)'}}/></PieChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Criadas × concluídas" description="Movimentação diária durante o período selecionado.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.trend.length?<ChartFrame><ResponsiveContainer><LineChart accessibilityLayer data={data.trend} margin={{top:8,right:8,left:-22,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="date" tickFormatter={value=>format(new Date(value),'dd/MM')} minTickGap={25} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip formatLabel={value=>format(new Date(String(value)),'dd/MM/yyyy')}/>} /><Legend wrapperStyle={{fontSize:11}}/><Line {...chartMotion} type="monotone" dataKey="created" name="Criadas" stroke="var(--primary)" strokeWidth={2} dot={false}/><Line {...chartMotion} type="monotone" dataKey="completed" name="Concluídas" stroke="var(--success)" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Conclusões por período" description="Entregas concluídas em cada dia.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.trend.some(item=>(item.completed??0)>0)?<ChartFrame><ResponsiveContainer><BarChart accessibilityLayer data={data.trend} margin={{top:8,right:8,left:-22,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="date" tickFormatter={value=>format(new Date(value),'dd/MM')} minTickGap={25} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip formatLabel={value=>format(new Date(String(value)),'dd/MM/yyyy')}/>} /><Bar {...chartMotion} dataKey="completed" name="Concluídas" fill="var(--success)" radius={[4,4,0,0]} maxBarSize={24}/></BarChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Carga por responsável" description="Tarefas em aberto atribuídas a cada pessoa.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.workload.length?<ChartFrame><ResponsiveContainer><BarChart accessibilityLayer data={data.workload} layout="vertical" margin={{top:4,right:10,left:8,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={90} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar {...chartMotion} dataKey="value" name="Em aberto" fill="var(--cyan)" radius={[0,4,4,0]} maxBarSize={20}/></BarChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Atrasadas por responsável" description="Tarefas vencidas que permanecem abertas.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.overdue_by_assignee.length?<ChartFrame><ResponsiveContainer><BarChart accessibilityLayer data={data.overdue_by_assignee} layout="vertical" margin={{top:4,right:10,left:8,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={90} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar {...chartMotion} dataKey="value" name="Atrasadas" fill="var(--urgency)" radius={[0,4,4,0]} maxBarSize={20}/></BarChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Throughput semanal" description="Tarefas concluídas por semana; mede entregas, não estimativas.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.throughput.length?<ChartFrame><ResponsiveContainer><BarChart accessibilityLayer data={data.throughput} margin={{top:8,right:8,left:-22,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="week" tickFormatter={value=>format(new Date(value),'dd/MM')} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip formatLabel={value=>`Semana de ${format(new Date(String(value)),'dd/MM/yyyy')}`}/>} /><Bar {...chartMotion} dataKey="value" name="Concluídas" fill="var(--primary)" radius={[4,4,0,0]} maxBarSize={36}/></BarChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Tempo médio por coluna" description="Tempo observado nas movimentações registradas.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.column_time.some(item=>(item.observations??0)>0)?<ChartFrame><ResponsiveContainer><BarChart accessibilityLayer data={data.column_time.filter(item=>(item.observations??0)>0)} layout="vertical" margin={{top:4,right:10,left:8,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={value=>elapsedTime(Number(value))}/><YAxis type="category" dataKey="name" width={90} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>} formatter={(value)=>[`${Number(value).toFixed(1)} horas`,'Tempo médio']}/><Bar {...chartMotion} dataKey="avg_hours" name="Horas" fill="var(--info)" radius={[0,4,4,0]} maxBarSize={20}/></BarChart></ResponsiveContainer></ChartFrame>:<EmptyChart>Ainda não há movimentações suficientes para medir o tempo por coluna.</EmptyChart>}</Panel>

        <Panel title="Distribuição por labels" description="Tarefas associadas às labels mais usadas.">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.labels.length?<ChartFrame><ResponsiveContainer><BarChart accessibilityLayer data={data.labels} layout="vertical" margin={{top:4,right:10,left:8,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={90} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar {...chartMotion} dataKey="value" name="Tarefas" radius={[0,4,4,0]} maxBarSize={18}>{data.labels.map((item,index)=><Cell key={item.id} fill={item.color||palette[index%palette.length]}/>)}</Bar></BarChart></ResponsiveContainer></ChartFrame>:<EmptyChart/>}</Panel>

        <Panel title="Fluxo cumulativo" description={data?.history_started_at?`Histórico disponível a partir de ${format(new Date(data.history_started_at),'dd/MM/yyyy')}.`:'Histórico ainda não disponível.'} className="xl:col-span-2">{query.isLoading?<Skeleton className="h-[250px]"/>:data?.cumulative_flow_available&&data.cumulative_flow.length?<ChartFrame><ResponsiveContainer><AreaChart accessibilityLayer data={(()=>{const byDate=new Map<string,Record<string,string|number>>();for(const point of data.cumulative_flow){const day=point.date!;byDate.set(day,{...byDate.get(day),date:day,[point.column_id!]:point.value})}return [...byDate.values()]})()} margin={{top:8,right:8,left:-22,bottom:0}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="date" tickFormatter={value=>format(new Date(value),'dd/MM')} minTickGap={25} tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip formatLabel={value=>format(new Date(String(value)),'dd/MM/yyyy')}/>}/><Legend wrapperStyle={{fontSize:11}}/>{[...new Map(data.cumulative_flow.map(item=>[item.column_id,{id:item.column_id,name:item.name,color:item.color}])).values()].map((column,index)=><Area key={column.id} type="monotone" dataKey={column.id!} name={column.name!} stackId="flow" stroke={column.color||palette[index%palette.length]} fill={column.color||palette[index%palette.length]} fillOpacity={0.45} isAnimationActive={false}/>)}</AreaChart></ResponsiveContainer></ChartFrame>:<EmptyChart>O fluxo cumulativo ficará disponível quando a janela selecionada estiver coberta pelo histórico de status coletado.</EmptyChart>}</Panel>
      </div>
    </>}
  </div>
}
