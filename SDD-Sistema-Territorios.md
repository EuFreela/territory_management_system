# SDD — CAMPO (Sistema de Territórios)

| Campo | Valor |
|-------|--------|
| **Produto** | CAMPO |
| **Cliente / contexto** | Congregação Alpinópolis — gestão de territórios de campo |
| **Versão do software** | **v0.0.46** |
| **Versão deste documento** | **46.0** |
| **Data** | 09/09/2026 |
| **Status** | Implementado e alinhado ao código na tag `v0.0.46` |
| **Repositório** | https://github.com/EuFreela/territory_management_system |
| **Tag** | [`v0.0.46`](https://github.com/EuFreela/territory_management_system/releases/tag/v0.0.46) |
| **Domínio de produção** | Definido em `VITE_APP_URL` (não versionado) |

**Objetivo do documento:** especificação oficial do que o sistema faz, como está estruturado (dados, API, UI, segurança) e o que permanece fora de escopo.

> Fonte de verdade da versão: [`src/lib/version.ts`](src/lib/version.ts) (`APP_VERSION`) e a aba **Sobre → Atualizaciones** (`src/pages/AboutPage.tsx`).
> Toda release deve atualizar esta tabela, a seção 14 e a 16.

---

## 1. Visão geral

O **CAMPO** é um sistema web para **planejar, acompanhar e registrar o trabalho de campo por territórios**:

- Cartões de território (localidade + Terr. N.º)
- Mapa com polígonos (áreas/quadras), basemap Google ou OSM Shortbread vetorial, e busca por endereço
- Registros **NÃO EM CASA** (quadra, rua, casas) com checklist sincronizado em tempo real
- **Backup do não em casa** em `.txt` e **download da imagem do mapa**, ambos restritos
- **Território do dia** no Início, com finalização, histórico cumulativo e **revisão/aprovação**
- Escala de **dirigentes** (dias fixos, datas específicas e importação de programação por `.txt`)
- **Chat em grupo** e **presença/GPS** entre usuários da mesma congregação
- **RBAC** com papéis de sistema + papéis personalizados e **permissões exclusivas por usuário**
- **Congregações** cadastradas por CEP, com isolamento de dados por região de trabalho
- **Login com Google** (OAuth 2.0 / OIDC), com allowlist opcional e menor privilégio
- Preferência de tema **light/dark por usuário**
- Relatórios de finalizados com métricas e gráficos
- **Tutorial em A4** (`/docs/tutorial.html`) e página **Sobre** com changelog

### Público

Usuários autenticados (responsáveis / irmãos) com papéis distintos (admin, editor, campo, visualizador) e permissões individuais.

### Fase atual

| Item | Valor |
|------|--------|
| Versão | v0.0.46 |
| Banco | MySQL 8+ (local ou servidor) |
| Nome do banco (padrão) | `campo` (`DB_NAME`) |
| Schema base | `db/schema.sql` (DDL, sem dados) |
| Frontend | Vite + React SPA |
| Backend | Express + TypeScript (mesmo monorepo) |
| Deploy | Build único; API serve o `dist` em produção |
| Produção | Domínio e origin definidos em `VITE_APP_URL` (fora do repositório) |
| Estado efêmero | Chat e presença/GPS ficam **em memória** (reinício do servidor limpa) |

---

## 2. Stack tecnológica

| Camada | Tecnologia | Notas |
|--------|------------|--------|
| Frontend | **Vite 7** + **React 19** | SPA com `React.lazy` por página |
| Roteamento | **React Router 7** | Rotas e guards |
| Estilo | **Tailwind CSS 4** + **shadcn/ui** (Radix) | Tokens `bg-background` / `text-foreground`, dark via `.dark` |
| Animações | `tw-animate-css` | Tailwind v4 |
| Tipografia | **Geist** (`@fontsource-variable/geist`) | — |
| Ícones | `lucide-react`, `react-icons` | — |
| Gráficos | **Recharts** | Relatório de finalizados |
| API | **Express 5** + **tsx** | REST |
| Linguagem | **TypeScript** | Client + server (`tsconfig.app.json` / `tsconfig.server.json`) |
| Banco | **MySQL** + **mysql2** | Prepared statements |
| Auth | **JWT** (`jose`) + cookie `httpOnly` | Sessão, com denylist de `jti` |
| OAuth | Google Identity (OIDC) | `server/routes/google-auth.ts` |
| Senha | **bcryptjs** | Hash (12 rounds) |
| Mapa | **Leaflet** + **react-leaflet** + **Google Maps** (basemap via GoogleMutant) | Polígonos GeoJSON |
| Mapa vetorial | **MapLibre GL** + Shortbread (`@maplibre/maplibre-gl-leaflet`) | Basemap alternativo ao Google |
| Validação | **Zod 4** | Schemas de request |
| CEP / geocode | **BrasilAPI** (CEP→coordenadas) + **Nominatim** (busca de endereço) | — |
| Cartografia | `VITE_GOOGLE_MAPS_API_KEY` (Maps JavaScript API) | Embutida no build Vite |
| Fuso | `APP_TIMEZONE` (padrão `America/Sao_Paulo`) | “Hoje” de dirigentes e datas |

> **Basemap:** Google Maps no Leaflet (GoogleMutant); OSM Shortbread vetorial como alternativa. Desenho/áreas continuam no Leaflet.
> **Não usar** Next.js (projeto é Vite SPA).
> Tokens legados `--apple-*` ainda existem em `src/index.css`; os novos componentes shadcn usam os tokens semânticos.

---

## 3. Funcionalidades implementadas

### 3.1 Autenticação e sessão

| Item | Status | Detalhe |
|------|--------|---------|
| Login | ✅ | Email + senha → JWT em cookie `auth_token` |
| Logout | ✅ | Limpa cookie **e revoga o `jti`** (denylist em memória) |
| Login com Google | ✅ | OAuth 2.0/OIDC; botão visível só se `GOOGLE_CLIENT_ID`/`SECRET` definidos |
| Allowlist Google | ✅ | `GOOGLE_ALLOWED_EMAILS` vazio = qualquer e-mail verificado |
| Menor privilégio Google | ✅ | Conta nova recebe papel **Visualizador** |
| Cadastro público | ❌ desabilitado | `POST /api/auth/register` → 403 |
| Criação de usuários | ✅ | Somente quem tem `user:manage` (restrito à própria congregação) |
| Sessão atual | ✅ | `GET /api/auth/me` (papel + permissões + tema + região + bloqueio) |
| Perfil | ✅ | `PUT /api/auth/profile` (nome, e-mail) |
| Troca de senha | ✅ | `/change-password`; rate limit; política forte |
| Senha fraca no login | ✅ | Flag `password_is_weak` → força troca |
| Conta de sistema | ✅ | `admin@campo.local` imutável (só a senha muda) |
| Rate limit login | ✅ | 10 tentativas / 15 min (por IP real + email) |
| Rota protegida (front) | ✅ | `ProtectedRoute` + shell |
| API protegida | ✅ | `requireAuth` + `requirePermission` |

### 3.2 Início / Dashboard (`/dashboard`)

- Anúncio do **território do dia** (localidade, Terr. N.º)
- Ações: desvincular do dia; **Finalizar** (modal com nº de pessoas → histórico + desvincula)
- Lista **Não finalizados** (territórios com quadra incompleta)
- Bloco de **dirigentes de hoje** (datados + fixos), com edição de nome quando `schedule:manage`
- Indicadores de presença/online e acesso ao chat flutuante

### 3.3 Territórios (lista `/territories`)

- Listagem (com `territory:read`), isolada pela região de trabalho (CEP)
- Busca por localidade e Terr. N.º (normalizada, sem acentos)
- Indicador de área no mapa, de revisão e de território do dia
- Marcar / desvincular território do dia (`territory:set_daily`)
- Criar (`territory:create`) — botão ícone **+**
- Ver cartão / editar área (ícones; permissões respectivas)
- **Revisar / aprovar** território (`POST|DELETE /:id/review`)

### 3.4 Finalizados (`/territories/finalizados`) e Relatório (`/relatorios/finalizados`)

- Histórico cumulativo de finalizações (`territory:read` na listagem; `territory:update` na página)
- Colunas: dia do campo, horário, dirigente, pessoas, território, registrado por, data/hora
- Busca textual; remoção de linha **apenas admin**
- Relatório com **métricas e gráficos** (Recharts) dos finalizados da região

### 3.5 Cartão / detalhe (`/territories/:id`)

- Cabeçalho estilo cartão: Localidade + Terr. N.º
- Mapa em leitura (polígonos, rótulos) + basemap Google/Shortbread
- Seção **NÃO EM CASA**: checklist por casa, com **atualização automática** (polling) e confirmação ao desmarcar
- **Backup `.txt`** do não em casa com seletor de dirigente (`BackupLeadersModal`)
- **Download da imagem do mapa** (`territory-map-image.ts`), respeitando PB/colorido
- Contador feitos/total; tag **Finalizado**
- Destaque bidirecional mapa ↔ cartão
- Ações condicionadas a permissão (dia, editar, excluir)

### 3.6 Criar / editar território

| Rota | Permissão |
|------|-----------|
| `/territories/new` | `territory:create` |
| `/territories/:id/edit` | `territory:update` **ou** `block:manage` |

- Campos: Localidade, Terr. N.º, **CEP da região**, **URL da imagem do mapa**
- Mapa centrado no CEP da região de trabalho
- Desenho de **múltiplas áreas** (FeatureCollection)
- Toolbar do mapa: travado/desenhar/concluir, desfazer/refazer/apagar, tela cheia/reenquadrar, busca de endereço (geocode) com pin
- Seção NÃO EM CASA: quadra, rua, casas, **descrição/nota informativa**; add/remove; bulk delete; progresso

### 3.7 Dirigentes (`/dirigentes`) — `schedule:manage`

- Designações **datadas** e **fixas** (dia da semana), com horário/período
- Cards agrupados; “Hoje” em destaque
- CRUD de designações (API autenticada) + **importação de programação** por texto/`.txt` (`ImportScheduleModal`, modelo em `/docs/modelo-programacao-dirigentes.txt`)
- Limpar toda a programação da região (com confirmação)
- Fuso: `APP_TIMEZONE` / America/Sao_Paulo

### 3.8 Usuários (`/usuarios`) — `user:manage`

- Listar usuários **da própria congregação** (admin vê todas, com marca “SC”)
- Criar usuário (nome, e-mail, senha forte, papel, congregação)
- Alterar papel; bloquear/desbloquear (`PUT /:id/block-status`); excluir (proteção do último admin)
- **Permissões exclusivas por usuário** (ícone de chave, `user_permissions`) — aditivas às do papel
- Papéis seed: admin, editor, field, viewer

### 3.9 Papéis e permissões (`/permissoes`) — somente admin

- Criar/editar/excluir **papéis personalizados** (nome, descrição, checkboxes de escopos)
- Papéis de sistema fixos não são excluíveis; papel em uso bloqueia exclusão
- Papel **admin** é sempre “Somente leitura” neste painel (proteção)
- Servidor valida: só admin cria/edita/exclui papéis

### 3.10 Congregações (`/congregacoes`) — `congregation:manage`

- Cadastro por **CEP + nome** (endereço opcional); um CEP pode ter várias congregações
- Definir a congregação **ativa** (troca a região de trabalho do admin logado, sem afetar os demais)
- Contadores por linha: territórios e usuários do CEP
- Nome da congregação exibido por CEP

### 3.11 Configuração (`/configuracao`) e Perfil (`/perfil`)

- Região de trabalho (CEP) e nome da congregação — `config:cep` (admin)
- Regiões já cadastradas (somente leitura)
- Perfil: dados da conta, troca de senha

### 3.12 Chat e presença (em memória)

- **Chat em grupo** (`/api/chat`, `FloatingChat.tsx`) — mensagens `user`/`system`, limitadas por congregação (CEP), sem persistência
- **Presença/GPS** (`/api/presence`) — usuários com GPS ativo no mapa (nome/cor) e sessões “online”, por congregação
- Entrada/saída do chat anunciadas automaticamente

### 3.13 Sobre (`/sobre`) e Tutorial

- Aba **O sistema**: o que é o CAMPO, o que faz, para quem é
- Aba **Atualizações**: changelog por versão (fonte: `src/pages/AboutPage.tsx`)
- **Tutorial A4** (`/docs/tutorial.html`, servido de `public/docs`) com capturas reais

### 3.14 UI / UX global

- Design system shadcn/ui + Tailwind v4 (tokens semânticos, dark via `.dark`)
- Shell: logo, nav desktop, drawer mobile, usuário, tema, chat, sair
- Controle segmentado próprio para abas (pill `rounded-full`) — **não** usar `Tabs` do shadcn
- Tooltips custom (`data-tooltip`) — sem `title` nativo feio
- Tema light/dark com classe `dark` no `html`, **persistido no usuário** (`theme_preference`)
- Confirmações padronizadas em alerta estilo iOS (`confirmToast` via Sonner)
- Scroll to top; textos da UI sempre em PT-BR

### 3.15 Fora de escopo / futuro

- [ ] Upload real de imagens (há URL de imagem do mapa; `territory_images` segue sem fluxo completo na UI)
- [ ] Persistir chat e presença no banco (hoje em memória)
- [ ] Relatórios exportáveis (CSV/PDF)
- [ ] CI/CD e pipeline de deploy documentados
- [ ] App mobile nativo

---

## 4. Papéis e permissões (RBAC)

### 4.1 Escopos

| Escopo | Uso |
|--------|-----|
| `territory:create` | Criar território |
| `territory:read` | Listar, ver, dashboard, relatórios, histórico |
| `territory:update` | Editar território/mapa; páginas Finalizados e Template |
| `territory:delete` | Excluir território |
| `territory:set_daily` | Marcar/desvincular território do dia |
| `block:manage` | CRUD de não em casa |
| `block:check` | Marcar números visitados; **download/export** de território |
| `schedule:manage` | Gerir a escala de dirigentes |
| `user:manage` | Gestão de usuários (limitada à congregação, salvo admin) |
| `config:cep` | Trocar a região de trabalho (CEP) |
| `congregation:manage` | Gerir o cadastro de congregações |

Admin (`slug = admin` ou `isAdmin`) tem **todos** os escopos implicitamente.

### 4.2 Papéis padrão

| Slug | Nome | Permissões |
|------|------|------------|
| `admin` | Administrador | Todos os escopos |
| `editor` | Editor | create, read, update, set_daily, block:manage, block:check, schedule:manage |
| `field` | Campo | read, block:check |
| `viewer` | Visualizador | read |

> **Downloads/exportação em territórios** (imagem do mapa e backup .txt do não em casa) exigem
> quem trabalha com o cartão — escopos `territory:update`, `block:manage` ou `block:check`
> (campo, editor e admin). O `viewer` (somente `territory:read`) não baixa.

> **Permissões exclusivas por usuário** (`user_permissions`) são **aditivas** às do papel e podem ser
> concedidas/editadas **somente pelo administrador**; aplicam-se no servidor a cada requisição.

> **Conta de sistema:** `admin@campo.local` é única e fixa. Não pode ser excluída, bloqueada,
> ter papel/congregação/permissões alterados — somente a senha. O login ignora a flag `blocked`
> dessa conta.

### 4.3 Enforcement

- **API:** `requirePermission(scope)` / `RequireAdmin` / `requireAuth`
- **Front:** `useAuth().can(scope)` / `canAny()`, `RequirePermission`, `RequireAdmin`, ocultação de botões/menus
- Espelhos dos escopos: `server/lib/rbac.ts` (fonte) e `src/lib/permissions.ts`

---

## 5. Modelo de dados (MySQL)

Banco padrão: **`campo`**. Schema base: `db/schema.sql`; evoluções incrementais em `scripts/migrate-*.js`.

### 5.1 Diagrama lógico (entidades)

```
roles 1──* role_permissions
roles 1──* users
users 1──* user_permissions
users 1──* territories
territories 1──* blocks
territories 1──* territory_images   (reservado)
territories 0──* territory_finish_history
field_assignments (independente)
congregations (independente)
cep_regions (independente)
```

### 5.2 Tabelas

#### `roles`
- `id`, `slug` (unique), `name`, `description`, `is_system`, `created_at`

#### `role_permissions`
- PK (`role_id`, `permission`) · FK `role_id` → `roles`

#### `users`
- `id`, `name`, `email` (unique), `password_hash` (**nullable** p/ contas Google)
- `role_id` → `roles` (nullable, ON DELETE SET NULL)
- `theme_preference` VARCHAR(10) NOT NULL DEFAULT `'light'` — `light` | `dark`
- `active_cep` VARCHAR(9) NULL — região de trabalho do usuário (null = padrão do `.env`)
- `blocked` — impede o login
- `created_at`

#### `user_permissions`
- PK (`user_id`, `permission`) · FK `user_id` → `users` (CASCADE)
- Permissões **exclusivas/aditivas** por usuário

#### `territories`
- `id`, `user_id` → `users`
- `name` (localidade), `number` (Terr. N.º)
- `cep`, `geojson` (LONGTEXT, FeatureCollection), `map_lat`, `map_lng`
- `image_url` — imagem do mapa do território (download no cartão)
- `is_daily` (0/1), `daily_assignment_id` → `field_assignments` (território do dia vinculado ao dirigente)
- `is_reviewed` (0/1), `reviewed_at` (revisado/aprovado)
- `created_at`, `updated_at`

#### `blocks` (NÃO EM CASA)
- `id`, `territory_id` → `territories`
- `name` (nº da quadra), `street_name`, `description` (nota informativa)
- `house_numbers` JSON, `completed_houses` JSON (checklist feito)
- `sort_order`

#### `territory_finish_history`
- Histórico **cumulativo** (sempre INSERT na finalização)
- `territory_id` (nullable), `territory_name`, `territory_number`, `cep`
- `field_date`, `field_time`, `leader_name`, `people_count`
- `quadras_count`, `casas_count`, `restam_casas` (métricas do relatório)
- `finished_by_user_id`, `finished_by_name`, `finished_at`

#### `field_assignments`
- `service_date` (datado) **ou** `is_fixed` + `fixed_weekday` (0=Dom … 6=Sáb)
- `weekday_label`, `assignee_name`, `period_label`, `fixed_time`, `cep`, `sort_order`
- `created_at`, `updated_at`

#### `territory_images`
- Reservado: `territory_id`, `image_url`, `caption`, `sort_order` — **sem fluxo completo na UI atual**

#### `congregations`
- `id`, `cep`, `name`, `address` (nullable) — UNIQUE (`cep`, `name`)
- `created_at`, `updated_at`

#### `cep_regions`
- `cep` (PK), `name`, `updated_at` — nome da congregação por CEP

### 5.3 Migrações auxiliares

| Comando | Efeito |
|---------|--------|
| `npm run migrate:rbac` | `roles`, `role_permissions`, `users.role_id` |
| `npm run migrate:finish-history` | `territory_finish_history` (+ métricas) |
| `npm run migrate:theme` | `users.theme_preference` |
| `npm run migrate:block-description` | `blocks.description` |
| `npm run migrate:daily-per-leader` | `territories.daily_assignment_id` |
| `npm run migrate:territory-reviewed` | `territories.is_reviewed`, `reviewed_at` |
| `npm run migrate:google-oauth` | `users.password_hash` nullable |
| `npm run migrate:active-cep` | `users.active_cep`, `cep` em territories/histórico/escala |
| `npm run migrate:territory-image-url` | `territories.image_url` |
| `npm run migrate:cep-congregation` | `cep_regions` |
| `npm run migrate:congregations` | `congregations` |
| `npm run migrate:user-blocked` | `users.blocked` |
| `npm run migrate:user-permissions` | `user_permissions` |
| `npm run migrate:schedule-manage` | Escopo `schedule:manage` (libera admin/editor) |

> Todas as migrações são idempotentes e podem rodar em banco já existente.

---

## 6. API REST

Base: `/api` (proxy Vite em dev; mesma origem em prod).

### 6.1 Config / saúde

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/health` | — | Healthcheck |
| GET | `/api/config/map` | — | Centro do mapa (CEP da região, ou padrão do `.env`) |
| GET | `/api/config/cep` | ✅ | Região atual + CEPs já usados + nome da congregação (`config:cep` vê a lista) |
| POST | `/api/config/cep/preview` | `config:cep` | Valida um CEP (BrasilAPI) sem gravar |
| PUT | `/api/config/cep` | `config:cep` | Define a região de trabalho do usuário |
| GET | `/api/config/google` | — | Login Google habilitado? |
| GET | `/api/config/geocode?q=` | ✅ | Busca endereço → coords (Nominatim; rate limit) |

### 6.2 Auth (`/api/auth`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/register` | — | **403** — cadastro desabilitado |
| POST | `/login` | — | Login; cookie; `password_is_weak?` |
| POST | `/logout` | — | Limpa cookie + revoga `jti` |
| GET | `/me` | cookie | Usuário + role + permissions + tema + região + bloqueio |
| PUT | `/theme` | ✅ | `{ theme: "light"\|"dark" }` |
| PUT | `/profile` | ✅ | Atualiza dados do perfil |
| POST | `/change-password` | ✅ | Senha atual + nova (forte) |
| GET | `/google` | — | Inicia OAuth Google |
| GET | `/google/callback` | — | Callback OAuth (allowlist opcional) |

### 6.3 Territórios (`/api/territories`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/` | `territory:read` | Lista (região atual) |
| GET | `/dashboard` | `territory:read` | Daily + não finalizados + dirigentes de hoje |
| GET | `/finished-history` | `territory:read` | Histórico |
| DELETE | `/finished-history/:historyId` | admin | Remove linha do histórico |
| POST | `/` | `territory:create` | Cria |
| GET | `/:id` | `territory:read` | Detalhe |
| PUT | `/:id` | `territory:update` | Atualiza |
| DELETE | `/:id` | `territory:delete` | Exclui |
| POST | `/:id/daily` | `territory:set_daily` | Marca do dia |
| DELETE | `/:id/daily` | `territory:set_daily` | Desvincula |
| POST | `/:id/review` | `territory:update` | Marca revisado/aprovado |
| DELETE | `/:id/review` | `territory:update` | Desmarca revisão |
| POST | `/:id/finish` | (fluxo dia) | Finaliza → history + unsets daily |
| GET | `/:id/blocks` | `territory:read` | Lista blocos |
| POST | `/:id/blocks` | `block:manage` | Cria bloco |
| PUT | `/:id/blocks/:blockId` | `block:manage` | Atualiza bloco |
| PATCH | `/:id/blocks/:blockId/houses` | `block:check` | Marca/desmarca casa |
| DELETE | `/:id/blocks/:blockId` | `block:manage` | Remove bloco |
| POST | `/:id/blocks/bulk-delete` | `block:manage` | Exclusão em massa |

### 6.4 Dirigentes (`/api/field-assignments`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/` | ✅ | Lista todas |
| GET | `/today` | ✅ | Designações de hoje (datadas + fixas) |
| GET | `/leaders` | ✅ | Lista para seletores (backup, relatório) |
| POST | `/` | ✅ | Cria |
| PUT | `/:id` | ✅ | Atualiza |
| DELETE | `/:id` | ✅ | Remove |

### 6.5 Usuários (`/api/users`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/roles` | Papéis + permissões |
| POST | `/roles` | Cria papel (admin) |
| PUT | `/roles/:id` | Atualiza papel (admin) |
| DELETE | `/roles/:id` | Remove papel (admin; bloqueado se em uso) |
| GET | `/congregations` | Congregações para o seletor |
| GET | `/` | Lista usuários (região, salvo admin) |
| POST | `/` | Cria |
| PUT | `/:id` | Atualiza (papel, congregação) |
| PUT | `/:id/block-status` | Bloqueia/desbloqueia |
| GET | `/permissions/:id` | Permissões exclusivas |
| PUT | `/permissions/:id` | Salva permissões exclusivas (admin) |
| DELETE | `/:id` | Remove |

### 6.6 Congregações (`/api/congregations`) — `congregation:manage`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Lista (com contadores) |
| POST | `/` | Cria |
| PUT | `/:id` | Atualiza |
| POST | `/:id/set-active` | Define como região ativa do admin logado |
| DELETE | `/:id` | Remove |

### 6.7 Presença (`/api/presence`) e Chat (`/api/chat`) — em memória

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/presence/gps` | Usuários com GPS ativo |
| PUT | `/presence/gps` | Atualiza minha posição |
| DELETE | `/presence/gps` | Remove minha posição |
| PUT | `/presence/session` | Abre/atualiza sessão (aba) |
| DELETE | `/presence/session` | Encerra sessão |
| GET | `/presence/online` | Quem está online |
| GET | `/chat/state` | Estado do chat |
| GET | `/chat/messages` | Mensagens recentes da congregação |
| POST | `/chat/messages` | Envia mensagem |

---

## 7. Frontend — rotas e páginas

| Rota | Página | Guard |
|------|--------|-------|
| `/` | Redirect login ou dashboard | — |
| `/login` | Login (Google opcional) | público |
| `/register` | Redirect → login | — |
| `/change-password` | Troca de senha | autenticado (pode forçar) |
| `/dashboard` | Início | autenticado |
| `/territories` | Lista | autenticado |
| `/territories/finalizados` | Finalizados | `territory:update` |
| `/territories/template` | Cartão modelo | `territory:update` |
| `/territories/new` | Novo | `territory:create` |
| `/territories/:id` | Cartão | autenticado |
| `/territories/:id/edit` | Editar | `territory:update` \| `block:manage` |
| `/dirigentes` | Escala | `schedule:manage` |
| `/usuarios` | Usuários | `user:manage` |
| `/permissoes` | Papéis e permissões | admin |
| `/congregacoes` | Congregações | `congregation:manage` |
| `/relatorios/finalizados` | Relatório + gráficos | `territory:read` |
| `/perfil` | Perfil | autenticado |
| `/configuracao` | Configuração (região) | autenticado |
| `/sobre` | Sobre + changelog | autenticado |

### 7.1 Componentes principais

| Path | Função |
|------|--------|
| `AppShell` | Layout, menu desktop/mobile, tema, chat, logout |
| `TerritoryMap` / `TerritoryImageLeafletMap` | Mapa interativo (draw, fullscreen, geocode, basemap) |
| `GoogleMapsTileLayer` / `OsmShortbreadTileLayer` | Basemaps (Google / Shortbread vetorial) |
| `ProtectedRoute` / `RequirePermission` / `RequireAdmin` | Guards de sessão e escopo |
| `BackupLeadersModal` / `ImportScheduleModal` | Backup do não em casa / importação da escala |
| `FloatingChat` | Chat em grupo |
| `confirm-toast` | Confirmações padronizadas (Sonner) |
| `theme-context` / `auth-context` | Tema, sessão, `can()` |

---

## 8. Tema (dark / light)

1. Coluna `users.theme_preference` (`light` | `dark`, default `light`).
2. Login / `GET /me` devolve a preferência; o front aplica (`class="dark"` no `html`).
3. Toggle no shell/login: se autenticado → `PUT /api/auth/theme` e atualiza o usuário em memória.
4. Sem sessão (login): cache local (`campo-theme-guest` / `campo-theme`).
5. Tokens CSS semânticos do shadcn em `src/index.css` (`:root` e `.dark`).

---

## 9. Segurança

| Controle | Implementação |
|----------|----------------|
| Senha | bcrypt (12 rounds); política forte na troca e criação |
| Sessão | JWT assinado; cookie httpOnly; duração `JWT_EXPIRES` (padrão 12h) |
| Revogação | Logout revoga o `jti` (denylist em memória, até expirar) |
| Produção | `JWT_SECRET` ≥ 32 chars obrigatório |
| Cookie Secure | Configurável (`COOKIE_SECURE`); false em HTTP/LAN |
| SQL | Prepared statements |
| Rate limit | Login (10/15min), change-password (8/15min), Google login (10/15min) e callback (30/15min), geocode (20/min), config CEP (20/min), limpar escala (5/15min) |
| Origem (CSRF) | Rotas POST/PUT/PATCH/DELETE em `/api` exigem Origin/Referer conhecido |
| Headers | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (geolocation), HSTS em HTTPS, sem `X-Powered-By` |
| Proxy | `trust proxy` só em produção (IP real no rate limit) |
| Cadastro público | Desabilitado |
| RBAC | Server-side é a fonte da verdade; front só esconde UI |
| CORS | `VITE_APP_URL` + credentials |

**Não commitar** `.env`.

---

## 10. Configuração (`.env`)

| Variável | Uso |
|----------|-----|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL |
| `JWT_SECRET` | Assinatura JWT (mín. 32 chars em produção) |
| `JWT_EXPIRES` | Ex.: `12h`, `1d` |
| `PORT` | Porta da API (padrão 3001) |
| `VITE_APP_URL` | Origin do front (CORS e cookie Secure). Produção: o domínio real |
| `COOKIE_SECURE` | `true` só com HTTPS |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API (restringir por referrer) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Login Google (opcional) |
| `GOOGLE_ALLOWED_EMAILS` | Allowlist do login Google (opcional; vazio = qualquer verificado) |
| `ADMIN_NAME`, `ADMIN_EMAIL` | Usados por `npm run create:admin` |
| `APP_TIMEZONE` | Ex.: `America/Sao_Paulo` |
| `TERRITORY_CEP` | CEP base padrão do mapa |

---

## 11. Scripts e deploy

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Vite + API |
| `npm run build` | Typecheck + build web + compile server |
| `npm start` | Produção: API + static `dist` + SPA fallback |
| `npm run create:admin` | Cria o administrador (senha aleatória forte) |
| `npm run migrate:<nome>` | Migrações incrementais (ver 5.3) |

Schema base: `mysql -u root -p < db/schema.sql`. Produção Express 5: `GET /{*path}` → `index.html`.

Tutorial: `public/docs/tutorial.html` (A4) e `public/docs/modelo-programacao-dirigentes.txt`.

---

## 12. Estrutura de pastas (resumo)

```
campo/
├── src/                 # React SPA
│   ├── pages/
│   ├── components/      # layout, Map, chat, ui (shadcn), guards
│   └── lib/             # api, auth, theme, permissions, types
├── server/
│   ├── routes/          # auth, territories, field-assignments, users,
│   │                    #   congregations, presence, chat, google-auth
│   ├── lib/             # db, rbac, load-user, auth, chat, presence, cep…
│   └── middleware/      # requireAuth, requirePermission, rateLimit, securityHeaders
├── scripts/             # migrações incrementais + create:admin
├── db/schema.sql        # schema base (DDL)
├── public/docs/         # tutorial.html, modelo-programacao-dirigentes.txt, tutorial/*.webp
├── public/theme.js
├── package.json
├── README.md
└── SDD-Sistema-Territorios.md   # este documento
```

---

## 13. Fluxos principais

### 13.1 Login e tema

```
Usuário → POST /login → cookie + user.theme_preference
       → front aplica dark/light
       → se password_is_weak → /change-password
       → senão → /dashboard
```

### 13.2 Território do dia → finalização

```
Admin/editor/field marca território do dia
  → aparece no Início
  → Finalizar + pessoas
  → INSERT territory_finish_history (cumulativo)
  → is_daily = 0
  → visível em /territories/finalizados e no relatório
```

### 13.3 Checklist NÃO EM CASA (tempo real)

```
Editar/cartão → blocks (quadra/rua/casas)
  → PATCH completed_houses (otimista)
  → polling automático reflete marcações de outras pessoas na mesma rua
  → todas as casas feitas → visual “finalizado”
  → backup .txt com o dirigente escolhido
```

---

## 14. Changelog (v0.0.46)

Alinhado à aba **Sobre → Atualizações** no produto (`src/pages/AboutPage.tsx`):

1. **v0.0.46** — conta de sistema `admin@campo.local` fixa (só a senha muda, selo “Sistema”); download/export de território restrito a quem trabalha com o cartão  
2. **v0.0.45** — permissão própria `schedule:manage` para a escala de dirigentes (editor/admin)  
3. **v0.0.44** — tutorial: seção Usuários/Permissões revisada (47 páginas)  
4. **v0.0.43** — backup com seletor de dirigente; datas padronizadas DD/MM/AAAA  
5. **v0.0.42** — escolhe o dirigente no backup dos não em casa  
6. **v0.0.41** — backup do não em casa em `.txt`  
7. **v0.0.40** — não em casa em tempo real (sincronização entre pessoas)  
8. **v0.0.39** — reforço de segurança no servidor (rate limit com trust proxy, Origin em rotas com efeito, auditoria de dependências)  
9. **v0.0.38** — não em casa gravado na hora; botão Voltar; Finalizados/Template só para quem edita  
10. **v0.0.37** — página de Papéis e permissões (RBAC) administrável  
11. **v0.0.36** — gestão de usuários restrita à congregação  
12. **v0.0.35** — permissões exclusivas por usuário  
13. **v0.0.34** — login com Google com menor privilégio (Visualizador)  
14. **v0.0.33** — isolamento da congregação; destaque de seleção  
15. **v0.0.32** — congregação do usuário na edição  
16. **v0.0.31** — tutorial: abas recapturadas  
17. **v0.0.30** — bloqueio de usuários e lista completa  
18. **v0.0.29** — página de congregações e região na Configuração  
19. **v0.0.27** — usuários vinculados à congregação  
20. **v0.0.26** — segurança e isolamento por CEP (`config:cep`; headers de segurança)  
21. **v0.0.25** — baixar imagem do mapa no botão  
22. **v0.0.24.1** — inserir programação na escala via `.txt`  
23. **v0.0.24** — tutorial: Sobre, conta e tema  
24. **v0.0.8** — GPS multi-usuário no mapa; OSM Shortbread vetorial; toasts unificados; validação PT-BR  
25. **v0.0.7** — confirmações padronizadas; gestão de usuários; escala por data  

---

## 15. Critérios de aceite (regressão v0.0.46)

- [ ] Conta `admin@campo.local` é fixa: não pode ser excluída/bloqueada/rebaixada; só a senha muda  
- [ ] Download da imagem do mapa e backup `.txt` exigem quem trabalha com o cartão (viewer não baixa)  
- [ ] `schedule:manage` protege `/dirigentes`, “Ver escala” e o edit do dirigente do dia  
- [ ] Permissões exclusivas por usuário são aditivas e editáveis só pelo admin  
- [ ] Não em casa sincroniza entre pessoas da mesma rua sem recarregar  
- [ ] Checklist de não em casa é gravado na hora ao clicar no botão do formulário  
- [ ] Logout invalida o token já emitido (denylist de `jti`)  
- [ ] Rotas com efeito rejeitam origem desconhecida (403)  
- [ ] Usuário comum vê apenas os dados da própria congregação; admin alterna região livremente  
- [ ] Login Google cria conta Visualizador e respeita a allowlist  
- [ ] Datas exibidas sempre em DD/MM/AAAA  
- [ ] Sobre mostra **v0.0.46**  

---

## 16. Histórico do documento

| Versão doc | Data | Notas |
|------------|------|--------|
| 1.x–2.x | 2025–2026 | Versões iniciais (Next/legado) |
| 3.0 | 02/08/2026 | SPA Vite; território do dia; não em casa |
| 4.0 | 03/08/2026 | Estado real v0.0.4 |
| 5.0 | 04/08/2026 | v0.0.5: Google Maps; publicação em produção |
| 5.1 | 05/08/2026 | v0.0.5.1: imagem do cartão; seleção por id |
| 6.0 | 05/08/2026 | v0.0.6: GPS, rota, notas, match exato |
| 6.1 | 05/08/2026 | v0.0.6.1: carro, pan livre, voltar ao GPS |
| 6.2 | 05/08/2026 | v0.0.6.2: ordenação N.º; tooltips compactos |
| 7.0 | 07/08/2026 | v0.0.7: confirmações padronizadas; usuários (papel/senha); escala por data |
| 8.0 | 07/08/2026 | v0.0.8: GPS multi-usuário; OSM Shortbread; zoom da cidade; toasts/PT-BR |
| **46.0** | **09/09/2026** | **Alinhamento integral à tag `v0.0.46`:** Tailwind 4 + shadcn, 11 escopos RBAC, congregações, chat/presença em memória, login Google, backup/relatórios, revisão de território, headers de segurança, denial de logout; schema em `db/schema.sql` |

---

*Fim do SDD — CAMPO v0.0.46*
