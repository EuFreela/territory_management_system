# SDD — Sistema de Territórios (Spec para Agente)

**Versão:** 2.0  
**Data:** 02/08/2026  
**Objetivo:** Documento de especificação completo para o agente (Grok CLI) implementar o sistema do zero.

---

## 1. Visão Geral do Sistema

Sistema web para **catalogação e gerenciamento de territórios**.

Após o login, o usuário acessa uma área autenticada onde pode:
- Criar e editar territórios
- Desenhar regiões no mapa usando **Leaflet.js**
- Definir **quadras** e **números das casas** de cada quadra
- Associar imagens (do sistema público de imagens)
- Visualizar o **“Território do Dia”** na home autenticada

### Fase atual (v2.0)
- Banco de dados: **MySQL local** (`campo`)
- Frontend: **Vite + React + React Router** (rápido no dev)
- Backend: **Express + TypeScript** (API REST)
- Deploy futuro: frontend estático + API Node (ou Vercel + host de API)

> **Importante:** Nesta fase o banco é **local (MySQL)**.

---

## 2. Stack Tecnológica (Obrigatória)

| Camada              | Tecnologia                          | Motivo |
|---------------------|-------------------------------------|--------|
| Frontend            | **Vite 7** + React 19               | HMR instantâneo, dev muito mais rápido que Next |
| Roteamento SPA      | **React Router**                    | Rotas client-side |
| API                 | **Express 5** + `tsx`               | Backend Node simples e rápido |
| Linguagem           | TypeScript                          | Tipagem forte |
| Banco de Dados      | **MySQL** (local)                   | Banco `campo` |
| Cliente DB          | `mysql2` (promises)                 | Driver performático |
| Autenticação        | JWT (`jose`) + cookie httpOnly      | Simples e seguro |
| Hash de senha       | `bcryptjs`                          | Padrão |
| Mapas               | **Leaflet.js** + `react-leaflet`    | Polígonos de territórios |
| Estilização         | Tailwind CSS                        | Rápido e moderno |
| Validação           | Zod                                 | API + formulários |

> **Não usar** Google Maps. Usar **apenas Leaflet.js**.  
> **Não usar Next.js** nesta versão (v2) por lentidão no dev Windows.

---

## 3. Funcionalidades Principais

### 3.1 Autenticação
- Registro, login, logout
- Cookie `auth_token` httpOnly
- Rotas protegidas no frontend (`ProtectedRoute`)
- Após login → `/dashboard`

### 3.2 Dashboard
- Território do Dia (com quadras)
- Lista rápida de territórios
- Link para gerenciar

### 3.3 Territórios
- Listar / criar / editar / excluir
- Marcar **Território do Dia** (um por usuário)
- Mapa Leaflet (polígono)
- Quadras + números de casas

---

## 4. Modelo de Dados (MySQL - banco `campo`)

Ver `migration.sql` (inalterado na essência):

- `users`
- `territories` (`geojson` LONGTEXT, `is_daily`)
- `blocks` (`house_numbers` JSON)
- `territory_images`

**Regras:**
- Apenas um `is_daily = 1` por usuário
- Prepared statements sempre

---

## 5. Estrutura de Pastas

```
/
├── index.html
├── vite.config.ts
├── src/                          # Frontend Vite
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── ProtectedRoute.tsx
│   │   └── Map/TerritoryMap.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth-context.tsx
│   │   └── types.ts
│   └── pages/
│       ├── LoginPage.tsx
│       ├── RegisterPage.tsx
│       ├── DashboardPage.tsx
│       ├── TerritoriesPage.tsx
│       ├── NewTerritoryPage.tsx
│       ├── TerritoryDetailPage.tsx
│       └── EditTerritoryPage.tsx
├── server/                       # API Express
│   ├── index.ts
│   ├── lib/db.ts | auth.ts | validations.ts
│   ├── middleware/requireAuth.ts
│   └── routes/auth.ts | territories.ts
├── migration.sql
└── package.json
```

---

## 6. API REST

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/register` | não | Cadastro |
| POST | `/api/auth/login` | não | Login + cookie |
| POST | `/api/auth/logout` | não | Limpa cookie |
| GET | `/api/auth/me` | sim | Usuário atual |
| GET | `/api/territories` | sim | Lista |
| GET | `/api/territories/dashboard` | sim | Dashboard data |
| POST | `/api/territories` | sim | Cria |
| GET | `/api/territories/:id` | sim | Detalhe + blocks |
| PUT | `/api/territories/:id` | sim | Atualiza |
| DELETE | `/api/territories/:id` | sim | Exclui |
| POST | `/api/territories/:id/daily` | sim | Marca diário |
| GET/POST | `/api/territories/:id/blocks` | sim | Quadras |

**Dev:** Vite em `:3000` faz proxy de `/api` → Express `:3001`.

---

## 7. Scripts

```bash
npm run dev          # Vite + API (concurrently)
npm run dev:web      # só frontend
npm run dev:server   # só API
npm run build        # build frontend + compile server
npm start            # API servindo dist (produção)
```

---

## 8. Variáveis de Ambiente

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=campo
JWT_SECRET=uma-chave-super-secreta-longa-e-aleatoria
PORT=3001
VITE_APP_URL=http://localhost:3000
```

---

## 9. Critérios de Aceitação

- [ ] Registrar e logar
- [ ] Dashboard após login
- [ ] Criar / editar / excluir território
- [ ] Desenhar polígono no Leaflet
- [ ] Adicionar quadras com números
- [ ] Marcar Território do Dia
- [ ] Dados no MySQL `campo`
- [ ] Rotas protegidas
- [ ] Dev rápido com Vite (sem recompilação lenta do Next)

---

## 10. Observações

1. Frontend é SPA; proteção de rotas no client + JWT na API.
2. Mapa é client-only (Leaflet).
3. GeoJSON como string no MySQL.
4. Banco local nesta fase.
5. Performance de dev é prioridade (por isso Vite em vez de Next).

---

**Fim do SDD v2.0**
