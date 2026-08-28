import { useMemo, useRef, useState } from 'react';
import { IconDownload, IconFileText, IconX } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FieldError from '@/components/ui/FieldError';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  isAllowedScheduleTxtFile,
  parseScheduleProgram,
  sanitizeScheduleText,
  SCHEDULE_FORMAT_HINT,
  SCHEDULE_TEMPLATE_URL,
  SCHEDULE_TEXT_MAX,
} from '@/lib/schedule-import';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

function formatDateBr(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function previewLabel(item: {
  is_fixed: boolean;
  service_date: string | null;
  weekday_label: string;
  fixed_time: string;
  assignee_name: string;
}) {
  if (item.is_fixed) {
    return `Fixo · ${item.weekday_label} ${item.fixed_time} · ${item.assignee_name}`;
  }
  return `${formatDateBr(item.service_date)} · ${item.fixed_time} · ${item.assignee_name}`;
}

export default function ImportScheduleModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileLabel, setFileLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const sanitized = sanitizeScheduleText(text);
    if (!sanitized.ok) return { items: [], skipped: 0, sanitizeError: sanitized.error };
    return { ...parseScheduleProgram(sanitized.text), sanitizeError: '' };
  }, [text]);

  function reset() {
    setText('');
    setFileLabel('');
    setError('');
    setSaving(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  function onTextChange(value: string) {
    setError('');
    if (value.length > SCHEDULE_TEXT_MAX) {
      setError(`Texto grande demais (máx. ${SCHEDULE_TEXT_MAX} caracteres).`);
      setText(value.slice(0, SCHEDULE_TEXT_MAX));
      return;
    }
    setText(value);
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const fileError = isAllowedScheduleTxtFile(file);
    if (fileError) {
      setError(fileError);
      setFileLabel('');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    try {
      const raw = await file.text();
      const sanitized = sanitizeScheduleText(raw);
      if (!sanitized.ok) {
        setError(sanitized.error);
        setFileLabel('');
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setFileLabel(file.name.slice(0, 80));
      setError('');
      setText(sanitized.text);
    } catch {
      setError('Não foi possível ler o arquivo .txt.');
    }
  }

  async function onImport() {
    const sanitized = sanitizeScheduleText(text);
    if (!sanitized.ok) {
      setError(sanitized.error);
      return;
    }
    const parsed = parseScheduleProgram(sanitized.text);
    if (parsed.items.length === 0) {
      setError(
        `Nenhuma linha no formato. ${SCHEDULE_FORMAT_HINT}`,
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await api<{ created: number; skipped: number; duplicates: number }>(
        '/api/field-assignments/import',
        {
          method: 'POST',
          body: JSON.stringify({ text: sanitized.text }),
        },
      );
      const parts = [`${result.created} designação(ões) inserida(s)`];
      if (result.duplicates) parts.push(`${result.duplicates} já existiam`);
      if (result.skipped) parts.push(`${result.skipped} linha(s) ignorada(s)`);
      toast.success(parts.join(' · '));
      onImported();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar a programação.');
    } finally {
      setSaving(false);
    }
  }

  const shown = preview.items.slice(0, 12);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : handleClose())}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Inserir programação</DialogTitle>
          <DialogDescription>
            Use só o formato do modelo. Baixe o .txt, preencha e envie — ou cole no campo abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Formato</p>
            <p className="mt-1 font-mono text-[12px] text-foreground">25/08/2026 18:00 Nome</p>
            <p className="font-mono text-[12px] text-foreground">FIXO Terça-feira 08:00 Nome</p>
            <p className="mt-1.5">Horário em 24 horas (00:00–23:59). Data sempre dia/mês/ano.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <a href={SCHEDULE_TEMPLATE_URL} download="modelo-programacao-dirigentes.txt">
                <IconDownload />
                Baixar modelo .txt
              </a>
            </Button>
            <input
              ref={fileRef}
              id="schedule-file"
              type="file"
              accept=".txt,text/plain"
              disabled={saving}
              className="sr-only"
              onChange={(event) => void onPickFile(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
            >
              <IconFileText />
              Enviar arquivo .txt
            </Button>
            {fileLabel ? <span className="text-xs text-muted-foreground">{fileLabel}</span> : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="schedule-text">Ou cole o texto</Label>
            <textarea
              id="schedule-text"
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder={'25/08/2026 18:00 Nome do dirigente\nFIXO Terça-feira 08:00 Nome do dirigente'}
              rows={8}
              maxLength={SCHEDULE_TEXT_MAX}
              spellCheck={false}
              autoComplete="off"
              disabled={saving}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'schedule-text-error' : 'schedule-text-hint'}
              className="min-h-[10rem] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
            <p id="schedule-text-hint" className="text-xs text-muted-foreground">
              {SCHEDULE_FORMAT_HINT}
            </p>
          </div>

          {preview.sanitizeError ? (
            <FieldError id="schedule-text-error">{preview.sanitizeError}</FieldError>
          ) : error ? (
            <FieldError id="schedule-text-error">{error}</FieldError>
          ) : null}

          {preview.items.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-xs font-medium text-foreground">
                {preview.items.length} linha(s) pronta(s)
                {preview.skipped ? ` · ${preview.skipped} ignorada(s)` : ''}
              </p>
              <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                {shown.map((item) => (
                  <li
                    key={`${item.is_fixed ? 'f' : 'd'}-${item.service_date}-${item.fixed_weekday}-${item.fixed_time}-${item.assignee_name}`}
                  >
                    {previewLabel(item)}
                  </li>
                ))}
              </ul>
              {preview.items.length > shown.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  +{preview.items.length - shown.length} outra(s)
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="icon" disabled={saving} onClick={handleClose} aria-label="Cancelar">
            <IconX />
          </Button>
          <Button
            type="button"
            disabled={saving || preview.items.length === 0 || Boolean(preview.sanitizeError)}
            onClick={() => void onImport()}
          >
            {saving ? 'Inserindo…' : 'Inserir na escala'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
