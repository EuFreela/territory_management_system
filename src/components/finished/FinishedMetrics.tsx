import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  IconCheckCircle,
  IconHome,
  IconStar,
  IconUsers,
} from '@/components/Map/mapIcons';
import { cn } from '@/lib/utils';
import type { FinishedTerritoryHistory } from '@/lib/types';

type FinishedMetricsProps = {
  rows: FinishedTerritoryHistory[];
};

type DayMetric = {
  dia: string;
  full: string;
  finalizacoes: number;
  pessoas: number;
  quadras: number;
  ruas: number;
  casas: number;
  restam: number;
};

type LeaderMetric = {
  nome: string;
  finalizacoes: number;
  pessoas: number;
  quadras: number;
  ruas: number;
  casas: number;
};

function fmtDia(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}` : String(iso).slice(0, 10);
}

function fmtDiaLongo(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!d || !m || !y) return String(iso).slice(0, 10);
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#64748b',
];

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-xs">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pt-1">{children}</CardContent>
    </Card>
  );
}

const AXIS_STYLE = { fontSize: 11 };

const METRIC_LABELS: Record<string, string> = {
  finalizacoes: 'Finalizações',
  pessoas: 'Pessoas',
  quadras: 'Quadras',
  ruas: 'Ruas',
  casas: 'Casas',
};

const LINE_SERIES = ['finalizacoes', 'pessoas', 'quadras', 'ruas', 'casas'] as const;

export default function FinishedMetrics({ rows }: FinishedMetricsProps) {
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const {
    byDay,
    byLeaderPie,
    topLeaders,
    radarData,
    radial,
    stats,
  } = useMemo(() => {
    const dayMap = new Map<string, DayMetric>();
    const leaderMap = new Map<string, LeaderMetric>();

    for (const r of rows) {
      const iso = String(r.field_date ?? '').slice(0, 10);
      if (iso) {
        const cur = dayMap.get(iso) ?? {
          dia: fmtDia(iso),
          full: fmtDiaLongo(iso),
          finalizacoes: 0,
          pessoas: 0,
          quadras: 0,
          ruas: 0,
          casas: 0,
          restam: 0,
        };
        cur.finalizacoes += 1;
        cur.pessoas += r.people_count ?? 0;
        cur.quadras += r.quadras_count ?? 0;
        cur.ruas += r.ruas_count ?? 0;
        cur.casas += r.casas_count ?? 0;
        cur.restam += r.restam_casas ?? 0;
        dayMap.set(iso, cur);
      }

      const nome = r.leader_name?.trim() || 'Sem dirigente';
      const l = leaderMap.get(nome) ?? {
        nome,
        finalizacoes: 0,
        pessoas: 0,
        quadras: 0,
        ruas: 0,
        casas: 0,
      };
      l.finalizacoes += 1;
      l.pessoas += r.people_count ?? 0;
      l.quadras += r.quadras_count ?? 0;
      l.ruas += r.ruas_count ?? 0;
      l.casas += r.casas_count ?? 0;
      leaderMap.set(nome, l);
    }

    const byDay = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    const allLeaders = [...leaderMap.values()].sort(
      (a, b) => b.finalizacoes - a.finalizacoes || b.pessoas - a.pessoas,
    );

    const topLeaders = allLeaders.slice(0, 3);

    const byLeaderPie = (() => {
      const top = allLeaders.slice(0, 6);
      const rest = allLeaders.slice(6);
      const restSum = rest.reduce((acc, l) => acc + l.finalizacoes, 0);
      return restSum > 0
        ? [...top.map((l) => ({ dirigente: l.nome, finalizacoes: l.finalizacoes })), { dirigente: 'Outros', finalizacoes: restSum }]
        : top.map((l) => ({ dirigente: l.nome, finalizacoes: l.finalizacoes }));
    })();

    const radarData = (() => {
      return LINE_SERIES.map((k) => {
        const max = Math.max(...topLeaders.map((l) => l[k]), 1);
        const row: Record<string, number | string> = { metric: METRIC_LABELS[k] };
        topLeaders.forEach((l, i) => {
          row[`lead${i}`] = Math.round((l[k] / max) * 100);
        });
        return row;
      });
    })();

    const totalCasas = byDay.reduce((acc, d) => acc + d.casas, 0);
    const restamCasas = byDay.reduce((acc, d) => acc + d.restam, 0);
    const totalPessoas = byDay.reduce((acc, d) => acc + d.pessoas, 0);
    const dias = byDay.length;

    const visitadas = Math.max(totalCasas - restamCasas, 0);
    const radial = {
      total: totalCasas,
      restam: restamCasas,
      visitadas,
      pct: totalCasas > 0 ? Math.round((visitadas / totalCasas) * 100) : 0,
      angle: totalCasas > 0 ? (visitadas / totalCasas) * 360 : 0,
    };

    const stats = {
      registros: rows.length,
      pessoas: totalPessoas,
      casas: totalCasas,
      mediaPessoas: dias > 0 ? totalPessoas / dias : 0,
      dias,
      primeiroDia: dias > 0 ? byDay[0].dia : null,
      ultimoDia: dias > 0 ? byDay[byDay.length - 1].dia : null,
    };

    return { byDay, byLeaderPie, topLeaders, radarData, radial, stats };
  }, [rows]);

  const rangeData = useMemo(() => byDay.slice(-Number(range)), [byDay, range]);

  const chartConfig = {
    finalizacoes: { label: 'Finalizações', color: '#3b82f6' },
    pessoas: { label: 'Pessoas', color: '#10b981' },
    quadras: { label: 'Quadras', color: '#f59e0b' },
    ruas: { label: 'Ruas', color: '#8b5cf6' },
    casas: { label: 'Casas', color: '#0ea5e9' },
    visitadas: { label: 'Casas visitadas', color: '#10b981' },
  } satisfies ChartConfig;

  const pieConfig = Object.fromEntries(
    byLeaderPie.map((l, i) => [
      l.dirigente,
      { label: l.dirigente, color: PALETTE[i % PALETTE.length] },
    ]),
  ) as ChartConfig;

  const radarConfig = Object.fromEntries(
    topLeaders.map((l, i) => [`lead${i}`, { label: l.nome, color: PALETTE[i % PALETTE.length] }]),
  ) as ChartConfig;

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-10 text-center">
          <IconCheckCircle className="mb-3 size-8 text-emerald-500" />
          <p className="text-sm font-medium">Nenhum dado para exibir</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Os gráficos aparecem quando houver finalizações registradas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const periodo = stats.primeiroDia && stats.ultimoDia
    ? `${stats.primeiroDia} a ${stats.ultimoDia}`
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<IconStar className="size-4" />}
          label="Finalizações"
          value={String(stats.registros)}
          hint={periodo ?? undefined}
        />
        <StatCard
          icon={<IconUsers className="size-4" />}
          label="Pessoas alcançadas"
          value={stats.pessoas.toLocaleString('pt-BR')}
          hint={stats.dias > 0 ? `${stats.mediaPessoas.toFixed(1)} por dia` : undefined}
        />
        <StatCard
          icon={<IconHome className="size-4" />}
          label="Não em casa (casas)"
          value={stats.casas.toLocaleString('pt-BR')}
          hint={radial.total > 0 ? `${radial.pct}% visitadas` : undefined}
        />
        <StatCard
          icon={<IconCheckCircle className="size-4" />}
          label="Dias com registro"
          value={String(byDay.length)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Métricas por dia — Linha"
          description="Finalizações, pessoas e não em casa, cada uma como linha independente"
          className="lg:col-span-2"
        >
          <ChartContainer config={chartConfig} className="h-64 aspect-auto">
            <LineChart data={byDay} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={AXIS_STYLE}
                minTickGap={32}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={AXIS_STYLE}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelKey="full" indicator="dot" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {LINE_SERIES.map((key) => (
                <Line
                  key={key}
                  dataKey={key}
                  type="monotone"
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="Pessoas por dia — Área interativa"
          description="Passe o cursor sobre a área para ver detalhes do dia"
          className="lg:col-span-2"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Últimos <span className="font-medium text-foreground">{range}</span> dias
            </p>
            <div
              className="inline-flex rounded-full bg-muted p-1"
              role="tablist"
              aria-label="Período do gráfico"
            >
              {(['7', '30', '90'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'h-7 rounded-full px-3 text-xs font-medium transition',
                    range === r
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
          <ChartContainer config={chartConfig} className="h-56 aspect-auto">
            <AreaChart data={rangeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPessoas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-pessoas)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--color-pessoas)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={AXIS_STYLE}
                minTickGap={32}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={AXIS_STYLE}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelKey="full" indicator="dot" />}
              />
              <Area
                dataKey="pessoas"
                type="natural"
                fill="url(#gradPessoas)"
                stroke="var(--color-pessoas)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="Não em casa por dia — Barras"
          description="Quadras, ruas e casas registradas como não em casa (empilhado)"
        >
          <ChartContainer config={chartConfig} className="h-64 aspect-auto">
            <BarChart data={byDay} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={AXIS_STYLE}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={AXIS_STYLE}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="quadras"
                stackId="nec"
                fill="var(--color-quadras)"
                maxBarSize={48}
              />
              <Bar
                dataKey="ruas"
                stackId="nec"
                fill="var(--color-ruas)"
                maxBarSize={48}
              />
              <Bar
                dataKey="casas"
                stackId="nec"
                fill="var(--color-casas)"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="Finalizações por dirigente — Pizza"
          description="Participação de cada dirigente no total de finalizações"
        >
          <ChartContainer
            config={pieConfig}
            className="mx-auto aspect-square max-h-[240px]"
          >
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={byLeaderPie}
                dataKey="finalizacoes"
                nameKey="dirigente"
                innerRadius={55}
                outerRadius={90}
                strokeWidth={2}
              >
                {byLeaderPie.map((entry, i) => (
                  <Cell key={entry.dirigente} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ChartLegend
            content={<ChartLegendContent nameKey="dirigente" className="flex flex-wrap justify-center gap-x-4 gap-y-1" />}
          />
        </ChartCard>

        <ChartCard
          title="Perfil dos dirigentes — Radar"
          description="Top 3 dirigentes comparados em cada métrica (normalizado a 100%)"
        >
          <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[260px]">
            <RadarChart data={radarData}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={AXIS_STYLE} />
              {topLeaders.map((l, i) => (
                <Radar
                  key={l.nome}
                  dataKey={`lead${i}`}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity={0.2}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ChartContainer>
          <ChartLegend content={<ChartLegendContent />} />
        </ChartCard>

        <ChartCard
          title="Casas não em casa visitadas — Radial"
          description="Progresso do que já foi visitado nos territórios finalizados"
        >
          <ChartContainer
            config={chartConfig}
            className="relative mx-auto aspect-square max-h-[240px]"
          >
            <RadialBarChart
              data={[{ key: 'visitadas', value: radial.visitadas }]}
              startAngle={90}
              endAngle={90 + radial.angle}
              innerRadius={55}
              outerRadius={95}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, radial.total || 1]}
                dataKey="value"
                tick={false}
              />
              <RadialBar
                dataKey="value"
                background
                cornerRadius={8}
                fill="var(--color-visitadas)"
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            </RadialBarChart>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums">{radial.pct}%</span>
              <span className="text-xs text-muted-foreground">visitadas</span>
            </div>
          </ChartContainer>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {radial.visitadas.toLocaleString('pt-BR')} de {radial.total.toLocaleString('pt-BR')}{' '}
            casas não em casa
          </p>
        </ChartCard>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Período: {stats.primeiroDia && stats.ultimoDia ? (
          <span className="font-medium text-foreground">
            {stats.primeiroDia} a {stats.ultimoDia}
          </span>
        ) : (
          'sem registros'
        )}
        {' · '}
        {stats.registros} finalização(ões), {stats.pessoas.toLocaleString('pt-BR')} pessoa(s) e{' '}
        {stats.casas.toLocaleString('pt-BR')} casa(s) não em casa.
      </p>
    </div>
  );
}
