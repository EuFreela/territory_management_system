# CAMPO

**Sistema de gestão de territórios de campo** · Congregação Alpinópolis

**Versão:** [`v0.0.8`](https://github.com/EuFreela/territory_management_system/releases/tag/v0.0.8)

**Produção:** [https://analp.tec.br](https://analp.tec.br)

Aplicação web para planejar, acompanhar e registrar o trabalho de campo: cartões de território no mapa, checklist de casas (não em casa), escala de dirigentes, território do dia, histórico de finalizações e controle de acesso por papéis.

---

## Sobre

O **CAMPO** centraliza o que antes ficava em planilhas e papel:

| Área | O que faz |
|------|-----------|
| **Territórios** | Localidade, Terr. N.º, áreas no mapa (GeoJSON), busca de endereço |
| **Território do dia** | Destaque no Início; finalizar com contagem de pessoas e histórico |
| **Não em casa** | Quadras, ruas, casas e checklist; status finalizado |
| **Dirigentes** | Escala com dias, horários e card de “hoje” (fuso `America/Sao_Paulo`) |
| **Finalizados** | Histórico de finalizações (busca; remoção só admin) |
| **Usuários (RBAC)** | Papéis admin, editor, campo e visualizador com permissões |
| **Sobre** | Descrição do sistema + changelog da versão |
| **Tema** | Light/dark salvo **por usuário** no banco |

Interface no estilo Apple (tokens, menu responsivo, tooltips, dark mode).

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Vite 7, React 19, React Router 7, Tailwind CSS 3 |
| API | Express 5, TypeScript (`tsx`) |
| Banco | MySQL (`mysql2`) |
| Auth | JWT (`jose`) + cookie httpOnly |
| Mapa | Leaflet + react-leaflet + Google Maps (basemap) |
| Validação | Zod |

---

## Pré-requisitos

- Node.js **20+**
- MySQL **8+**
- npm

---

## Configuração

### 1. Clone e instale

```bash
git clone https://github.com/EuFreela/territory_management_system.git
cd territory_management_system
npm install
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Principais variáveis:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=campo

# Obrigatório em produção: mín. 32 caracteres aleatórios
JWT_SECRET=gere-uma-chave-longa-aleatoria-com-pelo-menos-32-chars
JWT_EXPIRES=12h

PORT=3001
VITE_APP_URL=http://localhost:3000

# Google Maps no Leaflet (Maps JavaScript API no Google Cloud)
VITE_GOOGLE_MAPS_API_KEY=sua_chave_google_maps

# true só com HTTPS; false em HTTP local/LAN
# COOKIE_SECURE=false

APP_TIMEZONE=America/Sao_Paulo

# CEP base do mapa (região de trabalho)
TERRITORY_CEP=37940-000
```

### 3. Banco de dados

Schema inicial:

```bash
mysql -u root -p < migration.sql
```

Migrações auxiliares (se o banco já existia):

```bash
npm run migrate:rbac              # papéis e permissões
npm run migrate:finish-history    # histórico de finalizações
npm run migrate:theme             # preferência light/dark por usuário
```

Crie o primeiro administrador (senha forte aleatória, exibida uma única vez):

```bash
npm run create:admin
```

> O `migration.sql` **não** cria usuário com senha padrão conhecida. Sem `create:admin` não há como logar.

Opcional — seed da escala de dirigentes:

```bash
node scripts/setup-field-leaders.js
```

### 4. Desenvolvimento

```bash
npm run dev
```

| Serviço | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |

O Vite faz proxy de `/api` → API.

### 5. Produção

```bash
npm run build
npm start
```

A API serve o frontend buildado (`dist`) e o fallback SPA (Express 5).

#### Domínio de produção

| Item | Valor |
|------|--------|
| URL pública | **https://analp.tec.br** |
| App (origin) | `VITE_APP_URL=https://analp.tec.br` |
| Cookie HTTPS | `COOKIE_SECURE=true` |
| Google Maps (chave) | Restringir referrer a `https://analp.tec.br/*` |
| Túnel / exposição | Cloudflare Tunnel → serviço local (ex.: porta da API / `npm start`) |

Exemplo de trecho do `.env` na VM:

```env
VITE_APP_URL=https://analp.tec.br
COOKIE_SECURE=true
VITE_GOOGLE_MAPS_API_KEY=sua_chave
```

Após alterar `VITE_*`, rode **`npm run build`** e reinicie o processo Node.

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Frontend + API em paralelo |
| `npm run dev:web` | Só Vite |
| `npm run dev:server` | Só API |
| `npm run build` | Typecheck + build web + compile server |
| `npm start` | API em produção (serve `dist`) |
| `npm run migrate:rbac` | Migração RBAC |
| `npm run migrate:finish-history` | Tabela de histórico de finalizações |
| `npm run migrate:theme` | Coluna `theme_preference` em `users` |
| `npm run migrate:daily-per-leader` | Coluna `daily_assignment_id` em `territories` (território do dia por dirigente) |
| `npm run create:admin` | Cria o primeiro administrador com senha aleatória |

---

## Estrutura

```
campo/
├── src/                    # Frontend (React + Vite)
│   ├── pages/              # Login, Início, Territórios, Dirigentes, Usuários, Sobre…
│   ├── components/         # Shell, mapa, UI, guards de permissão
│   └── lib/                # API client, auth, tema, tipos
├── server/                 # API Express
│   ├── routes/             # auth, territories, field-assignments, users
│   ├── lib/                # DB, JWT, RBAC, finish-history…
│   └── middleware/         # auth, permissões, rate limit
├── scripts/                # Migrações auxiliares
├── public/logo.webp        # Logo do sistema
├── migration.sql           # Schema inicial MySQL
└── package.json
```

---

## Funcionalidades

### Autenticação e segurança

- Login com JWT em cookie httpOnly (cadastro **público desabilitado**)
- Senha forte; troca obrigatória se a senha atual for fraca (`/change-password`)
- Rate limit em login e troca de senha
- Contas criadas apenas pelo administrador

### Territórios e mapa

- Cartões com localidade e Terr. N.º
- Desenho de áreas, tela cheia, reenquadrar, desfazer/refazer
- Busca de endereço (Nominatim) com pin no mapa
- CEP global via `TERRITORY_CEP`

### Território do dia e finalizados

- Marcar / desvincular território do dia
- Finalizar com quantidade de pessoas → histórico cumulativo
- Página **Finalizados** com busca e exclusão (admin)

### Não em casa

- Quadra, rua e números das casas
- Checklist por casa (confirmação ao desmarcar)
- Destaque mapa ↔ cartão; status finalizado

### Dirigentes

- Escala por dia da semana e data específica
- Horários (manhã/noite), card de “hoje” no topo

### RBAC

| Papel | Resumo |
|-------|--------|
| **admin** | Acesso total + usuários |
| **editor** | Territórios e checklist (sem excluir nem gerir usuários) |
| **field** | Leitura, território do dia e checklist |
| **viewer** | Somente leitura de territórios |

### Tema

Preferência **light/dark** gravada em `users.theme_preference` (por conta). Na tela de login (sem sessão) usa cache local do dispositivo.

---

## Segurança (checklist)

- Não commite o arquivo `.env`
- Use `JWT_SECRET` forte (≥ 32 caracteres) em produção
- `COOKIE_SECURE=true` apenas com HTTPS
- Senhas com bcrypt; SQL com prepared statements

---

## Changelog (v0.0.8)

Resumo das entregas desta versão (detalhes também em **Sobre → Atualizações** no app):

- GPS multi-usuário no mapa: quem está logado com GPS ativo aparece com nome e cor própria
- Basemap OpenStreetMap Shortbread (vetorial via MapLibre) no fallback do Google Maps
- Zoom e navegação limitados à região do CEP (Alpinópolis)
- Toasts Sonner unificados (caixas quadradas, cores padrão, X interno) em todo o app
- Validação em português (PT-BR) e campo de senha polido em Usuários
- Lista de finalizados sem scrollbar e tooltips legíveis

### Histórico (v0.0.7)

- Confirmações padronizadas em alerta estilo iOS; gestão de usuários (RBAC); escala por data

### Histórico (v0.0.6.2)

- Lista de territórios por **Terr. N.º** com toggle crescente/decrescente
- Tooltips compactos (1 linha, máx. 40 caracteres)

### Histórico (v0.0.6.1)

- Rota de carro; pan livre com GPS; voltar ao GPS ou às quadras

Tag no repositório: [`v0.0.8`](https://github.com/EuFreela/territory_management_system/releases/tag/v0.0.8)

---

## Licença

Projeto privado / sob demanda. Ajuste conforme o acordo do freela.

---

## Autor

Desenvolvido para gestão de territórios de campo das Testemunhas de Jeová · Congregação Alpinópolis.
