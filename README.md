# hwd.space — Handcrafted Digital Workspace

Aplicação Kanban React/TypeScript com Vite, Tailwind, shadcn/ui, Framer Motion, dnd-kit e Supabase. O banco, autenticação, arquivos e eventos são reais; não há modo de demonstração.

## Executar

```bash
npm install
# Preencha .env.local a partir de .env.example, se ainda não existir.
npm run dev
```

O cliente recebe apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A chave anon legada também é aceita nesse segundo campo. Sem configuração, login fica desativado. Não há cadastro público; contas novas são criadas por owner/admin do workspace em “Adicionar membro”. Nunca coloque service_role ou credenciais PostgreSQL em `VITE_*`.

Execute, em ordem, [`202610080001_kanban_data.sql`](supabase/migrations/202610080001_kanban_data.sql), [`202610090001_auth_admin.sql`](supabase/migrations/202610090001_auth_admin.sql), [`202610100001_home_overview.sql`](supabase/migrations/202610100001_home_overview.sql), [`202610110001_board_task_badges.sql`](supabase/migrations/202610110001_board_task_badges.sql), [`202610120001_task_details.sql`](supabase/migrations/202610120001_task_details.sql) e [`202610130001_members_invitations.sql`](supabase/migrations/202610130001_members_invitations.sql) no SQL Editor do Supabase. As instruções completas, permissões, Storage, Realtime e limitações de manutenção estão em [`supabase/README.md`](supabase/README.md). A primeira migração é inicial e aborta se tabelas da aplicação já existirem; o rascunho anterior está preservado em `supabase/legacy`.

## Arquitetura

- `src/components/ui`, `layout`, `common`: design system, navegação e estados.
- `src/features`: componentes, serviços e hooks por domínio, incluindo workspaces, perfis, boards, tarefas, membros, comentários, anexos, labels, checklists, dependências, favoritos, atividade e notificações.
- `src/pages`: composição das rotas protegidas por sessão Supabase.
- `src/services/supabase`: cliente tipado com a chave pública.
- `src/types/database.ts`: contratos gerados do schema; `domain.ts`: modelos de leitura.
- `src/stores`: apenas seleção e estado da UI com Zustand; dados remotos em TanStack Query.
- `supabase/migrations`: 21 tabelas, constraints, índices, RLS, Storage e Realtime privado.

Auth inclui login, sessão persistente e recuperação/troca de senha. Novas contas são criadas pela Edge Function `workspace-create-member`; perfis recebem `app_role=user`. `/register`, `/signup` e `/create-account` redirecionam para `/login`. Cargos globais são definidos manualmente no Supabase; workspace roles continuam independentes. `/admin` e `/admin/users` exigem cargo global admin/superadmin, validado no banco. A desativação e a redefinição de senha usam Edge Functions administrativas.

Veja as permissões e implantação das Edge Functions em [`supabase/README.md`](supabase/README.md). Se o Supabase Auth hospedado ainda aceitar novos signups, desabilite o cadastro de usuários nas configurações de Auth do projeto.

## Verificar

```bash
npm run db:types  # Gera tipos usando os catálogos do schema local isolado.
npm run db:test   # Testa SQL, RLS, grants e integridade em PostgreSQL/PGlite.
node scripts/test-auth-admin.mjs # Testa Auth/admin e proteção do último superadmin.
npm run home:test # Testa agregação e isolamento da Home.
npm run board:test # Testa drag, filtros, badges e RLS do quadro.
npm run members:test # Testa convites, transferência, permissões e isolamento.
npm run build    # TypeScript + produção Vite.
npm run lint
```

PGlite é somente ferramenta de teste, não backend. A integração hospedada de Auth, Storage e WebSocket requer aplicar a migração no projeto e verificar os fluxos reais. O build requer uma versão atual de Node compatível com Vite 8 (22.12+).
