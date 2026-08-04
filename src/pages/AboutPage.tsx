import {
  IconCheckCircle,
  IconInfo,
  IconMap,
  IconUsers,
} from '@/components/Map/mapIcons';

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

export default function AboutPage() {
  return (
    <main className="app-page max-w-3xl">
      <div className="mb-10 text-center sm:text-left">
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

      <section className="app-card-pad mb-6">
        <h2 className="text-[17px] font-semibold tracking-tightish text-apple-ink">O que é o CAMPO?</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-apple-secondary">
          <p>
            O <span className="font-semibold text-apple-ink">CAMPO</span> é o sistema usado para
            planejar, acompanhar e registrar o trabalho de campo por territórios. Em vez de
            planilhas soltas e papéis, a equipe vê no mapa o que já foi coberto, quem dirige em cada
            horário e o histórico do que já foi finalizado.
          </p>
          <p>
            Cada território vira um cartão com área no mapa, casas e quadras para marcar, e o fluxo
            do <span className="font-medium text-apple-ink">território do dia</span> — o destaque
            atual do serviço — até a finalização com registro de pessoas e data/hora.
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-apple-tertiary">
          O que você faz no CAMPO
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="app-card-pad">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-apple-fill text-apple-ink">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tightish text-apple-ink">{title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-apple-secondary">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="app-card-pad">
        <h2 className="text-[17px] font-semibold tracking-tightish text-apple-ink">Para quem é</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-apple-secondary">
          Foi pensado para quem organiza o campo no dia a dia: quem define o território do dia,
          quem dirige, quem marca as casas no cartão e quem administra usuários e permissões. O
          objetivo é manter o serviço coordenado, legível e com histórico confiável.
        </p>
      </section>
    </main>
  );
}
