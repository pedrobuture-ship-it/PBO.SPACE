import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Brand } from '@/components/common/brand'
import { DoodleStar, SketchUnderline } from '@/components/common/sketch'
export function AuthFlowShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.02fr)_minmax(0,.98fr)]">
    <aside className="relative hidden min-w-0 overflow-hidden border-r border-border bg-sidebar p-10 lg:flex lg:flex-col xl:p-14"><div className="absolute inset-0 highlight-panel opacity-50" /><div className="relative"><Brand /></div><div className="relative my-auto min-w-0"><div className="mb-6 text-[10px] font-bold uppercase tracking-[.25em] text-cyan">HANDCRAFTED DIGITAL WORKSPACE</div><h1 className="relative inline-block max-w-full text-4xl font-semibold leading-tight tracking-[-.06em] xl:text-5xl">Seu espaço continua aqui.<SketchUnderline className="absolute -bottom-3 left-0 h-2 w-40 text-primary/60" /></h1><p className="mt-7 max-w-md text-muted-foreground">Mais clareza para transformar ideias em trabalho bem feito.</p><DoodleStar className="mt-12 size-8 text-cyan/60" /></div></aside>
    <main className="flex min-h-svh min-w-0 flex-col bg-background px-6 py-8 sm:px-12 lg:px-16 xl:px-24"><div className="lg:hidden"><Brand /></div><div className="mx-auto my-auto w-full max-w-[420px] py-10 sm:py-16"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.24em] text-primary">{eyebrow}</p><h2 className="text-3xl font-semibold leading-tight tracking-[-.045em] sm:text-4xl">{title}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p><div className="mt-9">{children}</div><Link to="/login" className="mt-7 inline-flex text-sm text-primary hover:underline">Voltar ao login</Link></div></main>
  </div>
}
