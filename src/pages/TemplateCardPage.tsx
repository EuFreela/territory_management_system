import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { IconImage, IconPrinter, IconUndo } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MAP_MIN_CQW = 8;
const MAP_MAX_CQW = 80;
const SIZE_STEP_CQW = 2;
const DEFAULT_SIZE_CQW = 36;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Cartão S-12 reconstruído em HTML/CSS com as proporções EXATAS do template
 * (1161×748). Posições medidasno original: tudo em cqw (1cqw = 11.61px do
 * original), o que mantém a fidelidade tanto na tela quanto na impressão A4.
 */
const CARD_CSS = `
.s12-sheet { width: min(860px, 100%); margin-top: 2rem; }
.s12-card {
  container-type: inline-size;
  aspect-ratio: 1161 / 748;
  display: flex; flex-direction: column;
  box-sizing: border-box;
  background: #fff; color: #111;
  padding: 3.44cqw 6.1cqw 3cqw 6.2cqw;
  border: 1px solid rgb(0 0 0 / 0.12);
  font-family: 'Times New Roman', Times, Georgia, serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* Título centralizado (x282..882, y40..75 no original). */
.s12-title { margin: 0; padding: 0; text-align: center;
  font-size: 3cqw; font-weight: 700; letter-spacing: 0; line-height: 1.1; }

/* Linha de campos: rótulo à esquerda e campo à frente, tudo na mesma linha. */
.s12-fields { display: flex; align-items: baseline; margin-top: 2.24cqw; }
.s12-label { font-size: 1.6cqw; font-weight: 400; }
.s12-input {
  flex: 0 0 auto;
  background: transparent; color: #111; border: none;
  border-bottom: 0.17cqw solid #111;
  font-family: inherit; font-size: 1.7cqw; line-height: 1.35;
  margin: 0; padding: 0 0.4cqw 0 0;
  min-width: 0;
}
.s12-input:focus { outline: none; border-bottom-color: #2563eb; }

/* Área do mapa (espaço livre y~130..578, sem moldura). */
.s12-map { position: relative; flex: 1 1 auto; margin-top: 2.24cqw;
  overflow: hidden; touch-action: none; }
.s12-hint { position: absolute; left: 0; right: 0; bottom: 1.1cqw;
  margin: 0; text-align: center;
  font-size: 1.4cqw; color: #555; pointer-events: none; }
.s12-map-img { position: absolute; transform: translate(-50%, -50%);
  cursor: move; user-select: none; }

/* Notas em negrito, ocupando a largura do cartão (y606..684). */
.s12-notes { margin-top: 1.1cqw; font-size: 1.64cqw; font-weight: 700;
  line-height: 2.24cqw; text-align: justify; }
.s12-notes p { margin: 0 0 0.0cqw; }

/* Rodapé: Ss-12-T à esquerda, Impresso no Brasil à direita (y688..705). */
.s12-foot { display: flex; justify-content: space-between; align-items: baseline;
  margin-top: 1.4cqw; font-size: 1.3cqw; }
.s12-foot span { white-space: nowrap; }

@media print {
  @page { size: A4 landscape; margin: 0; }
  body * { visibility: hidden; }
  .s12-sheet, .s12-sheet * { visibility: visible; }
  .s12-sheet { position: fixed; left: 0; top: 0; width: 277mm; margin: 0; }
  .s12-card { border: none; }
  .s12-input { border-bottom: 0.17cqw solid #111; }
  .s12-input:focus { border-bottom-color: #111; }
}
`;

export default function TemplateCardPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; px: number; py: number } | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [localidade, setLocalidade] = useState('');
  const [numero, setNumero] = useState('');
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState(DEFAULT_SIZE_CQW);

  function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem.');
      return;
    }
    const url = URL.createObjectURL(file);
    setUploaded((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  function reset() {
    setPos({ x: 50, y: 50 });
    setSize(DEFAULT_SIZE_CQW);
  }

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, px: pos.x, py: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const drag = dragRef.current;
    const frame = mapRef.current;
    if (!drag || !frame) return;
    const dx = ((e.clientX - drag.startX) / frame.clientWidth) * 100;
    const dy = ((e.clientY - drag.startY) / frame.clientHeight) * 100;
    setPos({
      x: clamp(drag.px + dx, 5, 95),
      y: clamp(drag.py + dy, 5, 95),
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <style>{CARD_CSS}</style>

      <p className="text-sm font-medium text-muted-foreground">Cartão de território</p>
      <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">
        Template S-12
      </h1>
      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
        Preencha os dados, suba a imagem do mapa e arraste para encaixar no cartão. Depois
        imprima ou salve como PDF.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="s12-localidade">Localidade</Label>
          <Input
            id="s12-localidade"
            className="w-56"
            placeholder="Ex.: Centro"
            value={localidade}
            onChange={(e) => setLocalidade(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s12-num">Terr. N.º</Label>
          <Input
            id="s12-num"
            className="w-24"
            placeholder="3"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <IconImage className="size-4" />
          {uploaded ? 'Trocar imagem' : 'Selecionar imagem'}
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!uploaded || size <= MAP_MIN_CQW}
            onClick={() => setSize((s) => Math.max(MAP_MIN_CQW, s - SIZE_STEP_CQW))}
            aria-label="Diminuir mapa"
          >
            −
          </Button>
          <span className="w-14 text-center text-sm tabular-nums text-muted-foreground">
            {size}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!uploaded || size >= MAP_MAX_CQW}
            onClick={() => setSize((s) => Math.min(MAP_MAX_CQW, s + SIZE_STEP_CQW))}
            aria-label="Aumentar mapa"
          >
            +
          </Button>
        </div>
        <Button type="button" variant="outline" disabled={!uploaded} onClick={reset}>
          <IconUndo className="size-4" />
          Centralizar
        </Button>
        <Button type="button" onClick={() => window.print()}>
          <IconPrinter className="size-4" />
          Imprimir
        </Button>
      </div>

      <div
        className="s12-sheet"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          loadFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="s12-card">
          <p className="s12-title">Cartão de Mapa de Território</p>

          {/* Localidade ______   Terr. N.º ____  (mesma linha, na frente do rótulo) */}
          <div className="s12-fields">
            <span className="s12-label" style={{ flex: '0 0 12cqw' }}>
              Localidade
            </span>
            <input
              className="s12-input"
              style={{ width: '50.7cqw' }}
              value={localidade}
              onChange={(e) => setLocalidade(e.target.value)}
            />
            <span style={{ flex: '1 1 auto' }} />
            <span className="s12-label" style={{ flex: '0 0 9.3cqw', whiteSpace: 'nowrap' }}>
              Terr. N.º
            </span>
            <input
              className="s12-input"
              style={{ width: '12.6cqw' }}
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>

          <div ref={mapRef} className="s12-map">
            <p className="s12-hint">Cole o mapa acima ou desenhe o território</p>
            {uploaded ? (
              <img
                src={uploaded}
                alt="Mapa do território"
                draggable={false}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
                onPointerCancel={() => {
                  dragRef.current = null;
                }}
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${size}cqw` }}
                className="s12-map-img"
              />
            ) : null}
          </div>

          <div className="s12-notes">
            <p>
              Guarde este cartão no envelope. Tome cuidado para não o manchar, marcar ou dobrar.
              Cada vez que o território for coberto, queira informar disso o irmão que cuida do
              arquivo de territórios.
            </p>
          </div>

          <div className="s12-foot">
            <span>Ss-12-T 6/72</span>
            <span>Impresso no Brasil</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        O mapa é solto dentro da área central: arraste para posicionar e use os botões +/− para
        ajustar o tamanho.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          loadFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}