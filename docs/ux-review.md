# Revisão visual e UX — 9 de outubro de 2026

## Escopo

Refinamento da identidade Handcrafted Digital Workspace, com foco em consistência, densidade, responsividade e navegação por teclado. Nenhuma migration, dependência, policy RLS ou regra de permissões foi alterada. As páginas continuam usando os dados reais e os serviços existentes. O cadastro público permanece desativado na aplicação.

## Principais ajustes

- Controles compartilhados: alturas, foco, estados desabilitados e de carregamento; variantes semânticas; labels, ajuda e erros associados aos campos.
- Home: cinco indicadores em uma linha no desktop, cards mais compactos e skeletons que cabem no mobile.
- Kanban: barra horizontal próxima das colunas, região rolável por teclado, realce de foco, hover de 2px, estados vazios específicos para filtros e leitura, instruções e anúncios do arraste em português.
- Tarefa: cabeçalho fixo, rolagem apenas do conteúdo, seções com hierarquia clara, estados vazios compactos e fechamento sem a mensagem transitória de tarefa indisponível.
- Membros e Users: linhas adaptadas a cartões em telas menores, menus mais legíveis e ações preservadas.
- Analytics: cores de prioridade compartilhadas com as tarefas, legenda com valores, datas nos tooltips, duração em minutos/horas/dias, animações de 180ms e respeito ao movimento reduzido.
- Command Palette: largura de 720px no desktop, acesso mobile, foco explícito, seleção coerente entre Tab/setas/Enter, rolagem automática da seleção e resultados antigos indisponíveis durante uma nova busca. Os termos Home/Boards/Dashboard/Settings continuam reconhecidos como aliases de busca.
- Notificações: toolbar adaptável, título sem duplicação na página, ornamento SVG no estado vazio e animações reduzidas quando solicitado pelo sistema.
- SVGs centralizados: SketchArrow, SketchCircle, SketchUnderline, SketchSpark, SketchCross, SketchDivider, SketchConnector e SketchCorner.

## Verificação no navegador

Sessão autenticada fornecida pelo usuário, com workspace, quadro e tarefa reais. Não foram criados ou removidos registros, alteradas senhas, modificadas permissões ou enviadas mensagens/e-mails durante a revisão.

| Superfície | Verificação |
| --- | --- |
| Home | Dados reais, indicadores, cards, responsividade |
| Projetos | Lista real, modal Novo Quadro aberto e cancelado |
| Kanban | Colunas, filtros, rolagem local; arraste iniciado com Espaço e cancelado com Escape, sem persistir movimento |
| Task Drawer | Dados e seções reais, comentários/anexos vazios, histórico, fechamento, cabeçalho preservado ao rolar até o final |
| Membros do workspace | Lista, pesquisa sem resultados, menus, edição e criação abertas e canceladas |
| Membros do quadro | Lista e controles de cargos, modal em 360px, sem alteração de membros |
| Notificações | Página e drawer, conteúdo real, sem marcar como lida ou excluir |
| Analytics | Dados reais, filtros, período personalizado, gráficos e estados sem histórico suficiente |
| Settings | Perfil, tabs por teclado, acordeão e foco visível |
| Command Palette | Ctrl+K, busca por quadro/tarefa real, setas/Enter para abrir tarefa, Tab e Escape, acesso pelo botão mobile |
| Recuperação e nova senha | Formulários e responsividade; nenhum envio ou redefinição foi executado |
| Cadastro | `/register` redireciona sem mostrar formulário de cadastro |
| Administração global | `/admin/users` mostrou Acesso restrito para o cargo global user |

As larguras 1920, 1440, 1366, 1024, 768, 430, 390 e 360px foram verificadas nas telas protegidas principais, na Command Palette, no drawer de tarefa e nas páginas de recuperação. A rolagem horizontal ficou contida na região do Kanban, sem ampliar a largura da página. Alguns resultados de medida podem variar durante a animação de recolhimento da sidebar; as verificações finais dos modais foram feitas após estabilizar o layout.

Login foi inspecionado antes da autenticação e revisado no código. Cadastro não foi recriado. Admin e Users receberam revisão de código e dos componentes compartilhados, mas a inspeção manual do conteúdo dessas duas páginas permanece pendente: a sessão disponível tem app_role user. Nenhuma permissão global foi alterada para contornar o bloqueio.

## Acessibilidade e motion

Foco ciano visível em controles, menus, tabs e links; IDs das mensagens de erro associados aos campos dos formulários principais. Prioridades usam texto e ícone além de cor. A legenda das prioridades inclui quantidades. O movimento reduzido é tratado por MotionConfig, hooks Framer Motion, configurações Recharts e CSS; não foi possível alterar a preferência do sistema durante esta sessão, portanto essa parte foi verificada no código.

Contrastes calculados a partir dos tokens centrais:

| Combinação | Contraste |
| --- | --- |
| Texto principal / fundo | 17,53:1 |
| Texto secundário / card | 8,18:1 |
| Texto discreto / superfície elevada | 4,90:1 |
| Texto do botão primário / azul | 5,95:1 |
| Borda de campo / fundo | 3,27:1 |
| Urgência / card | 7,60:1 |

Isso valida essas combinações específicas, sem constituir certificação integral WCAG de todos os estados e cores personalizadas.

## Verificação técnica

- `npm run lint`: sem erros; quatro avisos preexistentes de Fast Refresh em arquivos que exportam componentes e helpers.
- `npx tsc -b --pretty false`: aprovado.
- `npm run build`: aprovado.
- Console da aba de revisão: sem mensagens warn/error capturadas na consulta realizada.

O design system atualizado está em `docs/design-system.md`.
