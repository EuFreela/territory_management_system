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

React · Node.js · Express · MySQL · Mapas

A organização de territórios, atividades de campo e registros operacionais em uma única aplicação web.

<br/>

<a href="#sobre">Sobre</a> · <a href="#funcionalidades">Funcionalidades</a> · <a href="#fluxo">Fluxo do sistema</a> · <a href="#stack">Stack</a> · <a href="#arquitetura">Arquitetura</a> · <a href="#seguranca">Segurança</a> · <a href="#versao">Versão</a>

</div>

🎯 Sobre o projeto <a id="sobre"></a>

O CAMPO — Sistema de Gestão de Territórios de Campo é uma aplicação web desenvolvida para apoiar a organização de territórios, o planejamento de atividades e o acompanhamento de operações de campo.

A plataforma centraliza informações que podem estar dispersas em controles manuais, reunindo mapas, checklists, escalas e histórico de execução em uma interface responsiva.

O sistema foi desenvolvido para a Congregação Alpinópolis, considerando necessidades práticas de organização territorial, acompanhamento das atividades e gestão de usuários.

Não é

É

❌ Apenas uma lista de tarefas

✅ Uma plataforma para organizar territórios e atividades

❌ Um mapa isolado

✅ Gestão de territórios integrada a registros operacionais

❌ Um sistema de acesso único

✅ Aplicação com perfis e permissões de usuário

✨ Funcionalidades <a id="funcionalidades"></a>

Recurso

Descrição

🗺️ Gestão de territórios

Cadastro e organização de territórios por localidades e numeração.

📍 Visualização geográfica

Exibição de territórios em mapa, uso de dados GeoJSON e busca de endereços.

🏠 Checklist de campo

Acompanhamento de blocos, ruas e casas durante as atividades.

📆 Território do dia

Definição do território a ser trabalhado e registro de sua conclusão.

📊 Histórico de atividades

Registro de finalizações, quantidade de participantes e histórico acumulado.

👥 Escalas de dirigentes

Organização de responsáveis por dia da semana, data e período (manhã/noite).

🔐 Perfis de acesso

Permissões diferenciadas para administrador, editor, campo e visualizador.

🌗 Tema claro/escuro

Preferência de aparência individual por usuário.

📱 Interface responsiva

Layout adaptável a diferentes tamanhos de tela.

🧭 Visualização de usuários no mapa

Exibição de múltiplos usuários com identificação por nome e cor.

🔄 Fluxo de utilização <a id="fluxo"></a>

O fluxo de trabalho reúne planejamento, execução e consulta de registros:

Organizar territórios: cadastrar e consultar territórios e suas informações geográficas.

Planejar atividades: definir o território do dia e organizar escalas de dirigentes.

Executar o trabalho: utilizar o checklist para acompanhar ruas, blocos e casas.

Registrar a conclusão: finalizar o território, informar a quantidade de participantes e salvar o registro.

Consultar o histórico: acompanhar os registros acumulados das atividades realizadas.

👤 Perfis e permissões

O sistema utiliza controle de acesso baseado em papéis (RBAC) para separar as permissões conforme o perfil do usuário.

Perfil

Finalidade

Administrador

Administração do sistema e gerenciamento de usuários.

Editor

Edição de informações conforme as permissões atribuídas.

Campo

Acesso direcionado às atividades operacionais de campo.

Visualizador

Consulta de informações sem permissões de edição.

O cadastro público está desabilitado; as contas são criadas por administradores.

🧰 Stack tecnológica <a id="stack"></a>

Frontend

Tecnologia

Responsabilidade

React 19

Construção da interface baseada em componentes.

TypeScript

Tipagem estática e organização do código.

Vite 7

Ferramentas de desenvolvimento e build.

React Router 7

Navegação entre páginas.

Tailwind CSS 4

Estilização da interface.

shadcn/ui

Componentes de interface.

Leaflet / React Leaflet

Interação com mapas.

MapLibre

Renderização de mapas vetoriais.

Sonner

Notificações da interface.

Backend

Tecnologia

Responsabilidade

Node.js

Ambiente de execução do servidor.

Express 5

Aplicação backend e camada HTTP.

TypeScript

Tipagem e organização do código do servidor.

MySQL

Persistência relacional dos dados.

mysql2

Conexão com o banco de dados.

jose

Recursos de autenticação com JWT.

Zod

Validação de dados.

bcrypt

Hash de senhas.

Mapas e dados geográficos

GeoJSON para representar dados geográficos.

Leaflet e React Leaflet para recursos cartográficos interativos.

MapLibre para renderização de mapas vetoriais.

OpenStreetMap Shortbread como fonte cartográfica.

Google Maps como base cartográfica e suporte à busca de endereços.

🏗️ Arquitetura <a id="arquitetura"></a>

O CAMPO segue uma estrutura Full Stack, separando a interface, a aplicação de servidor e a persistência dos dados.

CAMPO
│
├── Frontend
│   ├── React + TypeScript
│   ├── React Router
│   ├── Tailwind CSS + shadcn/ui
│   └── Interface e componentes cartográficos
│
├── Backend / Server
│   ├── Node.js + Express
│   ├── Rotas e regras de negócio
│   ├── Autenticação e autorização
│   └── Validação de dados
│
├── Banco de dados
│   └── MySQL
│
└── Integrações geográficas
    ├── Leaflet / MapLibre
    ├── OpenStreetMap Shortbread
    ├── Google Maps
    └── Dados GeoJSON

Responsabilidades por camada

Frontend: apresenta a interface, permite a interação com mapas e formulários e comunica-se com o backend.

Backend (server): processa as requisições, aplica as regras da aplicação, valida dados e controla o acesso às funcionalidades.

Banco de dados: armazena os dados persistentes do sistema.

Integrações cartográficas: fornecem recursos de visualização e consulta geográfica.

🔐 Segurança <a id="seguranca"></a>

A aplicação incorpora mecanismos de autenticação, controle de acesso e proteção de dados:

Autenticação baseada em JWT.

Cookies httpOnly para o armazenamento do token de autenticação.

Hash de senhas com bcrypt.

Limitação de tentativas de login para ajudar a reduzir ataques de força bruta.

Controle de acesso baseado em papéis (RBAC).

Cadastro público desabilitado e criação de contas por administradores.

Validação de dados com Zod.

Consultas SQL parametrizadas para ajudar a reduzir o risco de injeção de SQL.

Requisitos de senha forte e alteração de senha.

Essas medidas descrevem mecanismos implementados no projeto; não representam, por si só, uma certificação ou auditoria de segurança.

🚀 Infraestrutura e implantação

A aplicação utiliza Node.js para execução do servidor e Cloudflare Tunnel na conectividade com o ambiente de hospedagem.

A estrutura de implantação contempla a aplicação web, o backend e a conexão com o banco de dados MySQL.

📦 Versão e evolução <a id="versao"></a>

Versão 0.0.8

Destaques desta versão:

Exibição de múltiplos usuários no mapa, identificados por nomes e cores.

Integração de mapa vetorial OpenStreetMap Shortbread, com MapLibre como alternativa de renderização.

Restrição da navegação do mapa à área de atuação de Alpinópolis, definida pelo CEP.

Padronização das notificações com Sonner.

Ajustes nas validações em português brasileiro.

Melhorias gerais na interface.

📌 Informações do projeto

Campo

Informação

Projeto

CAMPO — Sistema de Gestão de Territórios de Campo

Organização

Congregação Alpinópolis

Categoria

Aplicação web Full Stack

Área

Gestão de territórios e operações de campo

Versão

0.0.8

Status

Aplicação em produção

Licença

Privada, mediante solicitação

🔗 Repositório

O código-fonte e o histórico de versões estão disponíveis no GitHub:

Repositório: territory_management_system

Release v0.0.8: Consultar versão

<div align="center">

<sub>Desenvolvido para transformar a organização de atividades de campo em um fluxo digital integrado — CAMPO 🗺️</sub>

</div>