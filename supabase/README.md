# Banco real do Handcrafted Digital Workspace

## Executar no seu projeto

1. Abra **Supabase → SQL Editor → New query**.
2. Cole todo o conteúdo de [`migrations/202610080001_kanban_data.sql`](migrations/202610080001_kanban_data.sql).
3. Execute **Run** como `postgres`. A migração contém uma transação: um erro cancela a aplicação inteira.
4. Configure em **Authentication → URL Configuration** o Site URL e as URLs de redirecionamento da aplicação, incluindo `http://localhost:5173` em desenvolvimento. Confirmação de e-mail segue a configuração de Auth do projeto.
5. Mantenha somente o schema `public` exposto pela Data API; **não exponha `kanban_private`**. Em Realtime Settings, desative canais públicos para esta aplicação: os hooks usam `config.private: true`.
6. Em Authentication, desative signups públicos. Provisione o owner inicial no Supabase; depois, owners/admins adicionam membros pela aplicação.
7. Reinicie o Vite se mudar `.env.local`, entre com uma conta autorizada e crie seu primeiro quadro.

Esta é uma migração **inicial**. Se qualquer tabela da aplicação já existir, ela aborta sem sobrescrever dados. O rascunho anterior foi preservado em `legacy/`, fora das migrations ativas. Não execute esse arquivo legado antes ou depois deste schema. Um projeto que já aplicou o rascunho exige uma migração de atualização específica para seus dados.

O arquivo `.env.local` fornece URL e chave pública para o cliente; não concede permissão para executar DDL. Esta entrega não aplica SQL ao projeto remoto. Não execute `tests/platform-fixture.sql` no Supabase: esse arquivo existe somente para a suíte local isolada.

## Modelo e integridade

As 18 tabelas solicitadas estão na migração, com UUIDs, chaves primárias/compostas, FKs, índices para relações e filtros, constraints de conteúdo e RLS. Há enums para os quatro papéis e as cinco prioridades.

- Auth provisiona `profiles` e um workspace pessoal vazio para cada usuário criado via Supabase Auth; na aplicação, novas contas são criadas somente por `workspace-create-member`. `app_role` sempre inicia como `user`, independentemente de metadados.
- Criar um workspace provisiona sua membership `owner`. Criar um quadro provisiona sua membership e quatro colunas padrão, sem tarefas de exemplo.
- `owner_id` e membership `owner` permanecem consistentes; a transferência exige a RPC `transfer_workspace_ownership`, executada pelo owner atual. Excluir uma conta proprietária exige antes transferir ou excluir seus workspaces.
- Um card só pode apontar para uma coluna do próprio quadro. Excluir uma coluna com tarefas é bloqueado: mova ou exclua suas tarefas primeiro. Exclusão de um board/workspace remove os recursos dependentes.
- Labels, assignees, checklist assignees e dependências são validados no banco. Dependências entre boards e ciclos são rejeitados.
- Campos de autor, timestamps, IDs e vínculos imutáveis são protegidos por grants de coluna e triggers. Alterar o payload no navegador não altera essas permissões.
- Autores apagados viram `NULL` quando possível, preservando conteúdo e histórico. A exclusão de um workspace remove seu histórico; apagar só o board preserva a auditoria do workspace com referências nulas.
- `completed_at` determina conclusão; nomes das colunas não inferem regras de negócio. `wip_limit` é configuração positiva opcional, sem bloquear movimentos nesta etapa.

## Permissões

| Papel efetivo | Leitura | Tarefas, checklists, labels, anexos e comentários | Board, colunas e membros do board | Workspace e membros do workspace |
| --- | --- | --- | --- | --- |
| owner/admin do workspace | Todos os seus boards | Sim | Sim | Sim |
| owner/admin do board | Apenas boards autorizados | Sim | Sim | Não |
| member | Apenas boards autorizados | Sim | Não | Não |
| viewer | Apenas boards autorizados | Não | Não | Não |

Members/viewers do workspace **precisam de membership explícita em cada board**. Owner/admin do workspace administram seus boards. Viewer do workspace limita o papel efetivo a viewer mesmo se sua membership do board disser admin.

Excluir definitivamente uma tarefa exige administração do board; members podem arquivá-la. Comentários só podem ser editados pelo autor; autor ou administrador pode removê-los. Remover anexos exige ser seu uploader ou administrador, além de poder editar a tarefa. Notificações são privadas ao destinatário e geradas pelo banco; o cliente só altera `read` ou remove suas próprias notificações. Activity logs são escritos pelo banco. Atualizar o próprio perfil e favoritos pessoais não concede escrita no conteúdo de um workspace a viewers.

## Ordenação e concorrência

`tasks.position` e `board_columns.position` usam `NUMERIC(38,18)`, inicialmente com intervalo 1024. As RPCs `create_task`/`create_column` acrescentam no final. `move_task`/`move_column` recebem IDs de vizinhos, calculam o ponto médio **no PostgreSQL** e bloqueiam a ordenação do board durante a transação.

Use `p_before_id` para o predecessor e `p_after_id` para o sucessor. Ambos ausentes significam acrescentar no final. Vizinhos inconsistentes são rejeitados com SQLSTATE `40001`: atualize o quadro e tente novamente. Quando a precisão fracionada esgota, somente a coluna afetada é rebalanceada; movimentos normais alteram uma única linha. Para desempate, consultas ordenam por `position, id`. Não calcule pontos médios em `number` JavaScript.

As RPCs de CRUD/ordenação usam `SECURITY INVOKER`, mantendo grants e RLS. A transferência de ownership e os helpers internos usam `SECURITY DEFINER` com `search_path` fixo e checagem explícita da identidade/escopo. Funções internas que aceitam outro usuário não são concedidas ao cliente.

## Storage

Ambos os buckets são privados:

- `avatars`: imagens JPEG/PNG/WebP/AVIF até 5 MB, caminho `user_id/uuid`. Upload e exclusão próprios; leitura própria ou entre usuários que compartilham workspace.
- `task-attachments`: arquivos até 10 MB, caminho `board_id/task_id/uuid`. Leitura conforme acesso à tarefa, upload conforme papel de edição e exclusão por uploader/admin.

`avatar_url` e `file_url` guardam **object keys**, não URLs públicas nem URLs temporárias. Os serviços geram signed URLs de 60 segundos sob as policies do Storage. Uma URL já assinada é um bearer token válido até expirar; não guarde essas URLs em tabelas.

Uploads usam `upsert: false`. Se a criação do metadata falhar, o serviço tenta remover o upload. Excluir uma tarefa/board elimina os metadados por cascade e bloqueia novas leituras do objeto, mas **não apaga seus bytes no Storage**. Limpeza de objetos órfãos exige rotina de servidor/Edge Function via Storage API; não apague linhas de `storage.objects` diretamente. Essa rotina de manutenção não está incluída nesta etapa.

## Realtime privado

Tasks, board_columns, comments e notifications possuem triggers de **Realtime Broadcast**:

- Board: `board:<boardId>:user:<userId>`.
- Inbox e alterações de membership: `notifications:<userId>`.
- Evento: `data-change`; payload contém IDs/tabela/operação, sem título, conteúdo de comentário ou arquivo.

O banco revalida destinatários em cada evento. Remover um membro interrompe novos eventos do board para ele; alterações de membership também invalidam seu cache pelo canal pessoal. A policy de `realtime.messages` limita recepção ao próprio tópico autorizado, sem permitir publicação pelo cliente. O layout mantém o canal pessoal ativo em todas as rotas.

Os hooks autenticam com a sessão, assinam canais privados, removem subscriptions ao sair e invalidam TanStack Query. Toda atualização de conteúdo passa por SELECT com RLS. O cache é separado por usuário e limpo ao trocar de identidade.

Não é necessário adicionar estas tabelas à publication `supabase_realtime`: esta implementação usa Broadcast em vez de Postgres Changes. Essa escolha evita eventos DELETE de Postgres Changes, que não aplicam RLS ([documentação oficial](https://supabase.com/docs/guides/realtime/postgres-changes)). Configuração dos canais privados: [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization).

## Tipos, serviços e verificação

`src/types/database.ts` é gerado dos catálogos PostgreSQL da migração. Inclui Row/Insert/Update, relações, enums e contratos das RPCs do projeto. O cliente usa `createClient<Database>`. `src/types/domain.ts` expõe aliases e modelos de leitura; serviços/hook por feature cobrem todas as entidades. Zustand mantém somente seleção e estado da interface. O aplicativo usa dados reais, sem sessão de demonstração ou fallback para fixtures.

```bash
npm run db:types
npm run db:test
npm run build
npm run lint
```

A suíte executa a **migração real em PostgreSQL via PGlite**, com usuários e papéis isolados. Ela testa policies/grants, relações, falsificação de autor, elevação de papéis, cascades, dependências circulares, ordenação/rebalanceamento e policies de Storage/Realtime. PGlite é dependência exclusivamente de desenvolvimento, nunca backend da aplicação.

O fixture de teste fornece os namespaces de plataforma Auth/Storage/Realtime. Portanto, estes testes validam o SQL e autorização, **não** chamadas HTTP de upload, envio de e-mails ou entrega WebSocket do Supabase hospedado. Verifique esses fluxos no projeto após executar a migração: dois usuários em boards distintos, um viewer, upload/download autorizado e duas sessões abertas recebendo mudanças. Nunca coloque `service_role`, senha do PostgreSQL ou connection string em variáveis `VITE_*`.

## Auth e administração global

Depois da migração inicial, execute [`migrations/202610090001_auth_admin.sql`](migrations/202610090001_auth_admin.sql) no SQL Editor. Ela preserva as 18 tabelas e os cargos de workspace/board; adiciona `profiles.app_role` (`superadmin`, `admin`, `user`) e `profiles.disabled_at`. O default é `user` inclusive para perfis antigos. O trigger de `auth.users` cria o profile com o mesmo UUID e aplica esse default. Não existe cadastro público: configure Supabase Auth para desabilitar novos signups e crie a conta inicial de owner pela administração do Supabase.

Para definir um admin global, atualize `profiles.app_role` manualmente **no SQL Editor do Supabase**, substituindo apenas o e-mail:

```sql
update public.profiles
set app_role = 'superadmin'
where id = (select id from auth.users where email = 'seu-email@dominio.com');
```

Confirme que uma linha foi atualizada. Não há credenciais ou usuários administrativos embutidos no repositório.

`/app` aceita qualquer usuário autenticado e ativo. `/admin` e `/admin/users` exigem `admin` ou `superadmin`; a RPC `admin_list_users` checa o cargo no banco antes de ler e-mail e status em `auth.users`. A migration [`migrations/202610210001_global_role_lockdown.sql`](migrations/202610210001_global_role_lockdown.sql) remove a RPC de promoção e revoga grants de alteração de `app_role` e `disabled_at` para clientes; apenas os campos públicos de perfil permitidos permanecem atualizáveis por `authenticated`. Alterações de cargo global são feitas manualmente pelo operador do banco. A gestão administrativa da aplicação limita-se a status e ações autorizadas de conta. Uma conta desativada é bloqueada por uma policy RLS restritiva nas tabelas colaborativas e nos buckets, mesmo com JWT ainda válido. Seu próprio profile permanece legível para exibir o motivo do bloqueio.

### Edge Functions

Implante `workspace-create-member`, `workspace-update-member`, `admin-update-user` e `admin-reset-user-password` com `verify_jwt = true`. A criação de conta pela aplicação ocorre somente em “Adicionar membro” de um workspace autorizado, pela Edge Function `workspace-create-member`; novas contas sempre recebem `app_role=user`. Ela confirma a sessão, valida a role do caller no workspace e usa a chave secreta somente no runtime da função. O React usa apenas a chave pública. Não há Edge Function administrativa global para criar usuários. `admin-update-user` coordena `disabled_at` e o banimento do Auth; redefinição de senha usa a função separada. As operações administrativas continuam validando permissões mesmo em chamadas HTTP diretas.

Configure o segredo `APP_SITE_URL` em **Edge Functions → Secrets** com a origem real da aplicação (por exemplo, `https://seu-dominio.com`, sem barra final). Também inclua `APP_SITE_URL/reset-password` e a URL de desenvolvimento `http://localhost:5173/reset-password` nas **Auth Redirect URLs**. A redefinição após convite e a recuperação usam `/reset-password`. O segredo/`service_role` nunca deve ser colocado em `.env.local` nem em `VITE_*`. O runtime Supabase já fornece `SUPABASE_URL`, as chaves publicáveis e as chaves secretas às Edge Functions. O envio de e-mails depende das configurações de Auth/SMTP e dos limites do projeto.

As URLs de recuperação devem ser permitidas no Supabase Auth; o navegador recebe o token temporário, troca a senha com `auth.updateUser` e volta ao login. Mensagens de erro da tela pública são traduzidas em linguagem amigável. A sessão persiste por configuração do Supabase JS e as rotas são revalidadas pela consulta do profile.

Verificação local adicional:

```bash
node scripts/test-auth-admin.mjs
npm run db:types
npm run db:test
npm run build
npm run lint
deno check supabase/functions/workspace-create-member/index.ts supabase/functions/admin-update-user/index.ts supabase/functions/admin-reset-user-password/index.ts
```

Os testes de Auth/Admin usam PostgreSQL isolado com papéis separados. Eles não implantam funções nem enviam e-mails no projeto remoto; execute as migrations e implante as funções antes de testar criação de membros e recuperação ponta a ponta. Depois das migrations anteriores, aplique também `migrations/202610210001_global_role_lockdown.sql` para remover a RPC de promoção e fechar os grants de `app_role`.

## Home do workspace

Depois de aplicar as migrations inicial e de Auth/admin, execute [`migrations/202610100001_home_overview.sql`](migrations/202610100001_home_overview.sql). Ela adiciona somente `workspaces.logo_url`, um índice para a contagem de conclusão e `public.home_overview(uuid)`. Não altera as migrations anteriores nem cria dados de exemplo.

O RPC usa a identidade do JWT e valida conta ativa, membership do workspace e papel efetivo em cada board antes de agregar. A resposta inclui apenas quadros acessíveis, indicadores de tarefas atribuídas ao usuário e até três avatares por board. `logo_url`, quando preenchido, guarda uma object key do bucket privado `avatars`; a Home assina a URL sob as policies existentes. O app não oferece upload de logo nesta etapa.

`npm run home:test` testa essa autorização e as contagens no PostgreSQL local. A migration precisa ser aplicada ao Supabase hospedado antes de usar a Home nova; `.env.local` não aplica schema automaticamente.

### Correção quando Auth/admin foi pulada

Se `kanban_private.account_active()` não existir ou `profiles.app_role`/`profiles.disabled_at` não existirem, aplique [`migrations/202610090001_auth_admin.sql`](migrations/202610090001_auth_admin.sql). Essa migration pode ser aplicada após as migrations 10–15: ela foi validada nessa ordem e restaura os controles de conta e as policies restritivas das tabelas base. Se as tabelas posteriores já existirem, aplique em seguida [`migrations/202610160001_auth_admin_late_tables.sql`](migrations/202610160001_auth_admin_late_tables.sql) para estender as mesmas policies a subtarefas, menções e convites. Isso mantém RLS ativa.

Se a API retornar `PGRST202` para `board_task_badges`, aplique [`migrations/202610110001_board_task_badges.sql`](migrations/202610110001_board_task_badges.sql), depois da migration da Home. Esse RPC fornece contagens de checklists, comentários e anexos nos cards do Kanban.

Se a Home mostrar erro em quadros ou indicadores, aplique [`migrations/202610150001_home_resilience.sql`](migrations/202610150001_home_resilience.sql) depois das migrations anteriores. Ela separa `home_boards` e `home_metrics` sem desativar RLS nem alterar o formato dos dados. Cada RPC valida a conta ativa e o membership do workspace e restringe boards ao papel efetivo do usuário. O frontend registra o erro técnico da consulta específica somente no console de desenvolvimento; a interface mantém mensagens amigáveis e permite tentar novamente em cada seção. A migration solicita recarga do schema cache do PostgREST.

## Quadro Kanban

Depois da migration da Home, execute [`migrations/202610110001_board_task_badges.sql`](migrations/202610110001_board_task_badges.sql). Ela cria apenas `public.board_task_badges(uuid)`, uma consulta agregada que devolve contagens de checklist, comentários e anexos por tarefa, sem consultas por card. O RPC valida conta ativa e acesso ao board pelo JWT antes de ler qualquer tarefa.

As RPCs `move_task` e `move_column` da migration inicial continuam responsáveis pelas posições fracionadas; o cliente altera visualmente só o item movido, persiste via essas RPCs e restaura o cache em caso de falha. `npm run board:test` verifica ordenação, rollback, filtros e isolamento de badges.


Depois, execute [`migrations/202610120001_task_details.sql`](migrations/202610120001_task_details.sql). Esta migração incremental adiciona `task_subtasks` e `comment_mentions`, RPCs transacionais, auditoria estruturada e eventos de detalhes no canal privado do quadro. Há RLS nas duas novas tabelas; viewer não escreve. O bucket restringe MIME e tamanho, e o cliente verifica a assinatura de formatos conhecidos. Análise antimalware exigiria um serviço adicional.


Execute [`migrations/202610130001_members_invitations.sql`](migrations/202610130001_members_invitations.sql) depois de `202610120001`. A migration adiciona convites para workspace com validade de sete dias, segredo aleatório composto por dois UUIDs, armazenado apenas como hash, RPCs para criação/consulta/aceitação/revogação e diretórios autorizados de membros com e-mail. O link é mostrado somente uma vez ao gestor, em ação de cópia, porque ainda não há serviço de envio de e-mail. Compartilhe-o por um canal privado; reenviar invalida o anterior. A aceitação exige sessão ativa e e-mail confirmado igual ao convidado. A migration também protege owners de board, cria transferência transacional e restringe admins a gerir papéis inferiores. `app_role` continua independente de acesso operacional a workspaces/boards.

No Supabase Auth, autorize as URLs de retorno do aplicativo para a rota de convite e redefinição de senha. O cadastro público permanece desativado; novos usuários são provisionados pelo responsável do workspace.

## Notificações

A migration de notificações depende de `202610120001_task_details.sql` (tabela `comment_mentions`) e `202610130001_members_invitations.sql` (tabela `workspace_invitations`). Ela verifica as duas antes de alterar objetos, executa em transação e pode ser repetida se uma tentativa anterior tiver sido aplicada parcialmente. Se faltar uma dependência no projeto hospedado, aplique primeiro somente a migration ausente, em ordem.

Aplique [`migrations/202610140001_notifications.sql`](migrations/202610140001_notifications.sql) depois da migration de membros. A tabela `notifications` existente recebe `workspace_id`, chave de deduplicação, índice de paginação e tipos consistentes. Triggers/RPCs privados são a única fonte de geração; o cliente pode apenas ler, marcar como lida e excluir suas próprias notificações. A RLS também retira imediatamente da inbox as notificações de um board cujo acesso foi revogado. O canal privado `notifications:<user_id>` divulga apenas IDs; o cliente relê cada item sob RLS. Convites para e-mails sem conta são mantidos no fluxo de convites e não geram notificação até existir um destinatário autenticável.

`public.process_overdue_notifications()` está pronto para execução agendada e é idempotente inclusive se o usuário excluir a notificação. **Esta migration não cria um cron job.** Quando `pg_cron` estiver habilitado no projeto Supabase, um administrador pode agendar a chamada diária, por exemplo:

```sql
select cron.schedule(
  'kanban-task-overdue-daily',
  '0 9 * * *',
  $$select public.process_overdue_notifications(500);$$
);
```

O horário é o configurado no `pg_cron` do projeto; ajuste-o conforme a operação. O limite seleciona tarefas pendentes, então execuções seguintes avançam para as próximas. Execute `npm run notifications:test` para verificar geração, supressão de auto-notificação, menções, idempotência e isolamento por RLS no PostgreSQL local. Para validar a entrega Realtime hospedada, após aplicar a migration, abra duas sessões autenticadas em navegadores separados: Pedro atribui Ana a uma tarefa de um board compartilhado e a inbox/badge de Ana deve atualizar sem recarregar. Este teste depende de duas contas e do Realtime do projeto hospedado.
