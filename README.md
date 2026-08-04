# Campo

**Sistema de gestão de territórios de campo**

**Versão:** `v0.0.0`

Aplicação web para catalogar cartões de território: localidade, mapa, áreas desenhadas, registros de **não em casa** e checklist do que já foi feito.

---

## Sobre

> Release inicial do produto: **v0.0.0**.

O **Campo** ajuda a organizar o trabalho de campo com:

- Cadastro de territórios (localidade + Terr. N.º)
- Mapa interativo (Leaflet) com desenho de áreas/quadras
- **Território do dia** no dashboard
- **Não em casa** — quadra, rua e números das casas
- Checklist por casa (marcar como feito) e status **finalizado**
- Lista **Não finalizados** no dashboard
- Busca na listagem de territórios

---

## Stack

| Camada     | Tecnologia                          |
|------------|-------------------------------------|
| Frontend   | Vite 7, React 19, React Router, Tailwind |
| API        | Express 5, TypeScript (`tsx`)       |
| Banco      | MySQL (`mysql2`)                    |
| Auth       | JWT (`jose`) + cookie httpOnly      |
| Mapa       | Leaflet + react-leaflet             |
| Validação  | Zod                                 |

---

## Pré-requisitos

- Node.js 20+
- MySQL 8+
- npm

---

## Configuração

### 1. Clone e instale

```bash
git clone https://github.com/SEU_USUARIO/campo.git
cd campo
npm install
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=campo
JWT_SECRET=uma-chave-super-secreta-longa-e-aleatoria
PORT=3001
VITE_APP_URL=http://localhost:3000

# CEP base do mapa (região de trabalho)
TERRITORY_CEP=37940-000
```

### 3. Banco de dados

Crie o schema com a migração:

```bash
mysql -u root -p < migration.sql
```

Se o banco já existir e faltar RBAC (papéis/permissões):

```bash
npm run migrate:rbac
```

Opcional — seed da escala de dirigentes:

```bash
node scripts/setup-field-leaders.js
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

- **Web:** http://localhost:3000  
- **API:** http://localhost:3001  
- O Vite faz proxy de `/api` → API

### 5. Build / produção

```bash
npm run build
npm start
```

---

## Scripts

| Comando              | Descrição                          |
|----------------------|------------------------------------|
| `npm run dev`        | Frontend + API em paralelo         |
| `npm run dev:web`    | Só Vite                            |
| `npm run dev:server` | Só API                             |
| `npm run build`      | Build frontend + compile server    |
| `npm start`          | Sobe API servindo o `dist`         |
| `npm run migrate:rbac` | Migração RBAC (roles/permissões) |

---

## Estrutura

```
campo/
├── src/                 # Frontend (React + Vite)
│   ├── pages/
│   ├── components/
│   └── lib/
├── server/              # API Express
│   ├── routes/
│   ├── lib/
│   └── middleware/
├── scripts/             # Migrações auxiliares / utilitários
├── migration.sql        # Schema inicial MySQL
└── package.json
```

---

## Funcionalidades principais

### Autenticação
Registro, login e logout com JWT em cookie httpOnly.

### Territórios
Localidade, Terr. N.º, polígonos no mapa (GeoJSON), CEP global via `TERRITORY_CEP`.

### Território do dia
Um território em destaque no dashboard; pode ser marcado e desvinculado.

### Não em casa
- Número da quadra  
- Nome da rua  
- Números das casas  
- Checklist: marcar casas já trabalhadas  
- Tag **Finalizado** quando a quadra estiver completa  

### Dashboard
- Anúncio compacto do território do dia  
- Lista **Não finalizados** (territórios com quadra incompleta)  

---

## Segurança

- Não commite o arquivo `.env`
- Use `JWT_SECRET` forte em produção
- Senhas com bcrypt; SQL com prepared statements

---

## Licença

Projeto privado / sob demanda. Ajuste conforme o acordo do freela.

---

## Autor

Desenvolvido para gestão de territórios de campo das Testemunhas de Jeová
