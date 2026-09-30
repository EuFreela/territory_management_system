# CAMPO — Sistema de Gestão de Territórios de Campo

**Uma aplicação web Full Stack para planejamento, organização e acompanhamento de atividades de campo com suporte a informações geográficas.**

O CAMPO é um sistema desenvolvido para centralizar a gestão de territórios, organizar atividades de campo e registrar o histórico de execução das operações.

A plataforma reúne visualização geográfica, organização de escalas, acompanhamento de atividades e gerenciamento de usuários em uma interface responsiva.

O projeto foi desenvolvido com foco em usabilidade, controle de acesso, organização de dados e integração entre serviços de backend e recursos cartográficos.

---

## Visão geral

O CAMPO foi concebido para substituir processos manuais e descentralizados por uma plataforma digital que permite organizar territórios, acompanhar atividades e consultar registros anteriores.

A aplicação oferece recursos para diferentes perfis de usuários, permitindo que cada pessoa acesse as funcionalidades correspondentes ao seu nível de permissão.

### Principais funcionalidades

* **Gestão de territórios:** cadastro e organização de territórios, localidades e endereços.
* **Visualização geográfica:** representação de territórios em mapas, com suporte a dados geográficos e busca de endereços.
* **Controle de atividades:** atribuição de territórios do dia, registro de finalizações e acompanhamento do histórico.
* **Checklist de campo:** acompanhamento de blocos, ruas e casas durante a execução das atividades.
* **Gestão de escalas:** organização de dirigentes por data, dia da semana e período.
* **Controle de acesso:** gerenciamento de permissões por perfil de usuário.
* **Personalização da interface:** suporte aos temas claro e escuro, com preferência individual.
* **Interface responsiva:** experiência adaptável a diferentes tamanhos de tela.

---

## Funcionalidades em detalhes

### 1. Gestão e visualização de territórios

O sistema permite organizar territórios por localidades e números, utilizando informações geográficas para facilitar a identificação e a navegação.

Entre os recursos disponíveis estão:

* Visualização dos territórios em mapa.
* Utilização de dados geográficos no formato GeoJSON.
* Busca de endereços.
* Organização de localidades e numeração dos territórios.
* Navegação geográfica com delimitação da área de atuação.

### 2. Acompanhamento das atividades de campo

O CAMPO permite organizar e registrar a execução das atividades realizadas nos territórios.

Os recursos incluem:

* Definição do território do dia.
* Checklist de blocos, ruas e casas.
* Registro da conclusão de um território.
* Registro da quantidade de pessoas participantes.
* Histórico acumulado das finalizações.

### 3. Gestão de escalas

A plataforma disponibiliza recursos para organizar a programação de dirigentes.

É possível estruturar escalas considerando:

* Dias da semana.
* Datas específicas.
* Períodos da manhã e da noite.

### 4. Controle de acesso e usuários

O sistema utiliza controle de acesso baseado em papéis (RBAC), com diferentes níveis de permissão.

Os perfis disponíveis são:

| Perfil        | Descrição                                                             |
| ------------- | --------------------------------------------------------------------- |
| Administrador | Gerenciamento administrativo da aplicação e dos usuários.             |
| Editor        | Acesso às funcionalidades de edição conforme as permissões definidas. |
| Campo         | Perfil destinado às atividades operacionais de campo.                 |
| Visualizador  | Acesso de consulta, sem permissões de edição.                         |

O cadastro público de usuários é desabilitado. As contas são criadas por administradores.

### 5. Experiência de uso

A interface foi desenvolvida para oferecer uma experiência consistente em diferentes dispositivos.

Entre os recursos de interface estão:

* Layout responsivo.
* Temas claro e escuro.
* Preferência de tema individual por usuário.
* Componentes de interface reutilizáveis.
* Notificações padronizadas.
* Validação de formulários em português brasileiro.

---

## Tecnologias utilizadas

O projeto utiliza uma arquitetura baseada em frontend e backend, com persistência relacional e integração com serviços de mapas.

### Frontend

| Tecnologia     | Aplicação                                 |
| -------------- | ----------------------------------------- |
| React 19       | Construção da interface.                  |
| TypeScript     | Tipagem estática e organização do código. |
| Vite 7         | Ferramenta de desenvolvimento e build.    |
| React Router 7 | Navegação entre páginas.                  |
| Tailwind CSS 4 | Estilização da interface.                 |
| shadcn/ui      | Componentes de interface.                 |
| Leaflet        | Recursos de mapas interativos.            |
| React Leaflet  | Integração do Leaflet com React.          |
| MapLibre       | Recursos de visualização cartográfica.    |

### Backend

| Tecnologia | Aplicação                                     |
| ---------- | --------------------------------------------- |
| Node.js    | Ambiente de execução.                         |
| Express 5  | Construção da aplicação backend e das rotas.  |
| TypeScript | Tipagem e organização do código.              |
| MySQL      | Banco de dados relacional.                    |
| mysql2     | Integração com o banco de dados.              |
| jose       | Recursos relacionados à autenticação com JWT. |
| Zod        | Validação de dados.                           |

### Mapas e dados geográficos

* Leaflet e React Leaflet para visualização cartográfica.
* MapLibre para renderização de mapas vetoriais.
* OpenStreetMap Shortbread como fonte de dados cartográficos.
* Google Maps como base cartográfica.
* GeoJSON para representação de informações geográficas.

---

## Segurança

A aplicação incorpora mecanismos de segurança voltados à proteção do acesso e à integridade dos dados.

Entre as medidas implementadas estão:

* Cadastro público desabilitado.
* Criação de contas por administradores.
* Autenticação baseada em JWT.
* Utilização de cookies `httpOnly` para armazenamento do token de autenticação.
* Hash de senhas com bcrypt.
* Limitação de tentativas de login.
* Exigência de senha forte e alteração de senha.
* Controle de acesso baseado em papéis (RBAC).
* Utilização de consultas SQL parametrizadas para reduzir riscos de injeção de SQL.

---

## Arquitetura e organização

O CAMPO utiliza uma estrutura Full Stack com responsabilidades distribuídas entre interface, backend e banco de dados.

```text
CAMPO
│
├── Frontend
│   ├── React
│   ├── TypeScript
│   ├── Vite
│   ├── React Router
│   ├── Tailwind CSS
│   └── Interface e recursos cartográficos
│
├── Backend
│   ├── Node.js
│   ├── Express
│   ├── TypeScript
│   ├── Autenticação e autorização
│   ├── Validação de dados
│   └── Regras de negócio
│
├── Persistência
│   └── MySQL
│
└── Integrações
    ├── Serviços cartográficos
    └── Dados geográficos GeoJSON
```

---

## Infraestrutura e implantação

A aplicação utiliza uma infraestrutura baseada em Node.js para execução do sistema e Cloudflare Tunnel para conectividade com o ambiente de hospedagem.

A estrutura contempla a execução do backend, a disponibilização da interface e a integração com o banco de dados MySQL.

---

## Evolução do projeto

### Versão 0.0.8

A versão 0.0.8 trouxe melhorias na visualização cartográfica, no acompanhamento de usuários e na experiência de uso.

**Principais atualizações:**

* Visualização de múltiplos usuários no mapa, com identificação por nomes e cores.
* Integração com mapa vetorial OpenStreetMap Shortbread.
* Utilização de MapLibre como alternativa de renderização cartográfica.
* Restrição da navegação do mapa à área de atuação definida pelo CEP de Alpinópolis.
* Padronização das notificações com Sonner.
* Aprimoramento das validações em português brasileiro.
* Melhorias gerais na interface.

---

## Contexto do projeto

**CAMPO — Sistema de Gestão de Territórios de Campo**

* **Organização:** Congregação Alpinópolis.
* **Categoria:** Aplicação web Full Stack.
* **Área:** Gestão de operações e informações geográficas.
* **Versão:** 0.0.8.
* **Status:** Aplicação em produção.
* **Licença:** Privada, mediante solicitação.

---

## Repositório

O código-fonte e o histórico de versões estão disponíveis no GitHub.

**Repositório:** [territory_management_system](https://github.com/EuFreela/territory_management_system)

**Versão 0.0.8:** [Consultar release](https://github.com/EuFreela/territory_management_system/releases/tag/v0.0.8)

---

## Considerações finais

O CAMPO é um projeto que reúne desenvolvimento Full Stack, integração com mapas, gerenciamento de dados, autenticação e controle de acesso em uma aplicação voltada a uma necessidade operacional concreta.

Sua implementação demonstra a integração entre diferentes tecnologias e a construção de uma solução que combina organização de informações, recursos geográficos e experiência de uso.
