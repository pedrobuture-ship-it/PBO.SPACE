# Auditoria de prontidão para produção — 2026-10-09

## Escopo e evidência

Revisão de código de React, TanStack Query, Realtime, drag and drop, migrations, RLS, Storage, Auth, convites, Edge Functions, validação, logs e build. Os testes SQL rodam em PostgreSQL isolado (PGlite) com fixture dos namespaces Supabase; eles verificam as migrations do repositório, não provam que o projeto remoto já as recebeu. A sessão da aba de teste expirou e o usuário entrou novamente. Foram confirmados `/login`, redirecionamento de `/register`, recuperação, Home, board, Analytics, notificações, busca global, Configurações, proteção de `/admin` para `app_role=user`, refresh autenticado e Kanban a 390 px. Fluxos com duas contas e cargos globais elevados ainda exigem teste no ambiente implantado.

## Problemas encontrados e corrigidos

1. **Storage aceitava MIME arbitrário em anexos.** O React validava JPEG, PNG, WebP, AVIF, PDF e TXT, mas `task-attachments.allowed_mime_types` era `null`; uma chamada direta ao Storage contornava a lista. A migration `202610220001_attachment_mime_guard.sql` aplica a mesma lista no bucket. O limite de 10 MB e as policies de caminho/RLS já existiam. A configuração do bucket agora é assertada na suíte SQL. O MIME é declarado pelo cliente; detecção do conteúdo real e varredura antimalware exigem serviço externo se forem requisito de produção.
2. **Edge Functions administrativas sem quota própria.** `workspace-create-member` e `admin-reset-user-password` validavam JWT e cargo, mas podiam ser chamadas repetidamente pelo mesmo operador. A migration `202610230001_admin_action_rate_limit.sql` cria contador transacional privado com execução somente para `service_role`; as funções aplicam respectivamente 20 criações/hora e 5 redefinições/hora por operador. A tabela tem RLS sem policies de cliente. A suíte SQL verifica isolamento por operador e bloqueio após o limite.
3. **Corrida no bootstrap da sessão.** `getSession()` podia resolver depois de `onAuthStateChange` e restaurar uma sessão antiga na UI. `AuthProvider` ignora a resposta inicial se ocorreu um evento Auth mais recente.
4. **Callbacks de Realtime após desmontagem.** Handlers de board e notificações podiam invalidar cache depois do cleanup. Ambos agora checam a flag de descarte; os canais já eram removidos e o gate já segurava eventos durante o drag.
5. **Consulta e logs legados da Home.** Cada visita em desenvolvimento executava `home_overview` apenas para diagnóstico e imprimia IDs pessoais no console. Removidos; `home_boards` e `home_metrics` permanecem independentes. Erros de Analytics são registrados apenas em desenvolvimento.

## Revisão de controles existentes

- As 22 tabelas públicas verificadas pela suíte SQL têm RLS; foram exercitados isolamento entre workspaces/boards, `owner/admin/member/viewer`, cargos globais, autoria, notificações, convites inválidos/expirados, vínculos cruzados, Storage e realtime. Grants de coluna impedem `profiles.app_role`, `notifications.content` e autoria por `UPDATE` do cliente. A suíte local não equivale a um pentest no projeto Supabase remoto.
- Funções administrativas usam `auth.getUser(token)`, consultam `profiles` e papéis no servidor e não enviam `service_role` ao React. `workspace-update-member` chama RPC com JWT do ator para revalidar permissão no banco. O cargo global não é editável pelo frontend.
- Board usa posições fracionárias numéricas e RPCs serializadas por advisory lock; teste cobre reorder, movimento entre colunas, rollback de cache e gate de Realtime. Pointer, touch, teclado e corrida entre duas sessões ainda requerem execução manual autenticada.
- Analytics usa RPC agregada e índices dedicados; não baixa todas as tarefas para somar no browser. Rotas são carregadas sob demanda. Nenhum `dangerouslySetInnerHTML` foi encontrado em `src`; textos são renderizados pelo React. O frontend usa somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; `.env.local` é ignorado pelo Git.

## Verificações executadas

- `npm run db:test`: **109** verificações passaram.
- `npm run auth:test`, `home:test`, `board:test`, `members:test`, `workspace-member:test`, `admin-password:test`, `notifications:test`: passaram (**220** verificações adicionais).
- `deno check` nas quatro Edge Functions: passou.
- `npm run lint`: zero erros; quatro avisos existentes de `react(only-export-components)` relacionados a Fast Refresh.
- `npx tsc -b` e `npm run build`: passaram.
- Navegação real: login do usuário seguido de `/app`, board, `/app/dashboard`, central de notificações, busca global, `/app/settings`, refresh autenticado e bloqueio de `/admin` para usuário comum. `/register` redireciona para `/login`; recuperação permanece acessível. Kanban inspecionado a 390 px; nenhuma falha de console apareceu nesse percurso. Admin/superadmin, drag touch/teclado e fluxos multiusuário não foram retestados ao vivo.

## Configuração externa e riscos residuais

1. Aplicar as migrations **202610220001** e **202610230001** no projeto Supabase antes de implantar as Edge Functions atualizadas. Confirmar bucket e RPC/quota no banco remoto; os testes locais não verificam o deploy.
2. Publicar novamente `workspace-create-member` e `admin-reset-user-password` com JWT verification habilitada e secrets somente no ambiente Edge. Confirmar Auth public signup desabilitado, URLs de redirect, domínio e SMTP para recuperação de senha.
3. Configurar/verificar execução agendada de `process_overdue_notifications`; nenhuma execução automática foi afirmada nesta auditoria.
4. Executar QA autenticado com contas `user`, `admin`, `superadmin`, duas sessões simultâneas e dispositivos touch/teclado. Medir consultas com `EXPLAIN (ANALYZE, BUFFERS)` no banco real e volume representativo antes de declarar metas de desempenho.
5. Definir rotina de retenção para `kanban_private.admin_action_quota` e limpeza de objetos Storage órfãos quando uma tarefa é apagada por cascade. Atualmente a FK remove metadados de anexos, mas isso não prova que o arquivo físico seja removido.
