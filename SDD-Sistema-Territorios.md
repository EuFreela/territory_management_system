# SDD — CAMPO (Sistema de Territórios)

| Campo | Valor |
|-------|--------|
| **Produto** | CAMPO |
| **Cliente / contexto** | Congregação Alpinópolis — gestão de territórios de campo |
| **Versão do software** | **v0.0.8** |
| **Versão deste documento** | **8.0** |
| **Data** | 07/08/2026 |
| **Status** | Implementado e alinhado ao código atual |
| **Repositório** | https://github.com/EuFreela/territory_management_system |
| **Tag** | [`v0.0.8`](https://github.com/EuFreela/territory_management_system/releases/tag/v0.0.8) |
| **Domínio de produção** | **https://analp.tec.br** |

**Objetivo do documento:** especificação oficial do que o sistema faz, como está estruturado (dados, API, UI, segurança) e o que permanece fora de escopo.

---

## 1. Visão geral

O **CAMPO** é um sistema web para **planejar, acompanhar e registrar o trabalho de campo por territórios**:

- Cartões de território (localidade + Terr. N.º)
- Mapa com polígonos (áreas/quadras) e busca por endereço
- Registros **NÃO EM CASA** (quadra, rua, casas) com checklist
- **Território do dia** no Início, com finalização e histórico
- Escala de **dirigentes** (dias fixos e datas específicas)
- **RBAC** (papéis e permissões)
- Preferência de tema **light/dark por usuário**
- Página **Sobre** (descrição + changelog da versão)

### Público

Usuários autenticados (responsáveis / irmãos) com papéis distintos (admin, editor, campo, visualizador).

### Fase atual

| Item | Valor |
|------|--------|
| Versão | v0.0.8 |
| Banco | MySQL 8+ (local ou servidor) |
| Nome do banco (padrão) | `campo` (`DB_NAME`) |
| Frontend | Vite + React SPA |
| Backend | Express + TypeScript (mesmo monorepo) |
| Deploy | Build único; API serve o `dist` em produção |
| Domínio | https://analp.tec.br (Cloudflare Tunnel → app na VM) |

---

## 2. Stack tecnológica

| Camada | Tecnologia | Notas |
|--------|------------|--------|
| Frontend | **Vite 7** + **React 19** | SPA |
| Roteamento | **React Router 7** | Rotas e guards |
| Estilo | **Tailwind CSS 3** | Design system “Apple” (`apple-*`, `app-*`) |
| API | **Express 5** + **tsx** | REST |
| Linguagem | **TypeScript** | Client + server |
| Banco | **MySQL** + **mysql2** | Prepared statements |
| Auth | **JWT** (`jose`) + cookie `httpOnly` | Sessão |
| Senha | **bcryptjs** | Hash (12 rounds no login) |
| Mapa | **Leaflet** + **react-leaflet** + **Google Maps** (basemap) | Polígonos GeoJSON; tiles via GoogleMutant |
| Validação | **Zod 4** | Schemas de request |
| CEP / geocode | Config mapa + **Nominatim** (busca endereço) | Basemap Google; geocode ainda Nominatim |
| Cartografia | `VITE_GOOGLE_MAPS_API_KEY` (Maps JavaScript API) | Embutida no build Vite |
| Fuso | `APP_TIMEZONE` (padrão `America/Sao_Paulo`) | “Hoje” de dirigentes |

> **Basemap:** Google Maps no Leaflet (GoogleMutant). Desenho/áreas continuam no Leaflet.  
> **Não usar** Next.js (projeto é Vite SPA).

---

## 3. Funcionalidades implementadas

### 3.1 Autenticação e sessão

| Item | Status | Detalhe |
|------|--------|---------|
| Login | ✅ | Email + senha → JWT em cookie `auth_token` |
| Logout | ✅ | Limpa cookie |
| Cadastro público | ❌ desabilitado | `POST /api/auth/register` → 403 |
| Criação de usuários | ✅ | Somente admin (`user:manage`) |
| Sessão atual | ✅ | `GET /api/auth/me` |
| Troca de senha | ✅ | `/change-password`; rate limit |
| Senha fraca no login | ✅ | Flag `password_is_weak` → força troca |
| Rate limit login | ✅ | 10 tentativas / 15 min (por IP + email) |
| Rota protegida (front) | ✅ | `ProtectedRoute` + shell |
| API protegida | ✅ | `requireAuth` + `requirePermission` |

### 3.2 Início / Dashboard (`/dashboard`)

- Anúncio do **território do dia** (localidade, Terr. N.º)
- Ações: desvincular do dia; **Finalizar** (modal com nº de pessoas → histórico + desvincula)
- Lista **Não finalizados** (territórios com quadra incompleta)
- Bloco de **dirigentes de hoje** (datados + fixos), com edição de nome quando permitido
- Link para listagem e dirigentes

### 3.3 Territórios (lista `/territories`)

- Listagem (com `territory:read`)
- Busca por localidade, Terr. N.º (normalizada, sem acentos)
- Indicador de área no mapa (com / sem)
- Marcar / desvincular território do dia (`territory:set_daily`)
- Criar (`territory:create`) — botão ícone **+**
- Ver cartão / editar área (ícones; permissões respectivas)

### 3.4 Finalizados (`/territories/finalizados`)

- Histórico cumulativo de finalizações
- Colunas: dia do campo, horário, dirigente, pessoas, território, registrado por, data/hora
- Busca textual
- Remoção de linha do histórico **apenas admin**

### 3.5 Cartão / detalhe (`/territories/:id`)

- Cabeçalho estilo cartão: Localidade + Terr. N.º
- Mapa em leitura (polígonos, rótulos)
- Seção **NÃO EM CASA**: checklist por casa; confirmação ao desmarcar
- Contador feitos/total; tag **Finalizado**
- Destaque bidirecional mapa ↔ cartão
- Ações condicionadas a permissão (dia, editar, excluir)

### 3.6 Criar / editar território

| Rota | Permissão |
|------|-----------|
| `/territories/new` | `territory:create` |
| `/territories/:id/edit` | `territory:update` **ou** `block:manage` |

- Campos: Localidade, Terr. N.º
- Mapa centrado no CEP do sistema (`TERRITORY_CEP`)
- Desenho de **múltiplas áreas** (FeatureCollection)
- Toolbar do mapa:
  - Travado (padrão) / Desenhar / Concluir área (≥ 3 pontos)
  - Desfazer / Refazer / Apagar áreas
  - Tela cheia / Reenquadrar áreas / Limpar destaque
  - Busca de endereço (geocode) com pin
- Seção NÃO EM CASA na edição: quadra, rua, casas; add/remove; bulk delete; progresso

### 3.7 Dirigentes (`/dirigentes`)

- Designações **datadas** e **fixas** (dia da semana)
- Horário/período (manhã/noite — selects fixos)
- Cards agrupados; “Hoje” em destaque
- CRUD de designações (API autenticada)
- Fuso: `APP_TIMEZONE` / America/Sao_Paulo

### 3.8 Usuários (`/usuarios`) — `user:manage`

- Listar papéis e permissões
- Criar usuário (nome, email, senha forte, papel)
- Alterar papel; excluir (com regras de proteção do último admin)
- Papéis seed: admin, editor, field, viewer

### 3.9 Sobre (`/sobre`)

- Aba **O sistema**: o que é o CAMPO, o que faz, para quem é
- Aba **Atualizações**: versão **v0.0.8** + changelog (GPS multi-usuário, OSM Shortbread, polimento)

### 3.10 UI / UX global

- Design system Apple (`bg-apple-*`, `app-card`, `app-btn-*`, `app-input`, etc.)
- Shell: logo, nav desktop, drawer mobile, usuário, tema, sair
- Tooltips custom (`data-tooltip`) — sem `title` nativo feio
- Tema light/dark (classe `dark` no `html`)
- Preferência de tema **persistida no usuário** (`theme_preference`)
- Confirmações padronizadas em alerta estilo iOS (`confirmToast` via Sonner: info/danger, fundo escurecido)
- Scroll to top
- Login com header, card e tipografia do sistema

### 3.11 Fora de escopo / futuro

- [ ] Upload real de imagens (tabela `territory_images` existe, sem UI completa)
- [ ] CEP por território editável (hoje CEP é global no `.env`)
- [ ] Multi-congregação / multi-tenant
- [ ] CI/CD e pipeline de deploy documentados
- [ ] App mobile nativo

---

## 4. Papéis e permissões (RBAC)

### 4.1 Escopos

| Escopo | Uso |
|--------|-----|
| `territory:create` | Criar território |
| `territory:read` | Listar, ver, dashboard, histórico |
| `territory:update` | Editar território/mapa |
| `territory:delete` | Excluir território |
| `territory:set_daily` | Marcar/desvincular território do dia |
| `block:manage` | CRUD de não em casa / escala de dirigentes |
| `block:check` | Marcar números visitados no checklist do não em casa |
| `user:manage` | Gestão de usuários e papéis |

Admin (`slug = admin` ou `isAdmin`) tem **todos** os escopos implicitamente.

### 4.2 Papéis padrão

| Slug | Nome | Permissões |
|------|------|------------|
| `admin` | Administrador | Todos os escopos |
| `editor` | Editor | create, read, update, set_daily, block:manage, block:check |
| `field` | Campo | read, block:check |
| `viewer` | Visualizador | read |

### 4.3 Enforcement

- **API:** `requirePermission(scope)` / `requireAdmin` / `requireAuth`
- **Front:** `useAuth().can(scope)`, `RequirePermission`, ocultação de botões/menus

---

## 5. Modelo de dados (MySQL)

Banco padrão: **`campo`**. Schema de referência: `migration.sql` + scripts em `scripts/`.

### 5.1 Diagrama lógico (entidades)

```
roles 1──* role_permissions
roles 1──* users
users 1──* territories
territories 1──* blocks
territories 1──* territory_images   (reservado)
territories 0──* territory_finish_history
field_assignments (independente)
```

### 5.2 Tabelas

#### `roles`
- `id`, `slug` (unique), `name`, `description`, `is_system`, `created_at`

#### `role_permissions`
- PK (`role_id`, `permission`)
- FK `role_id` → `roles`

#### `users`
- `id`, `name`, `email` (unique), `password_hash`
- `role_id` → `roles` (nullable, ON DELETE SET NULL)
- `theme_preference` VARCHAR(10) NOT NULL DEFAULT `'light'` — valores: `light` | `dark`  
  *(migração: `npm run migrate:theme` se o banco for antigo)*
- `created_at`

#### `territories`
- `id`, `user_id` → `users`
- `name` (localidade), `number` (Terr. N.º)
- `cep`, `geojson` (LONGTEXT, FeatureCollection), `map_lat`, `map_lng`
- `is_daily` (0/1) — no máximo um “do dia” na prática de negócio (API set/unset)
- `created_at`, `updated_at`

#### `blocks` (NÃO EM CASA)
- `id`, `territory_id` → `territories`
- `name` (nº da quadra), `street_name`
- `house_numbers` JSON — casas
- `completed_houses` JSON — checklist feito
- `sort_order`

#### `territory_finish_history`
- Histórico **cumulativo** (sempre INSERT na finalização; não sobrescreve)
- `territory_id` (nullable se território apagado), `territory_name`, `territory_number`
- `field_date`, `field_time`, `leader_name`, `people_count`
- `finished_by_user_id`, `finished_by_name`, `finished_at`

#### `field_assignments`
- Designações de dirigentes
- `service_date` (datado) **ou** `is_fixed` + `fixed_weekday` (0=Dom … 6=Sáb)
- `weekday_label`, `assignee_name`, `period_label`, `fixed_time`, `sort_order`
- `created_at`, `updated_at`

#### `territory_images`
- Reservado: `territory_id`, `image_url`, `caption`, `sort_order` — **sem fluxo completo na UI atual**

### 5.3 Migrações auxiliares

| Comando | Efeito |
|---------|--------|
| `npm run migrate:rbac` | Roles / permissions / role_id em users |
| `npm run migrate:finish-history` | Tabela `territory_finish_history` |
| `npm run migrate:theme` | Coluna `users.theme_preference` |

---

## 6. API REST

Base: `/api` (proxy Vite em dev; mesma origem em prod).

### 6.1 Config / saúde

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/health` | — | Healthcheck |
| GET | `/api/config/map` | — | Centro do mapa (CEP do `.env`) |
| GET | `/api/config/geocode?q=` | ✅ | Busca endereço → coords (rate limit) |

### 6.2 Auth (`/api/auth`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/register` | — | **403** — cadastro desabilitado |
| POST | `/login` | — | Login; cookie; `password_is_weak?` |
| POST | `/logout` | — | Limpa cookie |
| GET | `/me` | cookie | Usuário + role + permissions + `theme_preference` |
| PUT | `/theme` | ✅ | `{ theme: "light"\|"dark" }` → grava no user |
| POST | `/change-password` | ✅ | Senha atual + nova (forte) |

### 6.3 Territórios (`/api/territories`)

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/` | `territory:read` | Lista |
| GET | `/dashboard` | `territory:read` | Daily + unfinished |
| GET | `/finished-history` | `territory:read` | Histórico |
| DELETE | `/finished-history/:id` | admin | Remove linha do histórico |
| POST | `/` | `territory:create` | Cria |
| GET | `/:id` | `territory:read` | Detalhe |
| PUT | `/:id` | `territory:update` | Atualiza |
| DELETE | `/:id` | `territory:delete` | Exclui |
| POST | `/:id/daily` | `territory:set_daily` | Marca do dia |
| DELETE | `/:id/daily` | `territory:set_daily` | Desvincula |
| POST | `/:id/finish` | (fluxo dia) | Finaliza → history + unsets daily |
| GET/POST | `/:id/blocks` | read / `block:manage` | Lista / cria |
| PATCH | `/:id/blocks/:blockId/houses` | `block:check` | Marca/desmarca número no checklist |
| PUT/DELETE | blocks… | `block:manage` | Atualiza / remove |
| POST | bulk delete blocks | `block:manage` | Exclusão em massa |

*(Rotas exatas de blocks: ver `server/routes/territories.ts`.)*

### 6.4 Dirigentes (`/api/field-assignments`)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/` | ✅ | Lista todas |
| GET | `/today` | ✅ | Designações de hoje (datadas + fixas) |
| POST | `/` | ✅ | Cria |
| PUT | `/:id` | ✅ | Atualiza |
| DELETE | `/:id` | ✅ | Remove |

### 6.5 Usuários (`/api/users`)

Todas exigem `user:manage`:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/roles` | Papéis + permissões |
| GET | `/` | Lista usuários |
| POST | `/` | Cria |
| PUT | `/:id` | Atualiza (papel, etc.) |
| DELETE | `/:id` | Remove |

---

## 7. Frontend — rotas e páginas

| Rota | Página | Guard |
|------|--------|-------|
| `/` | Redirect login ou dashboard | — |
| `/login` | Login | público |
| `/register` | Redirect → login | — |
| `/change-password` | Troca de senha | autenticado (pode forçar) |
| `/dashboard` | Início | autenticado |
| `/territories` | Lista | shell + can read implícito via API |
| `/territories/finalizados` | Finalizados | `territory:read` |
| `/territories/new` | Novo | `territory:create` |
| `/territories/:id` | Cartão | autenticado |
| `/territories/:id/edit` | Editar | `territory:update` \| `block:manage` |
| `/dirigentes` | Escala | autenticado |
| `/usuarios` | RBAC UI | `user:manage` |
| `/sobre` | Sobre + versão | autenticado |

### 7.1 Componentes principais

| Path | Função |
|------|--------|
| `AppShell` | Layout, menu desktop/mobile, tema, logout |
| `TerritoryMap` | Mapa interativo (draw, fullscreen, geocode…) |
| `ProtectedRoute` | Auth + shell + troca de senha forçada |
| `RequirePermission` | Gate de escopo |
| `confirm-toast` | Confirmações padronizadas (Sonner) |
| `theme-context` | Aplica tema; sincroniza com user + API |
| `auth-context` | Sessão, `can()`, admin |

---

## 8. Tema (dark / light)

1. Coluna `users.theme_preference` (`light` | `dark`, default `light`).
2. Login / `GET /me` devolve a preferência; o front aplica (`class="dark"` no `html`).
3. Toggle no shell/login: se autenticado → `PUT /api/auth/theme` e atualiza o usuário em memória.
4. Sem sessão (login): cache local (`campo-theme-guest` / `campo-theme`).
5. Tokens CSS: variáveis `--apple-*` em `:root` e `.dark` (`src/index.css` + `tailwind.config.ts`).

---

## 9. Segurança

| Controle | Implementação |
|----------|----------------|
| Senha | bcrypt; política forte na troca e criação admin |
| Sessão | JWT assinado; cookie httpOnly; duração `JWT_EXPIRES` (padrão 12h) |
| Produção | `JWT_SECRET` ≥ 32 chars obrigatório |
| Cookie Secure | Configurável (`COOKIE_SECURE`); false em HTTP/LAN |
| SQL | Prepared statements |
| Rate limit | Login, change-password, geocode |
| Cadastro público | Desabilitado |
| RBAC | Server-side é a fonte da verdade; front só esconde UI |
| CORS | `VITE_APP_URL` + credentials |

**Não commitar** `.env`.

---

## 10. Configuração (`.env`)

| Variável | Uso |
|----------|-----|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL |
| `JWT_SECRET` | Assinatura JWT |
| `JWT_EXPIRES` | Ex.: `12h`, `1d` |
| `PORT` | Porta da API (padrão 3001) |
| `VITE_APP_URL` | Origin do front (CORS). Produção: `https://analp.tec.br` |
| `COOKIE_SECURE` | `true` só com HTTPS (produção em analp.tec.br) |
| Domínio público | **https://analp.tec.br** — Cloudflare Tunnel para o serviço Node |
| `APP_TIMEZONE` | Ex.: `America/Sao_Paulo` |
| `TERRITORY_CEP` | CEP base do mapa |

---

## 11. Scripts e deploy

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Vite + API |
| `npm run build` | Typecheck + build web + compile server |
| `npm start` | Produção: API + static `dist` + SPA fallback |
| `npm run migrate:rbac` | RBAC |
| `npm run migrate:finish-history` | Histórico |
| `npm run migrate:theme` | Tema por usuário |

Produção Express 5: `GET /{*path}` → `index.html`.

---

## 12. Estrutura de pastas (resumo)

```
campo/
├── src/                 # React SPA
│   ├── pages/
│   ├── components/      # layout, Map, ui, guards
│   └── lib/             # api, auth, theme, permissions, types
├── server/
│   ├── routes/          # auth, territories, field-assignments, users
│   ├── lib/             # db, rbac, load-user, finish-history, auth…
│   └── middleware/      # requireAuth, requirePermission, rateLimit
├── scripts/             # migrações auxiliares
├── public/logo.webp
├── migration.sql
├── package.json         # version 0.0.7
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
  → visível em /territories/finalizados
```

### 13.3 Checklist NÃO EM CASA

```
Editar/cartão → blocks (quadra/rua/casas)
  → PATCH completed_houses
  → todas as casas feitas → visual “finalizado”
  → desmarcar → confirmação padrão (confirmToast)
```

---

## 14. Changelog resumido (v0.0.8)

Alinhado à aba **Sobre → Atualizações** no produto:

1. **v0.0.8** — GPS multi-usuário no mapa (presença com nome/cor); OSM Shortbread vetorial; limites de zoom da cidade; toasts unificados; validação PT-BR  
2. **v0.0.7** — confirmações padronizadas em alerta iOS; gestão de usuários (papel/senha forte); escala por data  
3. **v0.0.6.2** — lista por Terr. N.º; toggle asc/desc; tooltips 40 chars  
4. **v0.0.6.1** — rota de carro; pan livre com GPS; voltar ao GPS/quadras  
5. **v0.0.6** — GPS; notas; match exato  

---

## 15. Critérios de aceite (regressão v0.0.8)

- [ ] GPS multi-usuário: posição de quem está com GPS ativo aparece no mapa com nome e cor próprias  
- [ ] Basemap OSM Shortbread (vetorial) ativo no fallback do Google Maps  
- [ ] Zoom e pan limitados à região do CEP (Alpinópolis)  
- [ ] Toasts Sonner unificados (caixas quadradas, cores padrão, X interno); validação em PT-BR  
- [ ] Sobre com **v0.0.8**  

---

## 16. Histórico do documento

| Versão doc | Data | Notas |
|------------|------|--------|
| 1.x–2.x | 2025–2026 | Versões iniciais (Next/legado) |
| 3.0 | 02/08/2026 | SPA Vite; território do dia; não em casa |
| 4.0 | 03/08/2026 | Estado real v0.0.4 |
| 5.0 | 04/08/2026 | v0.0.5: Google Maps; analp.tec.br |
| 5.1 | 05/08/2026 | v0.0.5.1: imagem do cartão; seleção por id |
| 6.0 | 05/08/2026 | v0.0.6: GPS, rota, notas, match exato |
| 6.1 | 05/08/2026 | v0.0.6.1: carro, pan livre, voltar ao GPS |
| 6.2 | 05/08/2026 | v0.0.6.2: ordenação N.º; tooltips compactos |
| 7.0 | 07/08/2026 | v0.0.7: confirmações padronizadas; usuários (papel/senha); escala por data |
| **8.0** | **07/08/2026** | **v0.0.8:** GPS multi-usuário; OSM Shortbread; zoom da cidade; toasts/PT-BR |

---

*Fim do SDD — CAMPO v0.0.8*
