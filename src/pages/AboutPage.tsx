import { useState } from 'react';
import {
  IconCheckCircle,
  IconInfo,
  IconMap,
  IconUsers,
} from '@/components/Map/mapIcons';

/** Versão atual do CAMPO (exibida em Sobre → Atualizações) */
export const APP_VERSION = 'v0.0.4';

const features = [
  {
    icon: IconMap,
    title: 'Territórios e mapa',
    text: 'Cadastre cartões de território com localidade e número, desenhe áreas no mapa e organize o trabalho de campo com clareza visual.',
  },
  {
    icon: IconCheckCircle,
    title: 'Checklist de casas',
    text: 'Marque casas e quadras visitadas, acompanhe o progresso e finalize o território do dia registrando quantas pessoas estavam no campo.',
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
      'Busca por endereço no mapa (geocoding) com pin e voo até o local',
    ],
  },
  {
    title: 'Mapa e checklist (não em casa)',
    items: [
      'Tela cheia e botão para reenquadrar as áreas do mapa',
      'Confirmação ao desmarcar casa; limpar destaque; refazer ponto/área',
      'Destaque bidirecional entre mapa e cartões de não em casa',
      'Seleção mapa/cartão sem scroll indesejado; status finalizado em cinza',
      'Exclusão em massa de registros de não em casa e botão voltar ao topo',
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
