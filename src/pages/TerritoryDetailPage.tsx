import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  IconArrowLeft,
  IconCheck,
  IconCheckCircle,
  IconColumns,
  IconDownload,
  IconHome,
  IconImage,
  IconMap,
  IconPencil,
  IconRows,
  IconStar,
  IconTrash,
  IconUnlink,
  IconX,
} from '@/components/Map/mapIcons';
import TerritoryImageLeafletMap from '@/components/Map/TerritoryImageLeafletMap';
import TerritoryMap, {
  areaMatchesBlock,
  findAreaForBlock,
  parseGeoJsonToAreas,
  parseGeoJsonToNotes,
  resolveAreaByKey,
} from '@/components/Map/TerritoryMap';
import { confirmToast } from '@/lib/confirm-toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DailyTerritoryModal from '@/components/territory/DailyTerritoryModal';
import BackupLeadersModal from '@/components/territory/BackupLeadersModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { renderMapCanvas } from '@/lib/map-card-image';
import { hasTerritoryCardImage } from '@/lib/territory-map-image';
import { tooltipText } from '@/lib/tooltip';
import { cn } from '@/lib/utils';
import type { Block, CepLocation, FieldAssignment, Territory } from '@/lib/types';

type MapViewTab = 'mapa' | 'imagem' | 'mapa-imagem';

const LINK_CLASS = 'font-medium text-primary underline underline-offset-4';

/** Data e hora em pt-BR: dd/mm/aaaa hh:mm */
function fmtDateTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export default function TerritoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [mapConfig, setMapConfig] = useState<CepLocation | null>(null);
  const [error, setError] = useState('');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  /** chave compartilhada mapa ↔ card (nome da quadra / rótulo da área) */
  const [linkedKey, setLinkedKey] = useState<string | null>(null);
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const [linkHint, setLinkHint] = useState('');
  /** Aba: mapa interativo (Leaflet) ou imagem estática do cartão */
  const [mapViewTab, setMapViewTab] = useState<MapViewTab>('mapa');
  /** Modal de comparação Mapa & Imagem aberta? */
  const [splitOpen, setSplitOpen] = useState(false);
  /** Orientação dos quadros: horizontal = lado a lado; vertical = um sobre o outro */
  const [splitOrientation, setSplitOrientation] = useState<'horizontal' | 'vertical'>(
    'horizontal',
  );
  /** Incrementa ao girar a orientação p/ invalidateSize nos dois Leaflet */
  const [splitResizeToken, setSplitResizeToken] = useState(0);
  /** Mantém painéis montados; só redimensiona o Leaflet ao trocar (sem novo load do Google) */
  const [mapResizeToken, setMapResizeToken] = useState(0);
  const [imageResizeToken, setImageResizeToken] = useState(0);
  /** Imagem só monta na 1ª visita à aba — depois permanece no DOM */
  const [imagePanelReady, setImagePanelReady] = useState(false);
  /** Modal: escolher dirigente ao marcar/trocar o território do dia */
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  /** Backup de não em casa em .txt sendo gerado */
  const [backingUp, setBackingUp] = useState(false);
  /** Popup para escolher o dirigente antes de gerar o backup */
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  /** Ref do toggle em andamento — o poll em tempo real ignora o estado otimista */
  const togglingKeyRef = useRef<string | null>(null);

  /** Intervalo de atualização automática do checklist (várias pessoas na mesma rua). */
  const AUTO_REFRESH_MS = 5_000;

  const splitAreas = useMemo(() => parseGeoJsonToAreas(territory?.geojson), [territory?.geojson]);
  const splitNotes = useMemo(() => parseGeoJsonToNotes(territory?.geojson), [territory?.geojson]);
  const splitAreaCount =
    splitAreas.length > 0
      ? `${splitAreas.length} área(s) no território${splitNotes.length ? ` · ${splitNotes.length} nota(s) de atenção` : ''}.`
      : 'Sem áreas definidas.';

  function selectMapView(tab: MapViewTab) {
    setMapViewTab(tab);
    if (tab === 'mapa') {
      setMapResizeToken((n) => n + 1);
    } else if (tab === 'imagem') {
      setImagePanelReady(true);
      setImageResizeToken((n) => n + 1);
    } else {
      setImagePanelReady(true);
      setSplitOpen(true);
      setSplitResizeToken((n) => n + 1);
    }
  }

  /** Fecha a modal e volta para a aba anterior (Mapa) */
  function closeSplit() {
    setSplitOpen(false);
    setMapViewTab('mapa');
    setMapResizeToken((n) => n + 1);
  }

  /** Alterna a orientação dos quadros: horizontal ↔ vertical */
  function rotateSplit() {
    setSplitOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
    setSplitResizeToken((n) => n + 1);
  }

  /** Largura/altura do PNG baixado pelo botão do mapa. */
  const MAP_PRINT_W = 1200;
  const MAP_PRINT_H = 840;

  /**
   * Baixa direto do botão "Imprimir" do mapa: gera o PNG do trecho visível
   * (tiles OSM com nomes de rua + áreas desenhadas) e dispara o download.
   * Nenhuma mensagem de "concluído" é mostrada antes do navegador salvar.
   */
  async function downloadMapCard(
    viewport: { center: [number, number]; zoom: number; bw: boolean } | null,
  ) {
    if (!territory) return;
    try {
      const mapCanvas = await renderMapCanvas(splitAreas, {
        width: MAP_PRINT_W,
        height: MAP_PRINT_H,
        viewport: viewport ?? undefined,
        bw: viewport?.bw ?? false,
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        mapCanvas.toBlob((b) => resolve(b), 'image/png');
      });
      if (!blob) throw new Error('Falha ao gerar o arquivo de imagem.');

      // Dispara o download via <a download>: abre o "Salvar como" e o
      // navegador cuida do progresso (sem mensagem prematura de concluído).
      const link = document.createElement('a');
      link.download = 'mapa-territorio.png';
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a imagem.');
    }
  }

  /** Baixa um arquivo de texto direto no navegador (backup de não em casa). */
  function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /**
   * Backup dos não em casa em .txt: território, quadras/ruas/casas,
   * dirigente do dia (escolhido no popup) e o horário de início dele.
   */
  async function downloadBackup(leader: FieldAssignment | null) {
    if (!territory) return;
    setBackingUp(true);
    try {
      const leaderName = leader?.assignee_name.trim() ?? '';
      const leaderTime = String(leader?.fixed_time ?? '').trim();

      const numberLabel =
        territory.number != null && String(territory.number).trim() !== ''
          ? `${String(territory.number).trim()} — `
          : '';
      const lines: string[] = [];
      lines.push('BACKUP — NÃO EM CASA');
      lines.push('='.repeat(34));
      lines.push('');
      lines.push(`Território: ${numberLabel}${territory.name}`);
      lines.push(`Dirigente do dia: ${leaderName || '—'}`);
      lines.push(`Horário de início: ${leaderTime || '—'}`);
      lines.push(`Gerado em: ${fmtDateTime(new Date())}`);
      lines.push('');
      lines.push('-'.repeat(34));
      lines.push('');

      let streetTotal = 0;
      let houseTotal = 0;
      let doneTotal = 0;

      for (const [quadraName, streetBlocks] of blocksByQuadra) {
        lines.push(`QUADRA: ${quadraName}`);
        streetTotal += streetBlocks.length;
        for (const block of streetBlocks) {
          lines.push(`  RUA: ${block.street_name?.trim() || 'Sem rua'}`);
          const houses = (block.house_numbers ?? []).map((h) => String(h).trim());
          const completed = (block.completed_houses ?? []).map((h) => String(h).trim());
          houseTotal += houses.length;
          for (const house of houses) {
            const checked = completed.some((h) => houseEquals(h, house));
            if (checked) doneTotal += 1;
            lines.push(`    [${checked ? 'x' : ' '}] ${house}`);
          }
        }
        lines.push('');
      }

      if (streetTotal === 0) {
        lines.push('Nenhum registro de não em casa cadastrado.');
        lines.push('');
      } else {
        lines.push('='.repeat(34));
        lines.push(
          `Resumo: ${blocksByQuadra.length} quadra(s) · ${streetTotal} rua(s) · ` +
            `${houseTotal} casa(s) (${doneTotal} marcada(s))`,
        );
        lines.push('');
      }

      const numberSafe =
        String(territory.number ?? '').trim().replace(/[^\w\d-]+/g, '-') || 'sem-numero';
      downloadTextFile(`nao-em-casa-territorio-${numberSafe}.txt`, lines.join('\n'));
    } finally {
      setBackingUp(false);
    }
  }

  // Esc fecha a modal de comparação e trava o scroll do body
  useEffect(() => {
    if (!splitOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeSplit();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitOpen]);

  function loadTerritory() {
    if (!id) return;
    api<Territory>(`/api/territories/${id}`)
      .then((t) => setTerritory(t))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'));
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([api<Territory>(`/api/territories/${id}`), api<CepLocation>('/api/config/map')])
      .then(([t, config]) => {
        setTerritory(t);
        setMapConfig(config);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'));
  }, [id]);

  /**
   * Atualização automática: enquanto a página está aberta, busca o território
   * de novo a cada poucos segundos. Assim, mudanças de "não em casa" feitas
   * por outra pessoa na mesma rua aparecem sem precisar de refresh manual.
   * Erros do poll são silenciosos para não derrubar a tela em falha transitória.
   */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function refresh() {
      try {
        const t = await api<Territory>(`/api/territories/${id}`);
        if (cancelled) return;
        // Não sobrescreve um toggle em andamento nesta aba (estado otimista)
        if (togglingKeyRef.current) return;
        setTerritory(t);
      } catch {
        /* silencioso no poll */
      }
    }

    const timer = window.setInterval(() => void refresh(), AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  function onDelete() {
    if (!id) return;
    confirmToast({
      title: 'Excluir território',
      description:
        'O cartão, as áreas no mapa e os registros de não em casa serão apagados permanentemente.',
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api(`/api/territories/${id}`, { method: 'DELETE' });
          navigate('/territories', { replace: true });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao excluir território.');
        }
      },
    });
  }

  function setDaily() {
    if (!id) return;
    setDailyModalOpen(true);
  }

  function unlinkDaily() {
    if (!id) return;
    confirmToast({
      title: 'Desvincular território do dia',
      description:
        'Este território deixará de ser o destaque do dia. Você poderá marcar outro quando quiser.',
      confirmLabel: 'Desvincular',
      onConfirm: async () => {
        try {
          await api(`/api/territories/${id}/daily`, { method: 'DELETE' });
          const refreshed = await api<Territory>(`/api/territories/${id}`);
          setTerritory(refreshed);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao desvincular.');
        }
      },
    });
  }

  /** Igualdade estrita de número de casa (nunca substring: "1" ≠ "11") */
  function houseEquals(a: string, b: string) {
    return String(a).trim() === String(b).trim();
  }

  function isHouseDone(block: Block, house: string) {
    return (block.completed_houses ?? []).some((h) => houseEquals(h, house));
  }

  function blockProgress(block: Block) {
    const houses = new Set((block.house_numbers ?? []).map((n) => String(n).trim()));
    const completed = new Set((block.completed_houses ?? []).map((n) => String(n).trim()));
    const total = houses.size;
    const done = [...completed].filter((h) => houses.has(h)).length;
    const finished = total > 0 && done >= total;
    return { total, done, finished };
  }

  function isBlockLinked(block: Block) {
    if (!linkedKey) return false;
    if (linkedKey === String(block.id)) return true;
    if (areaMatchesBlock(linkedKey, block.name) || linkedKey === (block.name ?? '').trim()) {
      return true;
    }
    // linkedKey pode ser o id estável da área no mapa
    const area = resolveAreaByKey(parseGeoJsonToAreas(territory?.geojson), linkedKey);
    return area
      ? areaMatchesBlock(area.label, block.name) || area.label === (block.name ?? '').trim()
      : false;
  }

  /** Agrupa ruas pela mesma quadra (name) */
  const blocksByQuadra = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const b of territory?.blocks ?? []) {
      const key = (b.name ?? '').trim() || '—';
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [territory?.blocks]);

  /** Clique no polígono do mapa → destaca por **id** da área (nomes iguais não colidem) */
  function onMapAreaSelect(area: { id: string; label: string }) {
    setLinkedKey(area.id);
    setMapFocusToken((n) => n + 1);
    const blocks = territory?.blocks ?? [];
    const match = blocks.find((b) => areaMatchesBlock(area.label, b.name));
    if (match) {
      setLinkHint('');
    } else {
      setLinkHint(
        `Área “${area.label}” destacada no mapa — nenhum card de não em casa com esse nome.`,
      );
    }
  }

  /** Clique no card → destaca a área no mapa (sem rolar a página) */
  function onBlockCardSelect(block: Block) {
    const name = (block.name ?? '').trim();
    setLinkedKey(name);
    setMapFocusToken((n) => n + 1);

    const areas = parseGeoJsonToAreas(territory?.geojson);
    const mapArea = findAreaForBlock(areas, name);
    if (mapArea) {
      setLinkHint('');
    } else {
      setLinkHint(
        `Nenhuma área no mapa com o nome “${name}”. Confira se a quadra no mapa tem o mesmo rótulo (ex.: ${name}).`,
      );
    }
  }

  async function toggleHouse(block: Block, house: string) {
    if (!id) return;
    if (!can('block:check')) return;
    const currentlyDone = isHouseDone(block, house);
    const done = !currentlyDone;

    // Desmarcar (voltar ao normal) exige confirmação — marcar como feito é imediato
    if (currentlyDone) {
      const street = block.street_name?.trim();
      confirmToast({
        title: 'Desmarcar casa como pendente?',
        description: street
          ? `A casa nº ${house} (${street}) voltará ao estado normal (ainda não feita). Deseja continuar?`
          : `A casa nº ${house} voltará ao estado normal (ainda não feita). Deseja continuar?`,
        confirmLabel: 'Sim, desmarcar',
        onConfirm: () => applyToggleHouse(block, house, done),
      });
      return;
    }

    await applyToggleHouse(block, house, done);
  }

  async function applyToggleHouse(block: Block, house: string, done: boolean) {
    if (!id) return;
    const key = `${block.id}:${house}`;
    setTogglingKey(key);
    togglingKeyRef.current = key;

    // otimista
    setTerritory((prev) => {
      if (!prev?.blocks) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => {
          // Sempre por id da rua/quadra no banco — nunca por nome parcial
          if (b.id !== block.id) return b;
          const current = b.completed_houses ?? [];
          const nextCompleted = done
            ? current.some((h) => houseEquals(h, house))
              ? current
              : [...current, house]
            : current.filter((h) => !houseEquals(h, house));
          const doneCount = nextCompleted.filter((h) =>
            b.house_numbers.some((n) => houseEquals(h, n)),
          ).length;
          return {
            ...b,
            completed_houses: nextCompleted,
            done_count: doneCount,
            total: b.house_numbers.length,
            is_finished: b.house_numbers.length > 0 && doneCount >= b.house_numbers.length,
          };
        }),
      };
    });

    try {
      const updated = await api<Block>(`/api/territories/${id}/blocks/${block.id}/houses`, {
        method: 'PATCH',
        body: JSON.stringify({ house_number: house, done }),
      });
      setTerritory((prev) => {
        if (!prev?.blocks) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map((b) => (b.id === block.id ? { ...b, ...updated } : b)),
        };
      });
    } catch (err) {
      // reverte recarregando
      const refreshed = await api<Territory>(`/api/territories/${id}`);
      setTerritory(refreshed);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar checklist.');
    } finally {
      setTogglingKey(null);
      togglingKeyRef.current = null;
    }
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <p className="text-[15px] text-destructive">{error}</p>
      </main>
    );
  }

  if (!territory) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex min-h-[16rem] items-center justify-center text-muted-foreground">
          <Spinner label="Carregando…" />
        </div>
      </main>
    );
  }

  const hasArea = Boolean(territory.geojson && territory.geojson.length > 10);

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="space-y-6">
          <Card className="gap-0 overflow-hidden p-0">
            <CardContent className="px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-bold tracking-tight">Cartão de Mapa de Território</p>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>
                      <span className="font-medium">Localidade:</span>{' '}
                      <span className="text-lg font-semibold text-foreground">{territory.name}</span>
                    </p>
                    <p>
                      <span className="font-medium">Terr. N.º:</span>{' '}
                      <span className="text-lg font-semibold text-foreground">
                        {territory.number || '—'}
                      </span>
                    </p>
                  </div>
                  {territory.is_daily ? (
                    <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/35 dark:text-emerald-300">
                      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
                      Território do dia
                      {territory.daily_leader_name ? ` · ${territory.daily_leader_name}` : ''}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {can('territory:set_daily') ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void setDaily()}
                      data-tooltip={territory.is_daily ? 'Trocar dirigente do dia' : 'Marcar do dia'}
                      aria-label={territory.is_daily ? 'Trocar dirigente do dia' : 'Marcar do dia'}
                      className="text-amber-600 dark:text-amber-400"
                    >
                      <IconStar />
                    </Button>
                  ) : null}
                  {can('territory:set_daily') && territory.is_daily ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void unlinkDaily()}
                      data-tooltip="Desvincular do dia"
                      aria-label="Desvincular do dia"
                    >
                      <IconUnlink />
                    </Button>
                  ) : null}
                  {can('territory:update') ? (
                    <Button asChild data-tooltip="Editar área" aria-label="Editar área">
                      <Link to={`/territories/${id}/edit`}>
                        <IconPencil />
                      </Link>
                    </Button>
                  ) : null}
                  {can('territory:delete') ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void onDelete()}
                      data-tooltip="Excluir território"
                      aria-label="Excluir território"
                      className="text-destructive hover:text-destructive"
                    >
                      <IconTrash />
                    </Button>
                  ) : null}
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    data-tooltip="Voltar à lista"
                    aria-label="Voltar à lista"
                  >
                    <Link to="/territories">
                      <IconArrowLeft />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    data-tooltip="Início"
                    aria-label="Início"
                  >
                    <Link to="/dashboard">
                      <IconHome />
                    </Link>
                  </Button>
                </div>
              </div>

              <div id="territorio-mapa" className="mb-2 scroll-mt-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">Área no mapa</p>
                </div>

                <div
                  className="mb-3 inline-flex w-full rounded-full bg-muted p-1 sm:w-auto"
                  role="tablist"
                  aria-label="Visualização do mapa"
                >
                  <button
                    type="button"
                    role="tab"
                    id="tab-mapa-interativo"
                    aria-selected={mapViewTab === 'mapa'}
                    onClick={() => selectMapView('mapa')}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
                      mapViewTab === 'mapa'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <IconMap className="size-3.5 shrink-0" />
                    Mapa
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-mapa-imagem"
                    aria-selected={mapViewTab === 'imagem'}
                    onClick={() => selectMapView('imagem')}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
                      mapViewTab === 'imagem'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <IconImage className="size-3.5 shrink-0" />
                    Imagem
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-mapa-imagem-juntas"
                    aria-selected={mapViewTab === 'mapa-imagem'}
                    onClick={() => selectMapView('mapa-imagem')}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition sm:flex-none',
                      mapViewTab === 'mapa-imagem'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className="flex shrink-0 items-center">
                      <IconMap className="size-3.5" />
                      <IconImage className="-ml-1 size-3.5" />
                    </span>
                  </button>
                </div>

                {/* Painéis sempre no DOM após montar — evita reload do Google Maps a cada troca de aba */}
                <div
                  role="tabpanel"
                  aria-labelledby="tab-mapa-interativo"
                  hidden={mapViewTab !== 'mapa'}
                  className={mapViewTab === 'mapa' ? 'mb-4' : 'hidden'}
                >
                  <p className="mb-2 text-[13px] leading-relaxed text-muted-foreground">
                    Clique em uma área do mapa ou em um card de não em casa para destacar a quadra
                    correspondente. A página não rola sozinha — suba ou desça quando quiser. Use o
                    botão ✕ no mapa para limpar o destaque.
                  </p>
                  {linkHint ? (
                    <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                      {linkHint}
                    </p>
                  ) : null}
                  <TerritoryMap
                    value={territory.geojson}
                    centerLat={
                      territory.map_lat != null ? Number(territory.map_lat) : mapConfig?.lat ?? null
                    }
                    centerLng={
                      territory.map_lng != null ? Number(territory.map_lng) : mapConfig?.lng ?? null
                    }
                    cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
                    editable={false}
                    selectedKey={linkedKey}
                    focusToken={mapFocusToken}
                    resizeToken={mapResizeToken}
                    onAreaSelect={onMapAreaSelect}
                    onClearSelection={() => {
                      setLinkedKey(null);
                      setMapFocusToken(0);
                      setLinkHint('');
                    }}
                    finishedKeys={blocksByQuadra
                      .filter(([, streets]) => streets.every((b) => blockProgress(b).finished))
                      .map(([name]) => name)}
                    onPrintViewport={(viewport) => {
                      void downloadMapCard(viewport);
                    }}
                  />
                  {!hasArea && can('territory:update') ? (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                      Ainda não há polígono salvo.{' '}
                      <Link to={`/territories/${id}/edit`} className={LINK_CLASS}>
                        Desenhar área agora
                      </Link>
                    </p>
                  ) : null}
                </div>

                {imagePanelReady || mapViewTab === 'imagem' || mapViewTab === 'mapa-imagem' ? (
                  <div
                    role="tabpanel"
                    aria-labelledby="tab-mapa-imagem"
                    hidden={mapViewTab !== 'imagem'}
                    className={mapViewTab === 'imagem' ? '' : 'hidden'}
                  >
                    {hasTerritoryCardImage(territory) ? (
                      <TerritoryImageLeafletMap
                        territory={territory}
                        resizeToken={imageResizeToken}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
                        Nenhum link de imagem cadastrado.{' '}
                        {can('territory:update') ? (
                          <Link to={`/territories/${id}/edit`} className={LINK_CLASS}>
                            Editar território
                          </Link>
                        ) : (
                          'Peça a um editor para colar o link da foto do cartão.'
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <section id="nao-em-casa-cards" className="scroll-mt-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Checklist</p>
                <h2 className="mt-1 text-[1.375rem] font-semibold tracking-tight">Não em casa</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Toque no card para destacar no mapa · toque no número para marcar · várias ruas por
                  quadra
                </p>
              </div>
              <div className="flex items-center gap-1">
                {can('block:manage') ? (
                  <Button asChild size="icon" variant="ghost" data-tooltip="Gerenciar">
                    <Link to={`/territories/${id}/edit#nao-em-casa`}>
                      <IconPencil />
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={backingUp}
                  onClick={() => setBackupModalOpen(true)}
                  data-tooltip={
                    backingUp ? 'Gerando backup…' : 'Backup dos não em casa (.txt)'
                  }
                  aria-label="Backup dos não em casa"
                >
                  {backingUp ? <Spinner size="sm" /> : <IconDownload className="size-4" />}
                </Button>
              </div>
            </div>

            {blocksByQuadra.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {blocksByQuadra.map(([quadraName, streetBlocks]) => {
                  const doneSum = streetBlocks.reduce((s, b) => s + blockProgress(b).done, 0);
                  const totalSum = streetBlocks.reduce((s, b) => s + blockProgress(b).total, 0);
                  const finished = streetBlocks.every((b) => blockProgress(b).finished);
                  const linked = streetBlocks.some((b) => isBlockLinked(b));
                  const progress = totalSum > 0 ? Math.round((doneSum / totalSum) * 100) : 0;
                  const primary = streetBlocks[0];

                  return (
                    <div
                      key={quadraName}
                      id={`block-card-${primary?.id ?? quadraName}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => primary && onBlockCardSelect(primary)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && primary) {
                          e.preventDefault();
                          onBlockCardSelect(primary);
                        }
                      }}
                      className={cn(
                        'scroll-mt-6 cursor-pointer rounded-[20px] border bg-card p-5 transition duration-200 hover:shadow-lg',
                        finished
                          ? linked
                            ? 'border-transparent bg-emerald-500/10 shadow-[0_0_0_2px_rgb(52,199,89),0_8px_24px_rgba(52,199,89,0.14)] dark:bg-emerald-500/15'
                            : 'border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/12'
                          : linked
                            ? 'border-transparent bg-card shadow-[0_0_0_2px_var(--primary),0_8px_24px_rgba(0,113,227,0.12)]'
                            : 'border-border bg-card',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-[11px] font-medium uppercase tracking-[0.08em]',
                              finished ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
                            )}
                          >
                            Quadra{finished ? ' · concluída' : ''} · {streetBlocks.length}{' '}
                            {streetBlocks.length === 1 ? 'rua' : 'ruas'}
                          </p>
                          <p
                            className={cn(
                              'mt-1 text-[26px] font-semibold leading-none tracking-tight',
                              finished ? 'text-emerald-950 dark:text-emerald-100' : 'text-foreground',
                            )}
                          >
                            {quadraName}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {finished ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                              <IconCheckCircle className="size-3.5" />
                              Finalizado
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                              {doneSum}/{totalSum}
                            </span>
                          )}
                          {linked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                              No mapa
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {!finished && totalSum > 0 ? (
                        <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      ) : null}

                      <div className="mt-4 space-y-4">
                        {streetBlocks.map((block) => {
                          const { finished: streetFinished } = blockProgress(block);
                          return (
                            <div
                              key={block.id}
                              className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                            >
                              <p
                                className={cn(
                                  'mb-1 text-sm font-semibold',
                                  streetFinished
                                    ? 'text-emerald-800 dark:text-emerald-200'
                                    : 'text-foreground',
                                )}
                              >
                                {block.street_name?.trim() || 'Sem rua'}
                              </p>
                              {block.description?.trim() ? (
                                <p className="mb-2 select-text text-[13px] leading-relaxed text-muted-foreground">
                                  {block.description.trim()}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                {block.house_numbers.map((item) => {
                                  const house = String(item);
                                  const doneHouse = isHouseDone(block, house);
                                  const busy = togglingKey === `${block.id}:${house}`;
                                  return (
                                    <button
                                      key={`${block.id}:${house}`}
                                      type="button"
                                      disabled={busy || !can('block:check')}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void toggleHouse(block, house);
                                      }}
                                      data-tooltip={tooltipText(
                                        !can('block:check')
                                          ? 'Sem permissão para alterar'
                                          : doneHouse
                                            ? 'Desmarcar (pede confirmação)'
                                            : 'Marcar como feito',
                                      )}
                                      className={cn(
                                        'inline-flex min-w-[2.5rem] items-center justify-center gap-1 rounded-full px-3 py-1.5',
                                        'text-[13px] font-medium tabular-nums transition active:scale-[0.97] disabled:opacity-50',
                                        doneHouse
                                          ? 'bg-emerald-600 text-white shadow-sm'
                                          : streetFinished
                                            ? 'bg-card/90 text-emerald-900 ring-1 ring-emerald-500/30 dark:text-emerald-100'
                                            : 'bg-muted text-foreground hover:bg-border',
                                      )}
                                    >
                                      {doneHouse ? (
                                        <>
                                          <IconCheck className="size-3.5" />
                                          {house}
                                        </>
                                      ) : (
                                        house
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                <p className="text-[15px] font-medium text-foreground">Nenhum registro ainda</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Adicione quadras e casas na edição do território.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Modal de comparação Mapa & Imagem — tela cheia, dois quadros */}
      {splitOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mapa e Imagem lado a lado"
          className="fixed inset-0 z-[9000] flex flex-col bg-slate-100 dark:bg-black"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 shadow-sm sm:px-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex items-center">
                <IconMap className="size-4" />
                <IconImage className="-ml-1 size-4" />
              </span>
              Mapa &amp; Imagem
            </p>
            <div className="flex items-center gap-2">
              <span className="max-w-[240px] truncate text-xs font-medium text-muted-foreground">
                {splitAreaCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={rotateSplit}
                data-tooltip={
                  splitOrientation === 'horizontal'
                    ? 'Empilhar na vertical'
                    : 'Colocar lado a lado (horizontal)'
                }
                data-tooltip-side="bottom"
                aria-label="Girar orientação"
                aria-pressed={splitOrientation === 'vertical'}
              >
                {splitOrientation === 'horizontal' ? (
                  <IconRows className="size-5" />
                ) : (
                  <IconColumns className="size-5" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={closeSplit}
                data-tooltip="Fechar (Esc)"
                data-tooltip-side="bottom"
                data-tooltip-align="end"
                aria-label="Fechar"
              >
                <IconX className="size-5" />
              </Button>
            </div>
          </div>

          <div
            className={cn(
              'flex min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3',
              splitOrientation === 'horizontal' ? 'flex-col sm:flex-row' : 'flex-col',
            )}
          >
            {/* Quadro: mapa principal */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <TerritoryMap
                value={territory.geojson}
                centerLat={
                  territory.map_lat != null ? Number(territory.map_lat) : mapConfig?.lat ?? null
                }
                centerLng={
                  territory.map_lng != null ? Number(territory.map_lng) : mapConfig?.lng ?? null
                }
                cepLabel={mapConfig ? `${mapConfig.cep} — ${mapConfig.label}` : null}
                editable={false}
                hideSearch
                hideAreaCount
                fillHeight
                resizeToken={splitResizeToken}
                finishedKeys={blocksByQuadra
                  .filter(([, streets]) => streets.every((b) => blockProgress(b).finished))
                  .map(([name]) => name)}
              />
            </div>

            {/* Quadro: imagem do cartão */}
            <div className="min-h-0 flex-1 overflow-hidden">
              {hasTerritoryCardImage(territory) ? (
                <TerritoryImageLeafletMap
                  territory={territory}
                  resizeToken={splitResizeToken}
                  fillHeight
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted px-4 text-center text-sm text-muted-foreground">
                  Nenhum link de imagem cadastrado. Cole o endereço na edição do território.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {dailyModalOpen ? (
        <DailyTerritoryModal
          territoryId={Number(id)}
          onClose={() => setDailyModalOpen(false)}
          onDone={loadTerritory}
        />
      ) : null}

      {backupModalOpen ? (
        <BackupLeadersModal
          onClose={() => setBackupModalOpen(false)}
          onConfirm={(leader) => {
            setBackupModalOpen(false);
            void downloadBackup(leader);
          }}
        />
      ) : null}
    </>
  );
}
