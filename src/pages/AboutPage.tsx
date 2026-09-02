import { useState } from 'react';
import {
  IconCheckCircle,
  IconInfo,
  IconMap,
  IconUsers,
} from '@/components/Map/mapIcons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/version';

export { APP_VERSION };

const features = [
  {
    icon: IconMap,
    title: 'Territórios e mapa',
    text: 'Cadastre cartões com localidade e número, desenhe áreas no mapa (Google Maps no Leaflet), cole o link da imagem do cartão, use sua localização GPS e a rota mais curta até a quadra mais próxima.',
  },
  {
    icon: IconCheckCircle,
    title: 'Checklist de casas',
    text: 'Cadastre não em casa com várias ruas na mesma quadra, descrição opcional por rua e marque casas visitadas. Finalize o território do dia com pessoas e dirigente do horário.',
  },
  {
    icon: IconUsers,
    title: 'Dirigentes e escala',
    text: 'Monte a escala de dirigentes com dias, horários e designados. Veja o destaque de “hoje” e o que ainda falta no início.',
  },
  {
    icon: IconInfo,
    title: 'Histórico e permissões',
    text: 'Consulte o histórico de finalizações e controle o acesso com papéis (admin, editor, campo e visualizador), cada um com permissões adequadas.',
  },
] as const;

type TabId = 'sistema' | 'atualizacoes';

/** Atualizações baseadas no histórico de desenvolvimento (commits) */
const updates: { title: string; items: string[] }[] = [
  {
    title: 'Reforço de segurança no servidor (v0.0.39)',
    items: [
      'Dependências atualizadas: auditoria do npm sem vulnerabilidades conhecidas',
      'Limite de tentativas (rate limit) passa a considerar o IP real conforme a confiança em proxy reverso, evitando que cabeçalhos falsos contornem o bloqueio',
      'Rotas que alteram dados (criar/editar/apagar) passam a validar a origem da requisição, reforçando a proteção contra ataques entre sites (CSRF)',
      'Validações mais rígidas: até 500 números de casa por registro e faixa segura para a ordem de exibição',
    ],
  },
  {
    title: 'Não em casa na hora, voltar no fim e acesso por perfil (v0.0.38)',
    items: [
      'Editar o mapa e gerenciar o não em casa agora são coisas separadas: quem gerencia não em casa não altera as áreas do mapa (que ficam visíveis, só de leitura)',
      'Quadras e ruas do não em casa são gravadas na hora pelo próprio botão do formulário, com o aviso "Não em casa salvo." no topo',
      'Botão "Voltar" no fim da página de edição, abaixo do não em casa, para quem não é editor voltar ao território; para o editor, o retorno continua no card "Salvar alterações"',
      'Os itens "Finalizados" e "Template" do menu Territórios passam a ser exibidos — e acessíveis — apenas para quem tem permissão de editar território',
    ],
  },
  {
    title: 'Papéis e permissões administráveis (v0.0.37)',
    items: [
      'Nova página Permissões no submenu Usuários — visível somente para administradores',
      'Crie papéis personalizados dando um nome ao papel e marcando com checkboxes as permissões que irão compô-lo; edite nome, descrição e permissões quando quiser',
      'O papel administrador é protegido (sempre com todas as permissões); papéis de sistema não podem ser excluídos, e um papel em uso por usuários bloqueia a exclusão até ser reatribuído',
      'O acesso às novas opções é validado no servidor: criar, editar e excluir papéis só funcionam para o administrador',
    ],
  },
  {
    title: 'Gerir Usuários restrito à congregação (v0.0.36)',
    items: [
      'Quem recebe a permissão exclusiva "Gerir usuários" passa a gerenciar, listar, ver, bloquear e excluir apenas os usuários comuns da própria congregação (mesmo CEP de trabalho)',
      'O administrador continua com acesso total; o gestor restrito não bloqueia, exclui nem edita administradores ou outros usuários com escopos elevados',
      'Editar permissões exclusivas agora é função somente do administrador — o ícone de chave fica oculto para o gestor restrito e o servidor nega a operação',
      'Um gestor de congregação não cria usuários com papel administrador nem move usuários para outra congregação; no seletor de congregações, só enxerga a própria',
    ],
  },
  {
    title: 'Permissões exclusivas por usuário (v0.0.35)',
    items: [
      'Na página Usuários, um novo ícone de chave abre as permissões exclusivas de cada usuário, somadas às do papel',
      'Essas permissões adicionais são aditivas: o usuário ganha os escopos marcados sem perder os do seu papel (que não podem ser removidos ali)',
      'Com isso, um Visualizador (só leitura) pode receber, por exemplo, a permissão de editar ou criar territórios de forma individual, sem mudar de papel',
      'O acesso é aplicado no servidor a cada requisição — ao recarregar a página, os botões e menus refletem as novas permissões',
    ],
  },
  {
    title: 'Login com Google com menor privilégio (v0.0.34)',
    items: [
      'Nova conta criada ao entrar com Google passa a receber o papel de menor privilégio: Visualizador (somente leitura de territórios)',
      'Antes, contas novas do Google entravam como Campo; agora o acesso deve ser elevado deliberadamente por um administrador na página Usuários',
      'Contas que já existiam mantêm o papel atual — a mudança vale para novas contas criadas pelo Google',
    ],
  },
  {
    title: 'Isolamento da congregação e destaque de seleção (v0.0.33)',
    items: [
      'Correção de sessão: definir uma congregação como ativa agora troca apenas a região de trabalho do administrador logado — os demais usuários permanecem vinculados à congregação definida no cadastro deles',
      'Usuários comuns continuam vendo somente os dados da própria congregação; o admin pode alternar livremente entre congregações sem afetar ninguém',
      'Na página Congregações, a congregação que é a sua região de trabalho fica destacada com o selo "Ativa (sua região)" e o botão de definir vira um check preenchido quando já é a atual',
      'Na edição de usuário, a congregação selecionada ganha destaque (fundo, marca de seleção e confirmação) tanto no seletor quanto na lista de opções',
    ],
  },
  {
    title: 'Congregação do usuário na edição (v0.0.32)',
    items: [
      'Na edição de usuário, seletor para vincular/alterar a congregação: mostra as últimas 5 cadastradas e busca por nome ou CEP (aceita com ou sem o hífen)',
      'Ao escolher a congregação, o usuário passa a pertencer ao CEP dela',
      'A criação de usuário ficou mais simples: o campo "CEP (congregação)" foi removido — o novo usuário já entra na congregação do CEP atual',
      'Seletor mais confiável: se a lista ainda não carregou ao abrir, recarrega na hora e mostra "Carregando…"; se der erro, aparece o botão "Tentar novamente"',
    ],
  },
  {
    title: 'Tutorial: abas recapturadas (v0.0.31)',
    items: [
      'Capturas reais das abas (controle segmentado) do Cartão, Sobre e Finalizados atualizadas no tutorial A4',
      'Aba Atualizações da Sobre mostra esta versão no tutorial',
    ],
  },
  {
    title: 'Bloqueio e lista completa de usuários (v0.0.30)',
    items: [
      'Na página Usuários, o administrador vê todos os usuários do sistema, com ou sem congregação',
      'Usuário sem congregação ganha a marca vermelha "SC" (sem congregação)',
      'Novo botão por linha para bloquear/desbloquear: usuário bloqueado não consegue entrar no sistema',
      'Ao bloquear, o usuário é desconectado automaticamente: sai do online/do mapa na hora e, na próxima atividade, é redirecionado para o login',
    ],
  },
  {
    title: 'Pagina de congregações e região na Configuração (v0.0.29)',
    items: [
      'Nova página Congregações (somente admin): cadastre a congregação por CEP, nome e endereço — um CEP pode ter mais de uma congregação',
      'Ao definir uma congregação como "ativa", apenas a região de trabalho do admin que acessa passa a ser aquela — os demais usuários permanecem na congregação definida no cadastro deles',
      'Contadores por linha: territórios e usuários vinculados àquele CEP',
      'Na Configuração, o cartão "Alterar região" foi removido — a região agora é definida pela congregação ativa; "Regiões já cadastradas" ficou somente leitura',
      'Tutorial A4: capítulo de Configuração atualizado e novo capítulo de Congregações',
    ],
  },
  {
    title: 'Usuários vinculados à congregação (v0.0.27)',
    items: [
      'Ao criar usuário, o CEP da congregação já aparece definido (somente leitura), vindo das Configurações',
      'A lista de usuários mostra somente os da mesma congregação (mesmo CEP)',
      'O tutorial abre em nova aba',
    ],
  },
  {
    title: 'Segurança e isolamento por CEP (v0.0.26)',
    items: [
      'Somente administrador pode trocar o CEP da região: novo escopo config:cep e Configuração bloqueada para os demais',
      'Headers de segurança HTTP: CSP, proteção contra clickjacking, HSTS em HTTPS e remoção do X-Powered-By',
      'A lista de congregações conhecidas fica visível só para quem pode trocar de região',
    ],
  },
  {
    title: 'Baixar imagem do mapa no botão (v0.0.25)',
    items: [
      'Botão para baixar a imagem do mapa direto no território, respeitando o modo PB/colorido e o destaque',
    ],
  },
  {
    title: 'Inserir programação na escala (v0.0.24.1)',
    items: [
      'Na página Dirigentes, botão Inserir programação: cole o texto ou envie um .txt',
      'Modelo .txt único para inserir a programação (data DD/MM/AAAA HH:MM Nome, ou FIXO Dia HH:MM Nome); horário em 24 horas',
      'Botão para excluir toda a programação da região, com confirmação',
    ],
  },
  {
    title: 'Tutorial: Sobre, conta e tema (v0.0.24)',
    items: [
      'Capítulos da página Sobre, do ícone da conta (dados e atalhos) e do modo claro/escuro, com capturas reais em WebP',
    ],
  },
  {
    title: 'Tutorial: chat, edição, mapa e relatório (v0.0.23)',
    items: [
      'Capítulos de Chat, Editar território, controles do mapa (GPS) e Relatório A4, com capturas reais em WebP',
    ],
  },
  {
    title: 'Tutorial completo (v0.0.22)',
    items: [
      'Capítulos de Dirigentes, Usuários, Minha conta, Configuração e Finalizados, com capturas reais em WebP',
      'O tutorial A4 cobre o fluxo do dia a dia: login, início, cartões, escala, contas, região e histórico',
    ],
  },
  {
    title: 'Tutorial: Territórios e o cartão (v0.0.21)',
    items: [
      'Capítulos de Territórios, Novo território e o cartão (mapa, imagem e não em casa), com capturas reais em WebP',
      'Cada controle da lista e do cartão explicado ao lado da imagem, no mesmo formato A4',
    ],
  },
  {
    title: 'Tutorial A4 e menu (v0.0.20)',
    items: [
      'Tutorial em folhas A4 (capa, sumário e capítulos) com capturas reais em WebP, para ler na tela ou imprimir',
      'No menu, item Tutorial; Configuração fica só no ícone da conta',
      'Capítulos de Login e Início: cada parte da tela explicada ao lado da imagem',
    ],
  },
  {
    title: 'Nome da congregação no CEP (v0.0.19)',
    items: [
      'Na Configuração, campo para nomear o CEP com o nome da congregação',
      'O nome aparece no menu, no início e nas listas daquela região',
    ],
  },
  {
    title: 'Imagem do cartão por link (v0.0.18)',
    items: [
      'Na criação e na edição, a aba/campo Imagem recebe o link da foto do cartão — o arquivo não fica no servidor',
      'O mapa deixa de buscar imagens locais em /territories/, o que evita deixar o site lento com dezenas de arquivos',
      'O link é sanitizado (só http/https, sem javascript/data, sem endereços internos) e pode ser editado depois',
      'Links do Google Drive e Dropbox são convertidos automaticamente para visualização',
    ],
  },
  {
    title: 'Mostrar senha no login (v0.0.17.1)',
    items: [
      'No campo de senha da tela de login, ícone de olho para mostrar ou ocultar o que foi digitado',
    ],
  },
  {
    title: 'Região de trabalho por CEP (v0.0.17)',
    items: [
      'Página Configuração para informar o CEP da congregação; o .env guarda só o CEP padrão',
      'Territórios, mapas, dirigentes e histórico ficam vinculados ao CEP da região de trabalho',
      'Outras congregações usam o mesmo sistema na própria cidade, sem misturar os mapas',
      'Chat e GPS compartilhado também ficam na mesma região',
      'Novos usuários criados pelo administrador entram na mesma região de quem os cadastrou',
    ],
  },
  {
    title: 'Chat entre usuários online (v0.0.16)',
    items: [
      'Ícone flutuante no canto inferior direito em todas as páginas: chat recolhido que expande em painel compacto',
      'Mensagens em grupo para quem está online (só em memória, sem gravar no banco)',
      'Lista “Online agora”, avisos de entrou/saiu e contagem de abas da mesma conta (ex.: admin (você)[3])',
      'Emoticons no compositor, botão enviar só com ícone; seta “voltar ao topo” reposicionada acima do chat',
      'Na página Dirigentes: botões “Adicionar” e “Salvar dirigencia” com texto',
    ],
  },
  {
    title: 'Revisão de territórios e polimento de conta (v0.0.15)',
    items: [
      'Na lista de territórios, botão para confirmar se o cartão foi revisado e aprovado — com badge e opção de remover a marcação',
      'Confirmações de exclusão no mobile passam a aparecer no centro da tela (no desktop seguem no centro-topo)',
      'Perfil e alterar senha: botão de voltar com ícone ao lado de Salvar; textos dos botões de salvar padronizados',
    ],
  },
  {
    title: 'Correção no nome da área em dark mode (v0.0.14.1)',
    items: [
      'Na edição do território, o campo "Nome / texto da área no mapa" ficava com letra branca sobre fundo branco no modo escuro',
      'O painel de nomeação das áreas agora usa as cores do tema — texto legível no claro e no escuro',
    ],
  },
  {
    title: 'Mapa & Imagem em paralelo na edição (v0.0.14)',
    items: [
      'Na edição do território, seletor Mapa | Mapa + Imagem mostra os dois mapas lado a lado em tela cheia',
      'Dá para girar a orientação (lado a lado ou empilhado), fechar com Esc e continuar desenhando as quadras enquanto compara com a imagem do cartão',
    ],
  },
  {
    title: 'Novo visual do login (v0.0.13)',
    items: [
      'Fundo animado de pontos 3D (WebGL) com vinheta no centro',
      'Cartão de login em vidro escuro com sombra profunda sobre fundo preto',
      'Cabeçalho e botão de tema ajustados ao novo visual (tema claro/escuro preservado)',
    ],
  },
  {
    title: 'Permissões por papel (v0.0.12)',
    items: [
      'Novo escopo block:check: marcar os números já visitados no não em casa',
      'Papel Campo agora só lê territórios e marca os números no checklist — não edita não em casa, não marca território do dia e não acessa a escala de dirigentes',
      'Página Dirigentes restrita a quem gerencia (block:manage) — editor e admin',
      'Mudar o nome do dirigente (home e escala) só com block:manage',
    ],
  },
  {
    title: 'Gráficos das métricas dos Finalizados (v0.0.11)',
    items: [
      'Nova aba Métricas com gráficos interativos de todo o histórico de finalizações',
      'Line Chart com as métricas diárias em linhas independentes (finalizações, pessoas, quadras, ruas e casas)',
      'Area Chart interativo de pessoas por dia com filtro de período (7d, 30d, 90d)',
      'Bar Chart empilhado do não em casa por dia (quadras, ruas e casas)',
      'Pie Chart da participação de cada dirigente nas finalizações',
      'Radar Chart comparando os top dirigentes nas principais métricas',
      'Radial Chart com o progresso das casas não em casa já visitadas',
      'Cartões de resumo: finalizações, pessoas alcançadas, não em casa e dias com registro',
    ],
  },
  {
    title: 'Botões de conta com texto (v0.0.10.8)',
    items: [
      'Em "Minha conta", o botão Salvar passou a exibir o texto "Salvar" (e "Salvando…" durante o envio)',
      'O botão de troca de senha agora mostra "Trocar Senha"',
    ],
  },
  {
    title: 'Ajuste fino dos campos (v0.0.10.7)',
    items: [
      'Campo de senha com a mesma altura dos demais inputs (alinhado ao padrão shadcn)',
      'Rótulos de senha e papel alinhados — inputs nivelados na tela de usuários',
    ],
  },
  {
    title: 'Padronização, botões e tooltips (v0.0.10.6)',
    items: [
      'Tooltip em camada própria (portal) — as dicas aparecem sempre acima de mapas, tabelas e modais',
      'Erros de preenchimento padronizados abaixo de cada campo em todos os formulários (usuários, perfil, senha, territórios e dirigentes)',
      'Botões de ação com texto + ícone: Entrar, Entrar com Google, Finalizar, Vincular, Criar Usuário e Salvar',
      'Tela cheia do mapa acompanha o tema escuro — mensagens legíveis no dark mode',
      'Tags com cores por papel (admin, editor, campo, visualizador) e por dirigente (Fixo/Designado), com pontinho decorativo',
      'Botão da lupa da busca de endereço alinhado ao campo (sem o formato redondo)',
    ],
  },
  {
    title: 'Páginas restantes migradas para shadcn/ui (v0.0.10.5)',
    items: [
      'Dirigentes: escala com cards, formulário por data com dicas de horário e destaque de “hoje” no cabeçalho inteiro',
      'Territórios: cards com nome, n.º, selo “Território do dia” e ações por ícone',
      'Cartão do território: abas Mapa / Imagem / Mapa & Imagem com o padrão segmentado, checklist de não em casa e modal de comparação em tela cheia',
      'Novo e Editar território: formulários de localidade/área e gestão de não em casa (quadras, ruas, casas e exclusão em massa)',
      'Usuários e papéis: criação, busca e edição em modal padrão',
      'Minha conta, Alterar senha e Sobre no visual do restante do app',
      'Correção do fundo branco dos selects no modo escuro e do destaque da tabela de “hoje” no topo',
    ],
  },
  {
    title: 'Busca no território do dia (v0.0.10.1)',
    items: [
      'No modal “Dirigente — território do dia”, o seletor virou uma busca com lista rolável',
      'Filtra por nome ou número do território (ignora acentos) e destaca o selo “do dia” nos já marcados',
    ],
  },
  {
    title: 'Login com Google (v0.0.10)',
    items: [
      'Novo botão “Continuar com Google” na tela de login — entra direto com a conta Google',
      'Conta nova (e-mail ainda sem acesso) é criada automaticamente com o papel Campo (field)',
      'Quem já tem conta pelo e-mail continua com o mesmo papel e dados',
      'O histórico de finalizações registra normalmente quem entrou pelo Google',
      'Migração automática: npm run migrate:google-oauth',
      'Configuração no servidor: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (ver .env.example)',
    ],
  },
  {
    title: 'Território do dia por dirigente (v0.0.9)',
    items: [
      'Cada dirigente da escala de hoje tem seu próprio território do dia — dá para ter mais de um território do dia ao mesmo tempo, um para cada dirigente',
      'Na lista de Territórios, o botão estrela no card abre uma janela com a opção de escolher o dirigente responsável pelo território',
      'Vincular troca o vínculo anterior do mesmo dirigente (um dirigente = um território do dia)',
      'O selo “Território do dia” mostra o nome do dirigente vinculado',
      'Início (home) lista um cartão por dirigente com o território do dia, e quem ainda não marcou ganha um botão de Marcar território do dia',
      'Territórios do dia sem dirigente na escala continuam aparecendo separados',
      'Finalizar o território do dia usa automaticamente o dirigente vinculado no histórico',
      'Migração automática: npm run migrate:daily-per-leader',
    ],
  },
  {
    title: 'Relatório de finalizações e métricas (v0.0.8.4)',
    items: [
      'Finalize o território do dia mesmo com casas pendentes no não em casa, com aviso de quantas casas restam',
      'Histórico de finalizados registra e exibe as casas que restaram no não em casa no momento da finalização',
      'Relatório A4 (Imprimir/Salvar PDF): capa, resumo com totais e a relação de finalizações escrita por extenso, legível',
      'Checklist de seleção na página Finalizados para escolher as linhas do relatório',
      'Somas do relatório não contam duas vezes o mesmo território finalizado mais de uma vez',
      'Casas duplicadas no não em casa contam uma única vez nos totais',
      'Aba Métricas na página Finalizados — base para os gráficos do histórico',
      'Botão Finalizar no início com verde mais escuro e tooltip “Finaliza campo”',
    ],
  },
  {
    title: 'Login, ícones e polimento (v0.0.8.3)',
    items: [
      'Validação do login em português (PT-BR): nada de mensagens nativas do navegador em inglês',
      'Balão de erro próprio abaixo de cada campo, com o campo relacionado destacado em vermelho',
      'Erro de credenciais inválidas em toast, no padrão do restante do app',
      'Ícones do sistema trocados pela biblioteca Lucide (visual leve e consistente)',
      'Botões Adicionar rua e Salvar quadra/rua padronizados no formato redondo de ícone',
      'Validação do cadastro de não em casa em português, com mensagem abaixo do campo correspondente',
      'Mapa & Imagem: contador de áreas no cabeçalho ao lado do botão de orientação',
      'Botão de orientação com ícone relativo à ação (empilhar/lado a lado) e tooltips abaixo, dentro das margens da tela',
      'Labels e texto de ajuda da edição de território com mais contraste e legibilidade',
    ],
  },
  {
    title: 'Mapa & Imagem juntos (v0.0.8.2)',
    items: [
      'Aba Mapa & Imagem: abre em tela cheia com o mapa principal e a imagem do cartão lado a lado',
      'Botão de girar orientação: alterna entre lado a lado (horizontal) e um sobre o outro (vertical)',
      'Fechar com X ou Esc — volta para a aba Mapa',
      'Botão Cancelar no comentário de atenção — sai da edição sem salvar',
      'Botões de edição do mapa padronizados em formato redondo',
    ],
  },
  {
    title: 'Minha conta (v0.0.8.1)',
    items: [
      'Página Minha conta no menu, para todos os usuários: edite seu nome e troque sua senha',
      'Email e papel continuam restritos ao administrador',
      'Troca de senha com o mesmo padrão do admin: medidor de força, requisitos e gerador de senha forte',
      'Olho único mostra/oculta todas as senhas da página de uma vez',
      'Erros em toast, com o campo relacionado destacado em vermelho e a mensagem abaixo do input',
    ],
  },
  {
    title: 'GPS compartilhado e mapa (v0.0.8)',
    items: [
      'GPS multi-usuário: usuários logados com GPS ativo aparecem no mapa com nome, cada um em uma cor',
      'Sua posição destacada como “Você”; presença expira sozinha ao desligar o GPS ou fechar o navegador (~45s)',
      'Zoom e navegação limitados à região do CEP (Alpinópolis), com zoom mínimo e máximo adequados',
      'Novo basemap OpenStreetMap Shortbread (tiles vetoriais via MapLibre) no fallback do Google Maps',
      'Fallback automático para o OSM raster clássico se o vetorial falhar',
    ],
  },
  {
    title: 'Correções e polimento (v0.0.8)',
    items: [
      'Toasts Sonner unificados em todo o app: caixas quadradas, cores padrão de sucesso/erro e botão X interno',
      'Validação de formulários em português (PT-BR) no app e no campo de senha',
      'Campo de senha polido: medidor de força, checklist de requisitos e gerador de senha forte',
      'Lista de finalizados sem scrollbar e tooltips legíveis',
    ],
  },
  {
    title: 'Confirmações, usuários e escala (v0.0.7)',
    items: [
      'Confirmações padronizadas em alerta estilo iOS: todas as exclusões (usuário, território, não em casa, quadras, histórico, escala, áreas e notas do mapa) usam a mesma caixa centralizada',
      'Desvincular o território do dia e desmarcar uma casa confirmam no mesmo padrão de aviso',
      'Ícone e cor por tipo de ação: azul para informação e vermelho para destrutivas, com fundo acompanhando o tema claro/escuro',
      'Feedback com toast ao vincular o território do dia e ao excluir/remover registros (sucesso ou erro)',
      'Modal antiga de confirmação substituída pelo novo padrão',
      'Gestão de usuários com papéis (RBAC): criar e editar usuários escolhendo papel e senha, com busca',
      'Campo de senha com medidor de força, checklist de requisitos e gerador de senha forte',
      'Modal “Papéis e permissões” explica o que cada papel pode fazer',
      'Escala: adicionar designação por data, com dia da semana e horário',
      'Permissões de dirigentes/escala: apenas quem gerencia cria, edita e remove designações',
    ],
  },
  {
    title: 'Lista e tooltips (v0.0.6.2)',
    items: [
      'Territórios listados por Terr. N.º (ordem numérica)',
      'Botão único ao lado de criar: alterna ordenação crescente/decrescente',
      'Tooltips mais legíveis: uma linha, limite de 40 caracteres, textos objetivos',
    ],
  },
  {
    title: 'GPS e rota no mapa (v0.0.6.1)',
    items: [
      'Rota de carro mais curta até a quadra mais próxima (distância e tempo de carro)',
      'Com GPS ativo o mapa fica livre para pan/zoom (não “gruda” na posição)',
      'Botão voltar ao início: com GPS on → volta ao ponto GPS; com GPS off → enquadra as quadras',
      'Tempo de rota realista para carro (não usa duração pedestre do OSRM)',
    ],
  },
  {
    title: 'GPS, rota e campo no mapa (v0.0.6)',
    items: [
      'Botão no mapa para ativar/desativar a minha localização (GPS)',
      'Pin com o nome do usuário logado na posição atual',
      'Rota até a quadra (área) mais próxima do GPS',
      'Distância e tempo estimados na barra da rota',
      'Notas de atenção (ícone !) com lista abaixo do mapa e edição com salvar/remover',
      'Match exato de quadra e casa no não em casa (1 não finaliza 11, 12…)',
      'Mapa permanece montado ao trocar aba Mapa/Imagem (menos requests)',
    ],
  },
  {
    title: 'Cartão: imagem, edição e seleção (v0.0.5.1)',
    items: [
      'Abas Mapa e Imagem no cartão de território',
      'Imagem do cartão no Leaflet (zoom, arrastar, tela cheia e centralizar)',
      'Arquivos estáticos em public/territories/t{N}.webp|jpg|png (ex.: Terr. 28 → t28.webp)',
      'Seleção de áreas por id estável — nomes iguais não colidem mais',
      'Rótulos únicos ao renomear (ex.: 4 → 4 (2) se já existir)',
      'Correção da nomeação após apagar e recriar retângulos no mapa',
      'Botão Sair da edição ao lado de Salvar localidade e área',
    ],
  },
  {
    title: 'Cartografia, domínio e publicação (v0.0.5)',
    items: [
      'Basemap atualizado com a API do Google Maps (Maps JavaScript API)',
      'Leaflet mantido para áreas, marcadores e desenho de territórios',
      'Integração via GoogleMutant — ruas e nomes alinhados à cartografia do Google',
      'Configuração por VITE_GOOGLE_MAPS_API_KEY (rebuild necessário em produção)',
      'Fallback automático para OpenStreetMap se a chave ou o Google não estiver disponível',
      'Publicação em produção no domínio https://analp.tec.br',
      'Acesso externo via Cloudflare Tunnel apontando para o serviço da aplicação',
      'CORS e cookies alinhados ao origin do domínio (VITE_APP_URL + COOKIE_SECURE em HTTPS)',
    ],
  },
  {
    title: 'Sobre, login e preferências',
    items: [
      'Página Sobre no menu com descrição do sistema',
      'Login alinhado ao visual do restante do app',
      'Tema dark/light salvo individualmente por usuário no banco',
      'Subtítulo de login: Congregação Alpinópolis',
    ],
  },
  {
    title: 'Interface e navegação',
    items: [
      'Logo do sistema no menu e no login',
      'Menu responsivo com drawer no celular',
      'Toggle de tema claro/escuro com cores adaptáveis',
      'Tooltips no estilo Apple (sem tooltip nativo do navegador)',
      'Ações principais por ícone, no padrão do layout',
      'Removido loading em tela preta que piscava a interface',
      'Redesign visual clean no estilo Apple (tokens, tipografia e componentes)',
    ],
  },
  {
    title: 'Territórios e território do dia',
    items: [
      'Histórico de finalizações com dia, horário, dirigente, pessoas e quem registrou',
      'Submenu Finalizados com busca; remoção apenas para administrador',
      'Botão Finalizar grava no histórico cumulativo e desvincula o território do dia',
      'Com vários dirigentes no dia, escolha no dropdown qual dirigiu o território',
      'Busca por endereço no mapa (geocoding) com pin e voo até o local',
      'Busca de endereço corrigida em Novo território (sem conflito com o formulário da página)',
    ],
  },
  {
    title: 'Mapa e checklist (não em casa)',
    items: [
      'Várias ruas na mesma quadra (botão Adicionar rua, cadastro dinâmico)',
      'Descrição opcional por rua — só aparece no card se preenchida (somente leitura)',
      'Cards agrupados por quadra no cartão e na edição',
      'Tela cheia e botão para reenquadrar as áreas do mapa',
      'Confirmação ao desmarcar casa; limpar destaque; refazer ponto/área',
      'Destaque bidirecional entre mapa e cartões de não em casa',
      'Seleção mapa/cartão sem scroll indesejado; status finalizado em cinza',
      'Exclusão em massa de registros de não em casa e botão voltar ao topo',
      'Contraste dark no cartão de território, busca do mapa e menu sem sobrepor ícones',
    ],
  },
  {
    title: 'Dirigentes e escala',
    items: [
      'Escala de dirigentes com horários, dias da semana e card de “hoje”',
      'API gravando horário nas designações datadas',
      'Data de “hoje” correta no fuso America/São_Paulo',
    ],
  },
  {
    title: 'Acesso e segurança',
    items: [
      'RBAC com papéis, escopos e gestão de usuários',
      'Rate limit no login, senha forte e troca obrigatória se fraca',
      'JWT e cookie de sessão endurecidos; cadastro público desabilitado',
      'Página de alteração de senha',
      'Cookie de autenticação funcional em HTTP (rede local)',
    ],
  },
  {
    title: 'Infra e manutenção',
    items: [
      'Fallback SPA compatível com Express 5',
      'Correções de build do server (dashboard blocks)',
      'Remoção de arquivos e scripts não utilizados',
      'Domínio de produção: analp.tec.br (HTTPS)',
    ],
  },
];

const SECTION_HEADING_CLASS =
  'mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground';

export default function AboutPage() {
  const [tab, setTab] = useState<TabId>('sistema');

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-8 text-center sm:text-left">
        <p className="text-sm font-medium text-muted-foreground">Sistema</p>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <img
            src="/logo.webp"
            alt="CAMPO"
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-[18px] object-cover ring-1 ring-border"
          />
          <div>
            <h1 className="mt-0 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
              CAMPO
            </h1>
            <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Organização de territórios e do trabalho de campo em um só lugar.
            </p>
          </div>
        </div>
      </div>

      <div
        className="mb-6 inline-flex w-full rounded-full bg-muted p-1 sm:w-auto"
        role="tablist"
        aria-label="Seções sobre o CAMPO"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sistema'}
          id="tab-sistema"
          onClick={() => setTab('sistema')}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
            tab === 'sistema'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          O sistema
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'atualizacoes'}
          id="tab-atualizacoes"
          onClick={() => setTab('atualizacoes')}
          className={cn(
            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
            tab === 'atualizacoes'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Atualizações
        </button>
      </div>

      {tab === 'sistema' ? (
        <div role="tabpanel" aria-labelledby="tab-sistema" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold tracking-tight">O que é o CAMPO?</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                <p>
                  O <span className="font-semibold text-foreground">CAMPO</span> é o sistema usado
                  para planejar, acompanhar e registrar o trabalho de campo por territórios. Em vez
                  de planilhas soltas e papéis, a equipe vê no mapa o que já foi coberto, quem dirige
                  em cada horário e o histórico do que já foi finalizado.
                </p>
                <p>
                  Cada território vira um cartão com área no mapa, casas e quadras para marcar, e o
                  fluxo do <span className="font-medium text-foreground">território do dia</span> —
                  um por dirigente da escala de hoje, escolhido na lista de Territórios — até a
                  finalização com registro de pessoas e data/hora.
                </p>
              </div>
            </CardContent>
          </Card>

          <section>
            <h2 className={SECTION_HEADING_CLASS}>O que você faz no CAMPO</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Card className="h-full">
                    <CardContent className="pt-6">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                        {text}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold tracking-tight">Para quem é</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Foi pensado para quem organiza o campo no dia a dia: quem define o território do dia,
                quem dirige, quem marca as casas no cartão e quem administra usuários e permissões. O
                objetivo é manter o serviço coordenado, legível e com histórico confiável.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="tab-atualizacoes" className="space-y-5">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <p className={SECTION_HEADING_CLASS}>Versão atual</p>
                <p className="mt-1 text-[28px] font-semibold tracking-tight">{APP_VERSION}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unidos por Jeová · CAMPO
                </p>
              </div>
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300">
                Atual
              </Badge>
            </CardContent>
          </Card>

          <section>
            <h2 className={SECTION_HEADING_CLASS}>O que entrou nesta versão</h2>
            <ul className="space-y-3">
              {updates.map((group) => (
                <li key={group.title}>
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-[15px] font-semibold tracking-tight">{group.title}</h3>
                      <ul className="mt-2.5 space-y-1.5">
                        {group.items.map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-[14px] leading-relaxed text-muted-foreground"
                          >
                            <span
                              className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
