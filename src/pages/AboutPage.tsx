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
    text: 'Cadastre cartões com localidade e número, desenhe áreas no mapa (Google Maps no Leaflet), confira a imagem do cartão, use sua localização GPS e a rota mais curta até a quadra mais próxima.',
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
                  Congregação Alpinópolis · CAMPO
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
