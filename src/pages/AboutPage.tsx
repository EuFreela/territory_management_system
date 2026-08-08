import { useState } from 'react';
import {
  IconCheckCircle,
  IconInfo,
  IconMap,
  IconUsers,
} from '@/components/Map/mapIcons';
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

export default function AboutPage() {
  const [tab, setTab] = useState<TabId>('sistema');

  return (
    <main className="app-page max-w-3xl">
      <div className="mb-8 text-center sm:text-left">
        <p className="app-section-title">Sistema</p>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <img
            src="/logo.webp"
            alt="CAMPO"
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-[18px] object-cover shadow-card ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
          />
          <div>
            <h1 className="app-title mt-0 tracking-tightish">CAMPO</h1>
            <p className="app-subtitle mt-1 max-w-xl">
              Organização de territórios e do trabalho de campo em um só lugar.
            </p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div
        className="mb-6 inline-flex w-full rounded-full border border-apple-line bg-apple-fill p-1 sm:w-auto"
        role="tablist"
        aria-label="Seções sobre o CAMPO"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sistema'}
          id="tab-sistema"
          onClick={() => setTab('sistema')}
          className={[
            'flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-5',
            tab === 'sistema'
              ? 'bg-apple-surface text-apple-ink shadow-soft'
              : 'text-apple-secondary hover:text-apple-ink',
          ].join(' ')}
        >
          O sistema
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'atualizacoes'}
          id="tab-atualizacoes"
          onClick={() => setTab('atualizacoes')}
          className={[
            'flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-5',
            tab === 'atualizacoes'
              ? 'bg-apple-surface text-apple-ink shadow-soft'
              : 'text-apple-secondary hover:text-apple-ink',
          ].join(' ')}
        >
          Atualizações
        </button>
      </div>

      {tab === 'sistema' ? (
        <div role="tabpanel" aria-labelledby="tab-sistema" className="space-y-6">
          <section className="app-card-pad">
            <h2 className="text-[17px] font-semibold tracking-tightish text-apple-ink">
              O que é o CAMPO?
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-apple-secondary">
              <p>
                O <span className="font-semibold text-apple-ink">CAMPO</span> é o sistema usado para
                planejar, acompanhar e registrar o trabalho de campo por territórios. Em vez de
                planilhas soltas e papéis, a equipe vê no mapa o que já foi coberto, quem dirige em
                cada horário e o histórico do que já foi finalizado.
              </p>
              <p>
                Cada território vira um cartão com área no mapa, casas e quadras para marcar, e o
                fluxo do <span className="font-medium text-apple-ink">território do dia</span> — o
                destaque atual do serviço — até a finalização com registro de pessoas e data/hora.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-apple-tertiary">
              O que você faz no CAMPO
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="app-card-pad">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-apple-fill text-apple-ink">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[15px] font-semibold tracking-tightish text-apple-ink">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-apple-secondary">{text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="app-card-pad">
            <h2 className="text-[17px] font-semibold tracking-tightish text-apple-ink">
              Para quem é
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-apple-secondary">
              Foi pensado para quem organiza o campo no dia a dia: quem define o território do dia,
              quem dirige, quem marca as casas no cartão e quem administra usuários e permissões. O
              objetivo é manter o serviço coordenado, legível e com histórico confiável.
            </p>
          </section>
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="tab-atualizacoes" className="space-y-5">
          <section className="app-card-pad flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-apple-tertiary">
                Versão atual
              </p>
              <p className="mt-1 text-[28px] font-semibold tracking-tightish text-apple-ink">
                {APP_VERSION}
              </p>
              <p className="mt-1 text-[14px] text-apple-secondary">
                Congregação Alpinópolis · CAMPO
              </p>
            </div>
            <span className="app-badge-blue">Atual</span>
          </section>

          <section>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-apple-tertiary">
              O que entrou nesta versão
            </h2>
            <ul className="space-y-3">
              {updates.map((group) => (
                <li key={group.title} className="app-card-pad">
                  <h3 className="text-[15px] font-semibold tracking-tightish text-apple-ink">
                    {group.title}
                  </h3>
                  <ul className="mt-2.5 space-y-1.5">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-[14px] leading-relaxed text-apple-secondary"
                      >
                        <span
                          className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-apple-blue"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
