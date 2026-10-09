# Handcrafted Digital Workspace

Uma ferramenta profissional com hierarquia editorial, superfícies grafite e detalhes de desenho feitos com intenção.

## Tokens

A paleta, os raios, as sombras e os tempos CSS ficam em `src/styles/tokens.css`. O mapeamento para utilitários Tailwind fica em `src/index.css`. Nenhuma imagem externa é usada nos ornamentos.

| Uso | Token | Cor |
| --- | --- | --- |
| Fundo | `background` | `#080b10` |
| Sidebar | `sidebar` | `#0b0e14` |
| Cards | `card` | `#111620` |
| Superfície elevada | `surface-raised` | `#181e2a` |
| Hover | `surface-hover` | `#1b2331` |
| Texto | `foreground` | `#edf2fa` |
| Texto secundário | `muted-foreground` | `#a4afc1` |
| Ação principal | `primary` | `#4c8dff` |
| Destaque e foco | `cyan` / `ring` | `#69dff1` |
| Sucesso | `success` | `#51dba6` |
| Atenção | `warning` | `#f5cb66` |
| Urgência / erro | `urgency` / `destructive` | `#ff7fa3` |
| Informação | `info` | `#b49aff` |

As cores de quadros e colunas são atributos dos projetos e continuam vindo dos dados. Não representam a prioridade de uma tarefa. A prioridade combina uma cor semântica com ícone e texto.

## Tipografia e superfícies

Geist é a fonte da interface, incluindo formulários, tarefas, métricas e configurações. A classe `annotation` usa serif itálica apenas em pequenas notas decorativas. Hierarquia: títulos 24–30px (login até 36px), subtítulos 18–24px, corpo 13–14px, metadados 10–12px.

Cards usam raio de 10px, borda de 1px e sombras discretas. Cards interativos sobem 2px no hover, com realce de borda e glow leve. Modais e painéis maiores usam raio de 14px. Ícones de projeto usam o acento definido pelo usuário.

## Ornamentos

`src/components/common/sketch.tsx` oferece `SketchArrow`, `SketchCircle`, `SketchUnderline`, `SketchSpark`, `SketchCross`, `SketchDivider`, `SketchConnector` e `SketchCorner` (os nomes antigos continuam como aliases). Todos são SVG, herdam `currentColor`, são ignorados por leitores de tela e não interceptam cliques.

Use um detalhe pequeno por ponto de atenção: título, onboarding, estado vazio ou card editorial especial. Não aplique ornamentos às tarefas, campos de formulário ou a cada card de uma lista.

## Motion

`src/lib/motion.ts` centraliza os tempos Framer Motion e a curva de easing. `src/components/common/motion.tsx` oferece `MotionPage`, `MotionGroup` e `MotionCard`.

- Hover, press, menus, tooltips e abas: 140ms.
- Modal, accordion e cards: 180ms.
- Sidebar e drawer: 240ms. Gráficos: 180ms.
- Troca de página: saída de 120ms e entrada de 140ms.
- Stagger: intervalo de 35ms entre cards.
- Skeleton: variação suave de opacidade em 1,4s, sem deslocamento.

Os componentes Radix preservam foco, teclado, portais e semântica. Um keyframe neutro mantém o portal durante a saída; Framer Motion controla o fade e a transformação. O drag and drop mantém a transformação no elemento sortable externo; o hover anima o conteúdo interno.

`MotionConfig reducedMotion="user"`, `useReducedMotion` e a media query CSS respeitam `prefers-reduced-motion`. Nesse modo, deslocamentos, stagger e pulso do skeleton são removidos e as transições ficam imediatas.

## Responsividade e acessibilidade

Sidebar fixa e recolhível no desktop; menu em drawer abaixo de 1024px. Grids reduzem o número de colunas. O Kanban preserva a largura das colunas com rolagem horizontal local. O drawer de tarefa ocupa toda a largura no mobile.

Foco visível em ciano, link para saltar ao conteúdo, rótulos em controles de ícone, tooltips por teclado na sidebar recolhida, mensagens de erro associadas aos campos e estado selecionado nas cores de projeto. Prioridades e estados não dependem apenas de cor.

Verificação numérica dos tokens: texto principal tem contraste mínimo de 14:1 nas superfícies; texto secundário, 7:1; cores semânticas e azul primário, pelo menos 4,9:1. Botão primário: 5,95:1. Bordas decorativas são sutis; campos usam um token de borda mais forte.

A validação desta revisão está documentada em `docs/ux-review.md`. Esta revisão não substitui uma auditoria formal de acessibilidade.

## Controles e formulários

Botões: `default` (principal), `outline` (secundário neutro), `secondary` (acento ciano), `ghost`, `destructive`, `success` e `link`. Altura padrão de 36px; compactos de 32px; grandes de 44px. Controles principais sobem para 44px no mobile, com ações compactas de 36px. `loading` desabilita a ação, preserva o texto e anuncia `aria-busy`.

Inputs e Select usam borda `input`, fundo `background`, altura padrão de 36px e foco ciano. Labels têm 12px. `FieldHint` e `FieldError` padronizam textos de ajuda e validação; associe o ID da mensagem ao campo com `aria-describedby`.

Menus possuem largura mínima de 192px para evitar quebra desnecessária das ações. Modais limitam a altura à viewport e permitem rolagem; o drawer mantém o cabeçalho fixo e rola o conteúdo. Tabelas administrativas adaptam as mesmas informações e ações para cartões em telas menores.

`EmptyState`, `SectionEmptyState`, `ErrorState` e `Skeleton` centralizam ausência de dados, falhas e carregamento. Mensagens visíveis devem ser amigáveis, sem detalhes técnicos de PostgreSQL ou Supabase.
