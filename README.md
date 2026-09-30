<div align="center">

<!-- Banner -->
<div style="display: inline-block; padding: 32px 40px; border-radius: 20px; border: 1px solid #E5E5E5; background: #FFFFFF; text-align: center; font-family: Inter, system-ui, sans-serif;">
  <div style="font-size: 44px;">🗺️</div>
  <div style="font-size: 30px; font-weight: 700; color: #171717; margin-top: 8px;">CAMPO</div>
  <div style="font-size: 15px; color: #737373; margin-top: 6px;">Sistema de Gestão de Territórios de Campo</div>
  <div style="margin-top: 18px;">
    <span style="display: inline-block; background: #F5F3FF; color: #7C3AED; border: 1px solid #DDD6FE; border-radius: 999px; padding: 4px 14px; font-size: 12px;">Full Stack · Web App</span>&nbsp;
    <span style="display: inline-block; background: #F5F5F5; color: #171717; border: 1px solid #E5E5E5; border-radius: 999px; padding: 4px 14px; font-size: 12px;">📍 Gestão geográfica</span>&nbsp;
    <span style="display: inline-block; background: #F5F5F5; color: #171717; border: 1px solid #E5E5E5; border-radius: 999px; padding: 4px 14px; font-size: 12px;">🔐 Acesso por perfil</span>
  </div>
</div>

<br/>

<!-- Badges -->
<a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black"/></a>
<a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/></a>
<a href="https://vite.dev/"><img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white"/></a>
<a href="https://expressjs.com/"><img alt="Express" src="https://img.shields.io/badge/Express-5-111111?style=for-the-badge&logo=express&logoColor=white"/></a>
<a href="https://www.mysql.com/"><img alt="MySQL" src="https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=white"/></a>
<a href="https://tailwindcss.com/"><img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white"/></a>
<a href="https://github.com/EuFreela/territory_management_system/releases/tag/v0.0.8"><img alt="Versão" src="https://img.shields.io/badge/versão-0.0.8-7C3AED?style=for-the-badge"/></a>

<br/>
<br/>

**React · Node.js · Express · MySQL · Mapas**

A organização de territórios, atividades de campo e registros operacionais em uma única aplicação web.

<br/>

[Sobre](#sobre) · [Funcionalidades](#funcionalidades) · [Fluxo do Sistema](#fluxo) · [Stack Tecnológica](#stack) · [Arquitetura](#arquitetura) · [Segurança](#seguranca)

</div>

---

## 🎯 Sobre o projeto <a id="sobre"></a>

O **CAMPO — Sistema de Gestão de Territórios de Campo** é uma aplicação web desenvolvida para apoiar a organização de territórios, o planejamento de atividades e o acompanhamento de operações de campo. 

A plataforma centraliza informações que costumam ficar dispersas em controles manuais, reunindo mapas, checklists, escalas e histórico de execução em uma interface moderna e responsiva. O sistema foi projetado especificamente para a *Congregação Alpinópolis*, atendendo a necessidades práticas de mapeamento geográfico e coordenação de equipes.

| ❌ O CAMPO não é: | ✅ O CAMPO é: |
| :--- | :--- |
| Apenas uma lista de tarefas estática | Uma plataforma viva para organizar territórios e atividades |
| Um visualizador de mapas isolado | Gestão de territórios integrada diretamente a registros operacionais |
| Um sistema de acesso genérico ou único | Uma aplicação robusta com perfis e permissões de usuário (RBAC) |

---

## ✨ Funcionalidades <a id="funcionalidades"></a>

*   **🗺️ Gestão de territórios:** Cadastro detalhado e organização de territórios por localidades e numeração de identificação.
*   **📍 Visualização geográfica:** Exibição dos territórios diretamente no mapa, utilizando dados em formato GeoJSON e suporte à busca inteligente de endereços.
*   **🏠 Checklist de campo:** Acompanhamento dinâmico de blocos, ruas e residências visitadas durante as atividades ativas.
*   **📆 Território do dia:** Definição em tempo real do território a ser trabalhado e registro direto de sua conclusão pelas equipes.
*   **📊 Histórico de atividades:** Armazenamento centralizado de finalizações, quantidade de participantes envolvidos e relatórios acumulados.
*   **👥 Escalas de dirigentes:** Organização e escala de responsáveis por dia da semana, data e períodos específicos (manhã ou noite).
*   **🔐 Perfis de acesso:** Permissões granulares diferenciadas para os perfis *Administrador, Editor, Campo* e *Visualizador*.
*   **🌗 Tema claro/escuro:** Preferência de aparência individual salva por usuário para melhor legibilidade em ambientes externos.
*   **📱 Interface responsiva:** Layout adaptável e otimizado para o uso em smartphones, tablets ou computadores.
*   **🧭 Usuários no mapa:** Exibição e monitoramento de múltiplos usuários ativos no mapa com identificação customizada por nome e cor.

---

## 🔄 Fluxo de utilização <a id="fluxo"></a>

O fluxo de trabalho do sistema unifica o planejamento estratégico ao acompanhamento operacional:

Use o código com cuidado.
[Organizar Territórios] ──> [Planejar Atividades] ──> [Executar o Trabalho] ──> [Registrar Conclusão] ──> [Consultar Histórico]

1.  **Organizar territórios:** Administradores cadastram territórios e definem suas poligonais e informações geográficas.
2.  **Planejar atividades:** Coordenadores definem o território ativo do dia e distribuem as escalas de dirigentes.
3.  **Executar o trabalho:** As equipes em campo utilizam o checklist interativo no celular para marcar ruas e blocos visitados.
4.  **Registrar a conclusão:** O dirigente finaliza a atividade do dia informando métricas como a quantidade de participantes.
5.  **Consultar o histórico:** O sistema consolida os dados operacionais gerando relatórios de cobertura do território ao longo do tempo.

### 👤 Perfis e permissões (RBAC)

O cadastro público de contas está desabilitado por padrão. Os acessos são distribuídos e gerenciados por administradores conforme a tabela abaixo:

| Perfil | Finalidade Principal |
| :--- | :--- |
| **Administrador** | Controle total do sistema, configurações globais e gerenciamento de usuários. |
| **Editor** | Atualização de registros, escalas e edição de informações territoriais. |
| **Campo** | Acesso direcionado às ferramentas operacionais do dia, checklists e mapas em tempo real. |
| **Visualizador** | Consulta de relatórios, histórico e informações do mapa, sem permissão de alteração. |

---

## 🧰 Stack tecnológica <a id="stack"></a>

### Frontend
*   **React 19:** Construção da interface de usuário baseada em componentes reativos de alta performance.
*   **TypeScript:** Tipagem estática para maior segurança durante o desenvolvimento do ecossistema.
*   **Vite 7:** Ferramenta de build de última geração para um ambiente de desenvolvimento instantâneo.
*   **React Router 7:** Gerenciamento de rotas e navegação integrada da aplicação.
*   **Tailwind CSS 4 + shadcn/ui:** Estilização utilitária e componentes de interface consistentes e acessíveis.
*   **Leaflet / React Leaflet:** Biblioteca para renderização e manipulação de mapas interativos.
*   **MapLibre:** Renderização de camadas de mapas vetoriais de alto desempenho.
*   **Sonner:** Sistema de notificações de UI limpo e não intrusivo.

### Backend
*   **Node.js:** Ambiente de execução javascript assíncrono para o servidor de aplicação.
*   **Express 5:** Framework web minimalista para gerenciamento da camada HTTP e rotas da API.
*   **TypeScript:** Padronização e tipagem estática também na camada de servidor.
*   **MySQL + mysql2:** Banco de dados relacional estável e driver nativo de comunicação otimizado para conexões simultâneas.
*   **jose:** Implementação leve para geração e validação de tokens JWT.
*   **Zod:** Validação estrita de esquemas de dados no recebimento de requisições.
*   **Bcrypt:** Criptografia avançada para armazenamento seguro de hashes de senhas.

### Recursos Cartográficos & Provedores de Dados
*   **GeoJSON:** Padrão aberto utilizado para representar estruturas e geometrias geográficas dos territórios.
*   **OpenStreetMap (Shortbread):** Fonte cartográfica base para dados abertos e mapeamentos comunitários.
*   **Google Maps APIs:** Utilizado como mapeamento de apoio e no suporte inteligente para autocompletar e buscar endereços.

---

## 🏗️ Arquitetura do sistema <a id="arquitetura"></a>

O CAMPO adota o modelo de arquitetura desacoplada (Client-Server), dividindo de forma clara as responsabilidades de cada camada:

CAMPO (Arquitetura Geral)
│
├── 📱 Frontend (Interface do Usuário)
│   ├── React 19 + TypeScript / React Router 7
│   ├── Design System (Tailwind CSS 4 + shadcn/ui)
│   └── Camada Cartográfica (Leaflet / MapLibre)
│
├── ⚙️ Backend (Servidor de Aplicação)
│   ├── Node.js + Express 5 + TypeScript
│   ├── Middlewares (Autenticação, Rate Limit, RBAC)
│   └── Validadores de Entrada (Zod)
│
├── 🗄️ Banco de Dados (Persistência)
│   └── MySQL (Modelagem Relacional de Usuários, Territórios e Históricos)
│
└── 🌐 Provedores Externos
└── APIs Geográficas (OpenStreetMap / Google Maps GeoCoding)

---

## 🔐 Segurança aplicada <a id="seguranca"></a>

A plataforma implementa boas práticas recomendadas de segurança para garantir a integridade dos dados e a privacidade dos usuários:

*   **Sessões Seguras:** Autenticação baseada em tokens JWT transmitidos exclusivamente via cookies com a flag `httpOnly`, prevenindo ataques do tipo XSS (Cross-Site Scripting).
*   **Proteção de Credenciais:** As senhas dos usuários nunca são armazenadas em texto plano, utilizando a função de hash de criptografia `bcrypt` com fatores de custo computacional elevados.
*   **Resiliência de Infraestrutura:** Inclusão de limitadores de requisições (*Rate Limiting*) nas rotas críticas de autenticação, reduzindo a viabilidade de ataques de força bruta (*Brute Force*).
*   **Validação Sanitizada:** Todas as informações enviadas ao servidor passam obrigatoriamente por esquemas de validação do `Zod`, prevenindo a persistência de dados corrompidos ou injeções indesejadas no banco de dados.

---


<div align="center">

<sub>CAMPO — Mais organização para o planejamento e acompanhamento das atividades de campo. 🗺️</sub>

</div>