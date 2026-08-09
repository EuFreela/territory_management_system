import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { LoadingScreen } from '@/components/ui/Spinner';
import type { FinishedTerritoryHistory } from '@/lib/types';

/** Registros por folha A4 */
const ROWS_PER_PAGE = 8;

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const raw = String(iso).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const s = String(iso).replace('T', ' ').slice(0, 16);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) return `${m[4]}:${m[5]}`;
    return String(iso);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function fmtDateTime(iso: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(iso instanceof Date ? iso : new Date(iso));
}

const REP_CSS = `
  .rep-root {
    --noir: #111111;
    --white: #ffffff;
    --zinc-900: #18181b;
    --zinc-700: #3f3f46;
    --zinc-600: #52525b;
    --zinc-500: #71717a;
    --stone-50: #fafaf9;
    --stone-100: #f5f5f4;
    --stone-200: #e7e5e4;
    --stone-300: #d6d3d1;
    --stone-400: #a8a29e;
    --stone-500: #78716c;
    --desk: #e8e6e2;

    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    color: var(--zinc-900);
    background: var(--desk);
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
    font-size: 10.5pt;
    margin: 0;
  }

  .rep-root * { box-sizing: border-box; }

  /* Barra de ações na tela */
  .rep-toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1.25rem;
    background: rgba(255, 255, 255, 0.92);
    border-bottom: 1px solid var(--stone-200);
    backdrop-filter: blur(10px);
  }

  .rep-toolbar p { margin: 0; font-size: 0.85rem; color: var(--zinc-600); }
  .rep-toolbar strong { color: var(--zinc-900); font-weight: 500; }
  .rep-toolbar .rep-actions { display: flex; gap: 0.5rem; }

  .rep-btn {
    border: 0;
    border-radius: 9999px;
    background: var(--zinc-900);
    color: var(--white);
    padding: 0.65rem 1.25rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .rep-btn:hover { background: var(--zinc-700); }

  .rep-btn-ghost {
    background: transparent;
    color: var(--zinc-900);
    border: 1px solid var(--stone-300);
  }
  .rep-btn-ghost:hover { background: var(--stone-100); }

  .rep-sheet-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18mm;
    padding: 12mm 8mm 24mm;
  }

  .rep-page {
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    padding: 14mm 16mm;
    background: var(--white);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .rep-page-inner { flex: 1; min-height: 0; display: flex; flex-direction: column; width: 100%; max-width: 178mm; }

  .rep-page-foot {
    margin-top: auto;
    padding-top: 4mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8pt;
    letter-spacing: 0.04em;
    color: var(--zinc-500);
    border-top: 1px solid var(--stone-200);
  }
  .rep-page-foot .rep-page-num::before { content: 'Folha '; }

  .rep-page.rep-cover {
    padding: 0;
    background: var(--noir);
    color: var(--white);
    justify-content: flex-end;
  }
  .rep-page.rep-cover .rep-page-inner {
    max-width: none;
    width: 100%;
    height: 100%;
    padding: 22mm 18mm 18mm;
    justify-content: flex-end;
    position: relative;
  }
  .rep-page.rep-cover .rep-page-inner::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.14), transparent 30%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 28%, rgba(0, 0, 0, 0.35) 100%);
    pointer-events: none;
  }
  .rep-cover-content { position: relative; z-index: 1; }

  .rep-cover-logo {
    height: 24mm;
    width: auto;
    max-width: 42mm;
    object-fit: contain;
    margin-bottom: 14mm;
    display: block;
    background: var(--white);
    border-radius: 4mm;
    padding: 3mm;
  }

  .rep-eyebrow {
    margin: 0;
    font-size: 8pt;
    font-weight: 500;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--stone-500);
  }
  .rep-cover .rep-eyebrow { color: rgba(255, 255, 255, 0.55); }

  .rep-h1 {
    margin: 3mm 0 0;
    font-weight: 300;
    font-size: 27pt;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--white);
  }
  .rep-h2 {
    margin: 2mm 0 0;
    font-weight: 300;
    font-size: 18pt;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--zinc-900);
  }
  .rep-h3 { margin: 5mm 0 2mm; font-weight: 500; font-size: 10pt; color: var(--zinc-900); }

  .rep-p { margin: 2.5mm 0 0; color: var(--zinc-600); font-size: 9.5pt; }

  .rep-lead { margin-top: 4mm; max-width: 120mm; color: rgba(255, 255, 255, 0.78); font-size: 11pt; line-height: 1.5; }

  .rep-meta { margin-top: 8mm; display: flex; flex-wrap: wrap; gap: 2mm 6mm; font-size: 9pt; color: rgba(255, 255, 255, 0.45); }

  .rep-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3mm;
    margin-top: 4mm;
  }

  .rep-card {
    background: var(--stone-50);
    border: 1px solid var(--stone-200);
    border-radius: 3mm;
    padding: 3.5mm 4mm;
  }
  .rep-card p { margin-top: 1.5mm; color: var(--zinc-600); font-size: 9.5pt; }
  .rep-card .rep-eyebrow { font-size: 7.5pt; }
  .rep-card strong,
  .rep-card .rep-value {
    display: block;
    margin-top: 1.5mm;
    color: var(--zinc-900);
    font-weight: 500;
    font-size: 11pt;
    font-variant-numeric: tabular-nums;
  }

  .rep-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 3mm;
    font-size: 8.5pt;
    background: var(--white);
    border-radius: 2.5mm;
    overflow: hidden;
    border: 1px solid var(--stone-200);
  }
  .rep-table th,
  .rep-table td {
    text-align: left;
    padding: 2mm 2.5mm;
    border-bottom: 1px solid var(--stone-200);
    vertical-align: top;
  }
  .rep-table th {
    background: var(--stone-50);
    font-weight: 500;
    color: var(--zinc-900);
    font-size: 7.5pt;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .rep-table td { color: var(--zinc-600); }
  .rep-table tr:last-child td { border-bottom: 0; }
  .rep-table .num { font-variant-numeric: tabular-nums; }
  .rep-table .strong { color: var(--zinc-900); font-weight: 500; }
  .rep-table--fixed { table-layout: fixed; }
  .rep-table--fixed th,
  .rep-table--fixed td {
    overflow: hidden;
    white-space: nowrap;
  }

  /* Registros por extenso (legíveis, sem tabela) */
  .rep-record {
    margin-top: 3mm;
    border: 1px solid var(--stone-200);
    border-radius: 3mm;
    padding: 3mm 4mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .rep-record__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2mm 3mm;
    margin-bottom: 2mm;
  }
  .rep-record__num {
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--stone-500);
  }
  .rep-record__head strong {
    font-size: 10.5pt;
    font-weight: 500;
    color: var(--zinc-900);
  }
  .rep-record__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.2mm 6mm;
  }
  .rep-record__row {
    display: flex;
    justify-content: space-between;
    gap: 2mm;
    font-size: 9pt;
    line-height: 1.5;
  }
  .rep-record__row span { color: var(--zinc-500); }
  .rep-record__row strong { color: var(--zinc-900); font-weight: 500; text-align: right; }

  .rep-note { margin-top: 3mm; font-size: 8.5pt; color: var(--stone-500); }

  .rep-empty {
    width: 210mm;
    min-height: 297mm;
    background: var(--white);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
    margin: 12mm auto;
    padding: 24mm 18mm;
  }
  .rep-empty h1 { margin: 3mm 0 0; font-weight: 300; font-size: 22pt; color: var(--zinc-900); }

  @page { size: A4 portrait; margin: 0; }

  @media print {
    body { background: none !important; }
    .rep-root { background: none; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rep-toolbar { display: none !important; }
    .rep-sheet-stack { display: block; padding: 0; gap: 0; }
    .rep-page {
      width: 210mm;
      height: 297mm;
      min-height: 297mm;
      max-height: 297mm;
      margin: 0;
      box-shadow: none;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
    }
    .rep-page:last-child { page-break-after: auto; break-after: auto; }
  }

  @media screen and (max-width: 230mm) { .rep-sheet-stack { transform-origin: top center; transform: scale(0.92); margin-bottom: -8%; } }
  @media screen and (max-width: 200mm) { .rep-sheet-stack { transform: scale(0.78); margin-bottom: -22%; } }
  @media screen and (max-width: 170mm) { .rep-sheet-stack { transform: scale(0.62); margin-bottom: -38%; } }
`;

type ReportRow = FinishedTerritoryHistory;

export default function RelatorioFinalizadosPage() {
  const [params] = useSearchParams();
  const ids = useMemo(() => {
    const raw = params.get('ids') ?? '';
    return new Set(raw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0));
  }, [params]);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ReportRow[]>('/api/territories/finished-history')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar histórico.'))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => rows.filter((r) => ids.has(Number(r.id))), [rows, ids]);

  const totals = useMemo(() => {
    // Um registro por território (o mais recente) para não somar duplicados
    const latestByTerritory = new Map<number | string, ReportRow>();
    for (const r of selected) {
      const key =
        r.territory_id != null && Number.isFinite(Number(r.territory_id))
          ? Number(r.territory_id)
          : (r.territory_name?.trim() ?? '');
      const prev = latestByTerritory.get(key);
      if (!prev || Number(r.id) > Number(prev.id)) latestByTerritory.set(key, r);
    }
    const perTerritory = [...latestByTerritory.values()];

    const days = new Set(selected.map((r) => String(r.field_date ?? '').slice(0, 10)));
    const towns = new Set(perTerritory.map((r) => r.territory_name?.trim()).filter(Boolean));
    const leaders = new Set(selected.map((r) => r.leader_name?.trim()).filter(Boolean));
    const sortedDays = [...days].sort();
    return {
      count: selected.length,
      people: selected.reduce((a, r) => a + (r.people_count ?? 0), 0),
      restam: perTerritory.reduce((a, r) => a + (r.restam_casas ?? 0), 0),
      casas: perTerritory.reduce((a, r) => a + (r.casas_count ?? 0), 0),
      territorios: towns.size,
      dirigentes: leaders.size,
      dias: days.size,
      periodo: sortedDays.length
        ? `${fmtDate(sortedDays[0])} – ${fmtDate(sortedDays[sortedDays.length - 1])}`
        : '—',
    };
  }, [selected]);

  const chunks = useMemo(() => {
    const out: ReportRow[][] = [];
    for (let i = 0; i < selected.length; i += ROWS_PER_PAGE) {
      out.push(selected.slice(i, i + ROWS_PER_PAGE));
    }
    return out;
  }, [selected]);

  if (loading) {
    return <LoadingScreen label="Preparando relatório…" />;
  }

  return (
    <div className="rep-root">
      <style>{REP_CSS}</style>

      <div className="rep-toolbar">
        <p>
          <strong>Pré-visualização A4</strong> — cada bloco = 1 folha (210×297&nbsp;mm) ·{' '}
          {selected.length} registro(s) selecionado(s)
        </p>
        <div className="rep-actions">
          <Link className="rep-btn rep-btn-ghost" to="/territories/finalizados">
            Voltar
          </Link>
          <button className="rep-btn" type="button" onClick={() => window.print()}>
            Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {error ? (
        <div className="rep-empty">
          <p className="rep-eyebrow">Campo · Relatório</p>
          <h1>Erro ao gerar relatório</h1>
          <p className="rep-p">{error}</p>
        </div>
      ) : selected.length === 0 ? (
        <div className="rep-empty">
          <p className="rep-eyebrow">Campo · Relatório</p>
          <h1>Nenhum registro selecionado</h1>
          <p className="rep-p">
            Volte para a página{' '}
            <Link className="rep-btn rep-btn-ghost" to="/territories/finalizados">
              Finalizados
            </Link>{' '}
            e marque no checklist as linhas que devem entrar no relatório.
          </p>
        </div>
      ) : (
        <div className="rep-sheet-stack">
          {/* 01 CAPA */}
          <article className="rep-page rep-cover">
            <div className="rep-page-inner">
              <div className="rep-cover-content">
                <img className="rep-cover-logo" src="/logo.webp" alt="Campo" />
                <p className="rep-eyebrow">Campo · Relatório</p>
                <h1 className="rep-h1">Territórios Finalizados</h1>
                <p className="rep-lead">
                  Relatório das finalizações registradas no sistema: dia, horário, território,
                  dirigente, pessoas no campo e casas que restaram no não em casa.
                </p>
                <div className="rep-meta">
                  <span>Gerado em {fmtDateTime(new Date())}</span>
                  <span>{totals.count} registro(s)</span>
                  <span>{totals.dias} dia(s) de campo</span>
                </div>
              </div>
            </div>
          </article>

          {/* 02 RESUMO */}
          <article className="rep-page">
            <div className="rep-page-inner">
              <p className="rep-eyebrow">01 · Resumo</p>
              <h2 className="rep-h2">Visão geral</h2>
              <p className="rep-p">
                Síntese dos registros selecionados. O detalhamento por linha está nas páginas
                seguintes.
              </p>

              <div className="rep-grid-3">
                <div className="rep-card">
                  <p className="rep-eyebrow">Registros</p>
                  <span className="rep-value">{totals.count}</span>
                </div>
                <div className="rep-card">
                  <p className="rep-eyebrow">Pessoas no campo</p>
                  <span className="rep-value">{totals.people}</span>
                </div>
                <div className="rep-card">
                  <p className="rep-eyebrow">Casas restantes</p>
                  <span className="rep-value">{totals.restam}</span>
                </div>
              </div>

              <h3 className="rep-h3">Dados do relatório</h3>
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>Atributo</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Período coberto</td>
                    <td className="strong">{totals.periodo}</td>
                  </tr>
                  <tr>
                    <td>Territórios distintos</td>
                    <td className="strong">{totals.territorios}</td>
                  </tr>
                  <tr>
                    <td>Dirigentes distintos</td>
                    <td className="strong">{totals.dirigentes}</td>
                  </tr>
                  <tr>
                    <td>Casas de não em casa (total)</td>
                    <td className="num">{totals.casas}</td>
                  </tr>
                  <tr>
                    <td>Dias de campo</td>
                    <td className="num">{totals.dias}</td>
                  </tr>
                </tbody>
              </table>

              <div className="rep-page-foot">
                <span>Campo · Relatório de Territórios Finalizados</span>
                <span className="rep-page-num">02</span>
              </div>
            </div>
          </article>

          {/* 03+ REGISTROS */}
          {chunks.map((chunk, ci) => (
            <article key={ci} className="rep-page">
              <div className="rep-page-inner">
                <p className="rep-eyebrow">02 · Registros</p>
                <h2 className="rep-h2">Relação de finalizações</h2>
                <p className="rep-p">
                  {ci + 1} de {chunks.length} — registros {ci * ROWS_PER_PAGE + 1} a{' '}
                  {ci * ROWS_PER_PAGE + chunk.length} de {selected.length}.
                </p>

                {chunk.map((row, ri) => (
                  <div key={row.id} className="rep-record">
                    <div className="rep-record__head">
                      <span className="rep-record__num">Registro nº {ci * ROWS_PER_PAGE + ri + 1}</span>
                      <strong>
                        {row.territory_name}
                        {row.territory_number ? ` · Terr. N.º ${row.territory_number}` : ''}
                      </strong>
                    </div>
                    <div className="rep-record__grid">
                      <div className="rep-record__row">
                        <span>Dia</span>
                        <strong>{fmtDate(row.field_date)}</strong>
                      </div>
                      <div className="rep-record__row">
                        <span>Fim</span>
                        <strong>{fmtTime(row.finished_at)}</strong>
                      </div>
                      <div className="rep-record__row">
                        <span>Dirigente</span>
                        <strong>{row.leader_name?.trim() || '—'}</strong>
                      </div>
                      <div className="rep-record__row">
                        <span>Pessoas presentes</span>
                        <strong>
                          {row.people_count != null
                            ? `${row.people_count} ${row.people_count === 1 ? 'pessoa' : 'pessoas'}`
                            : '—'}
                        </strong>
                      </div>
                      <div className="rep-record__row">
                        <span>Casas restantes no não em casa</span>
                        <strong>
                          {row.restam_casas != null
                            ? `${row.restam_casas} ${row.restam_casas === 1 ? 'casa' : 'casas'}`
                            : '—'}
                        </strong>
                      </div>
                      <div className="rep-record__row">
                        <span>Registro</span>
                        <strong>{row.finished_by_name?.trim() || '—'}</strong>
                      </div>
                    </div>
                  </div>
                ))}

                <p className="rep-note">
                  «Casas restantes» = casas do não em casa que ainda não foram marcadas no momento da
                  finalização.
                </p>

                <div className="rep-page-foot">
                  <span>Campo · Relatório de Territórios Finalizados</span>
                  <span className="rep-page-num">{String(ci + 3).padStart(2, '0')}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
