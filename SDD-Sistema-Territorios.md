# SDD — Campo (Sistema de Territórios)

**Produto:** Campo  
**Versão do documento:** 3.0  
**Data:** 02/08/2026  
**Status:** Implementado (v2.x do código)  
**Objetivo:** Especificação oficial e atualizada do que o sistema faz, como está estruturado e como evoluir.

---

## 1. Visão Geral

**Campo** é um sistema web para **gestão de cartões de território de campo**:

- Localidade e Terr. N.º (como no cartão impresso)
- Mapa com áreas desenhadas (polígonos)
- Registros de **NÃO EM CASA** (quadra, rua, casas)
- Checklist de casas já trabalhadas
- **Território do dia** e lista de **Não finalizados**

### Público
Usuários autenticados (irmãos / responsáveis) que trabalham e acompanham territórios.

### Fase atual
| Item | Valor |
|------|--------|
| Banco | MySQL local |
| Nome do banco (padrão) | `campo` (configurável via `.env`) |
| Frontend | Vite + React SPA |
| Backend | Express + TypeScript |
| Deploy | Não obrigatório nesta fase |

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Motivo |
|--------|------------|--------|
| Frontend | **Vite 7** + **React 19** | Dev rápido (substituindo Next.js) |
| Roteamento | **React Router 7** | SPA |
| Estilo | **Tailwind CSS 3** | UI rápida e consistente |
| API | **Express 5** + **tsx** | REST Node |
| Linguagem | **TypeScript** | Tipagem |
| Banco | **MySQL** + **mysql2** | Persistência local |
| Auth | **JWT** (`jose`) + cookie `httpOnly` | Sessão |
| Senha | **bcryptjs** | Hash |
| Mapa | **Leaflet** + **react-leaflet** | Polígonos |
| Validação | **Zod 4** | Schemas API |
| CEP → coords | BrasilAPI (+ fallback Nominatim) | Centralizar mapa |

> **Não usar** Google Maps.  
> **Não usar** Next.js nesta versão (lentidão no dev Windows).

---

## 3. Funcionalidades Implementadas

### 3.1 Autenticação
- [x] Registro (nome, email, senha ≥ 6)
- [x] Login (JWT em cookie `auth_token`)
- [x] Logout
- [x] Rota protegida no frontend (`ProtectedRoute`)
- [x] Proteção nas APIs (`requireAuth`)
- [x] Após login → `/dashboard`

### 3.2 Dashboard (`/dashboard`)
- [x] Anúncio **compacto** do Território do Dia (localidade, Terr. N.º)
- [x] Clique no card → cartão do território
- [x] Botão **Desvincular** (ícone) com modal de confirmação
- [x] Lista **Não finalizados** — territórios com ≥ 1 quadra de não em casa incompleta
- [x] Contagem de quadras pendentes e casas faltando
- [x] Link para listagem de territórios
- [x] **Sem** listagem completa de todos os territórios no dashboard

### 3.3 Territórios (lista `/territories`)
- [x] Listar territórios do usuário
- [x] Busca por localidade, Terr. N.º, CEP (sem acentos)
- [x] Criar / ver cartão / editar
- [x] Marcar como território do dia (ícone estrela)
- [x] Desvincular do dia (ícone unlink)
- [x] Indicador de área no mapa (com / sem)
- [x] Botões de ação **somente ícones** + `title`/`aria-label`

### 3.4 Cartão de território (detalhe `/territories/:id`)
- [x] Cabeçalho estilo cartão: **Localidade** + **Terr. N.º**
- [x] Mapa em modo leitura com polígonos e rótulos
- [x] Seção **NÃO EM CASA** com checklist clicável
- [x] Marcar/desmarcar casa como feita
- [x] Contador `feitos/total` e tag **Finalizado**
- [x] Quadra finalizada com visual desbotado
- [x] Ações: marcar/desvincular dia, editar, excluir, voltar (ícones)

### 3.5 Criar / Editar território
- [x] Campos: **Localidade** (não “Nome”) e **Terr. N.º**
- [x] Mapa com CEP global (`TERRITORY_CEP` no `.env`)
- [x] Desenho de **múltiplas áreas** (FeatureCollection)
- [x] Toolbar de ícones no mapa:
  - 🔒 Travado (padrão — não desenha)
  - ✏️ Desenhar
  - ✓ Concluir área (≥ 3 pontos)
  - ↩ Desfazer ponto/área
  - 🗑 Limpar áreas
- [x] Nome/texto em cada área (rótulo no centro do polígono)
- [x] Zoom/câmera **não resetam** ao clicar pontos
- [x] Rótulos legíveis (pill âmbar, texto escuro, largura dinâmica)
- [x] Salvar exige ≥ 1 área válida
- [x] Seção **NÃO EM CASA** na edição:
  - N.º da quadra
  - Nome da rua
  - Números das casas
  - Add (ícone +) / Remover (ícone lixeira)
  - Progresso do checklist (somente leitura na edição)

### 3.6 UI / UX global
- [x] Modal de confirmação estilizado (substitui `confirm`/`alert`)
  - Tons: default, warning, danger
  - Esc / clique fora cancela
- [x] Botão Voltar com ícone de seta
- [x] Botões Salvar / Adicionar como ícones

### 3.7 Fora de escopo atual (planejado / futuro)
- [ ] Upload real de imagens (existe tabela `territory_images`)
- [ ] CEP por território (hoje CEP é global no `.env`)
- [ ] Multi-região / multi-congregação
- [ ] Deploy produção documentado em CI

---

## 4. Modelo de Dados (MySQL)

Banco padrão: **`campo`** (ou `DB_NAME` no `.env`).

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE territories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,              -- Localidade (ex: Mundo Novo)
  number VARCHAR(50) NULL,               -- Terr. N.º (ex: 31)
  cep VARCHAR(9) NULL,                   -- Cópia do CEP do sistema no save
  geojson LONGTEXT NULL,                 -- FeatureCollection de áreas
  map_lat DECIMAL(10,7) NULL,
  map_lng DECIMAL(10,7) NULL,
  is_daily TINYINT(1) DEFAULT 0,         -- 1 = território do dia
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  territory_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,             -- N.º da quadra
  street_name VARCHAR(180) NULL,          -- Nome da rua
  house_numbers JSON NOT NULL,            -- ["101","103"]
  completed_houses JSON NULL,             -- casas já trabalhadas
  sort_order INT DEFAULT 0,
  FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE territory_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  territory_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255) NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (territory_id) REFERENCES territories(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### Regras de negócio
1. Apenas **um** território por usuário com `is_daily = 1`
2. Ao marcar diário: zerar os outros e setar o escolhido
3. Ao desvincular: `is_daily = 0` no território
4. `geojson` obrigatório ao criar/atualizar território (≥ 1 polígono válido)
5. Checklist: `completed_houses` ⊆ `house_numbers`
6. Quadra **finalizada** quando todas as casas estão em `completed_houses`
7. Território em **Não finalizados** se tem ≥ 1 block com `is_finished = false`
8. CEP do mapa vem de **`TERRITORY_CEP`** no `.env` (global nesta versão)

### Arquivo de migração
- Schema completo: `migration.sql`
- RBAC (se DB antigo): `npm run migrate:rbac` (`scripts/migrate-rbac.js`)
- Seed dirigentes (opcional): `scripts/setup-field-leaders.js`

---

## 5. Formato do GeoJSON (áreas no mapa)

Salvo em `territories.geojson` como **FeatureCollection**:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "area-…",
      "properties": {
        "label": "Quadra1",
        "name": "Quadra1"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], …, [lng, lat]]]
      }
    }
  ]
}
```

- Compatível com Feature única / Polygon legado na leitura
- Rótulo exibido no centróide da área

---

## 6. Estrutura de Pastas

```
campo/
├── index.html
├── vite.config.ts              # proxy /api → :3001
├── package.json
├── migration.sql
├── README.md
├── SDD-Sistema-Territorios.md  # este documento
├── .env.example
├── .gitignore
├── scripts/                    # migrações auxiliares
├── server/
│   ├── index.ts                # Express app
│   ├── lib/
│   │   ├── auth.ts             # JWT sign/verify
│   │   ├── db.ts               # pool mysql2
│   │   ├── cep.ts              # geocode CEP
│   │   ├── map-config.ts       # TERRITORY_CEP cache
│   │   └── validations.ts      # Zod
│   ├── middleware/
│   │   └── requireAuth.ts
│   └── routes/
│       ├── auth.ts
│       └── territories.ts
└── src/
    ├── main.tsx
    ├── App.tsx                 # rotas
    ├── index.css
    ├── components/
    │   ├── ProtectedRoute.tsx
    │   ├── ui/ConfirmModal.tsx
    │   └── Map/
    │       ├── TerritoryMap.tsx
    │       └── mapIcons.tsx
    ├── lib/
    │   ├── api.ts
    │   ├── auth-context.tsx
    │   └── types.ts
    └── pages/
        ├── LoginPage.tsx
        ├── RegisterPage.tsx
        ├── DashboardPage.tsx
        ├── TerritoriesPage.tsx
        ├── NewTerritoryPage.tsx
        ├── TerritoryDetailPage.tsx
        └── EditTerritoryPage.tsx
```

---

## 7. Rotas Frontend

| Path | Auth | Página |
|------|------|--------|
| `/` | — | Redirect login ou dashboard |
| `/login` | público | Login |
| `/register` | público | Cadastro |
| `/dashboard` | sim | Território do dia + Não finalizados |
| `/territories` | sim | Lista + busca |
| `/territories/new` | sim | Criar + desenhar áreas |
| `/territories/:id` | sim | Cartão + checklist |
| `/territories/:id/edit` | sim | Editar + não em casa |

---

## 8. API REST

Base: `/api`  
Auth: cookie `auth_token` (exceto register/login)

### Auth
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastro |
| POST | `/api/auth/login` | Login + cookie |
| POST | `/api/auth/logout` | Limpa cookie |
| GET | `/api/auth/me` | Usuário atual |

### Config / saúde
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Healthcheck |
| GET | `/api/config/map` | CEP global + lat/lng/label |

### Territórios
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/territories` | Lista do usuário |
| GET | `/api/territories/dashboard` | daily + unfinished + user |
| POST | `/api/territories` | Cria (localidade, número, geojson) |
| GET | `/api/territories/:id` | Detalhe + blocks mapeados |
| PUT | `/api/territories/:id` | Atualiza |
| DELETE | `/api/territories/:id` | Exclui |
| POST | `/api/territories/:id/daily` | Marca território do dia |
| DELETE | `/api/territories/:id/daily` | Desvincula do dia |

### Não em casa (blocks)
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/territories/:id/blocks` | Lista |
| POST | `/api/territories/:id/blocks` | Cria (quadra, rua, casas) |
| PATCH | `/api/territories/:id/blocks/:blockId/houses` | Checklist `{ house_number, done }` |
| DELETE | `/api/territories/:id/blocks/:blockId` | Remove registro |

### Payload do checklist
```json
{ "house_number": "101", "done": true }
```

### Resposta de block (mapeada)
```json
{
  "id": 1,
  "name": "1",
  "street_name": "Rua Bahia",
  "house_numbers": ["101", "103"],
  "completed_houses": ["101"],
  "done_count": 1,
  "total": 2,
  "is_finished": false
}
```

### Dashboard `unfinished`
Territórios com ≥ 1 block `is_finished === false`, incluindo:
- `unfinished_blocks`
- `total_blocks`
- `pending_houses`

---

## 9. Variáveis de Ambiente

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=campo
JWT_SECRET=
PORT=3001
VITE_APP_URL=http://localhost:3000
TERRITORY_CEP=37940-000
```

| Variável | Uso |
|----------|-----|
| `TERRITORY_CEP` | CEP único do sistema; centraliza o mapa e grava lat/lng ao salvar território |
| `PORT` | Porta da API Express |
| `VITE_APP_URL` | Origin CORS do frontend |

> Reiniciar `npm run dev` após alterar `.env`.

---

## 10. Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Vite (:3000) + API (:3001) |
| `npm run dev:web` | Só frontend |
| `npm run dev:server` | Só API |
| `npm run build` | Build SPA + compile server |
| `npm start` | Produção (API + static `dist`) |

---

## 11. Fluxos Principais

### 11.1 Login
1. POST `/api/auth/login`  
2. Cookie `auth_token`  
3. Redirect `/dashboard`

### 11.2 Criar território
1. Localidade + Terr. N.º  
2. Mapa no CEP do `.env`  
3. 🔒 → ✏️ → cliques → ✓ (nome da área)  
4. Repetir áreas se necessário  
5. 💾 Salvar → grava FeatureCollection + CEP/coords  

### 11.3 Não em casa + checklist
1. Em **Editar**: cadastrar quadra + rua + casas  
2. No **Cartão**: clicar casas para marcar feito  
3. 100% → tag Finalizado + visual desbotado  
4. Dashboard **Não finalizados** atualiza  

### 11.4 Território do dia
1. Marcar na lista ou no cartão  
2. Aparece compacto no dashboard  
3. Desvincular via ícone + modal  

---

## 12. Segurança

- [x] bcrypt (salt ≥ 10)
- [x] JWT assinado (`jose`)
- [x] Cookie httpOnly, sameSite=lax, secure em produção
- [x] Prepared statements
- [x] Validação Zod
- [x] `.env` no `.gitignore`
- [x] Ownership: território/blocks só do `user_id` autenticado

---

## 13. Critérios de Aceitação (estado atual)

- [x] Registrar e logar  
- [x] Dashboard após login  
- [x] Criar território com área no mapa  
- [x] Múltiplas áreas com rótulo legível  
- [x] Mapa travado por padrão; desenho só com lápis  
- [x] Zoom estável ao desenhar  
- [x] Não em casa com rua  
- [x] Checklist de casas  
- [x] Finalizado / desbotado  
- [x] Não finalizados no dashboard  
- [x] Território do dia compacto + desvincular  
- [x] Busca em `/territories`  
- [x] Modais de confirmação  
- [x] Ícones nas ações principais  
- [x] Dados no MySQL  

---

## 14. Histórico de decisões

| Decisão | Motivo |
|---------|--------|
| Migrar Next → Vite + Express | Dev extremamente lento no Windows com Next |
| JWT com `jose` | Compatibilidade e edge/crypto moderno |
| CEP global no `.env` | Um território/região na fase atual |
| FeatureCollection multi-área | Vários “quadros” no mesmo cartão |
| Checklist em `completed_houses` | Progresso sem apagar a lista original |
| Dashboard só diário + não finalizados | UI limpa; lista completa em `/territories` |
| Modal custom | UX melhor que `window.confirm` |

---

## 15. Observações para o Agente / Desenvolvedor

1. Preferir ícones (`mapIcons.tsx`) a texto em ações secundárias.  
2. Confirmações destrutivas: `useConfirm()` do `ConfirmModal`.  
3. Mapa: não chamar `setView`/`fitBounds` durante o desenho.  
4. Zod 4 usa `error.issues`, não `error.errors`.  
5. Após mudar `.env`, reiniciar processos.  
6. Manter este SDD alinhado ao código em mudanças de domínio.  

---

**Fim do SDD v3.0 — Campo**

Este documento reflete o sistema **como implementado**.  
Qualquer divergência futura deve atualizar este arquivo junto com o código.
