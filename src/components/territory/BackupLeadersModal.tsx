import { useEffect, useMemo, useState } from 'react';
import { IconCheck, IconDownload } from '@/components/Map/mapIcons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import type { FieldAssignment } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  onClose: () => void;
  /** Dirigente escolhido (null quando o backup sai sem dirigente) */
  onConfirm: (leader: FieldAssignment | null) => void;
};

/**
 * Escolhe o dirigente responsável pelo campo no dia em que os não em casa
 * foram registrados. O nome e o horário dele entram no arquivo do backup.
 */
export default function BackupLeadersModal({ onClose, onConfirm }: Props) {
  const [leaders, setLeaders] = useState<FieldAssignment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<{ dated: FieldAssignment[]; fixed: FieldAssignment[] }>('/api/field-assignments/today')
      .then((data) => {
        if (cancelled) return;
        setLeaders([...(data.dated ?? []), ...(data.fixed ?? [])]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedLeaders = useMemo(() => {
    return [...leaders].sort((a, b) => {
      const delta = Number(b.is_fixed) - Number(a.is_fixed);
      if (delta !== 0) return delta;
      return String(a.fixed_time ?? '').localeCompare(String(b.fixed_time ?? ''));
    });
  }, [leaders]);

  const selected = sortedLeaders.find((l) => String(l.id) === selectedId) ?? null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dirigente do dia do backup</DialogTitle>
          <DialogDescription>
            Escolha quem foi o dirigente responsável pelo campo no dia em que estes não em casa
            foram registrados. O nome e o horário dele entram no arquivo.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner label="Carregando dirigentes…" />
            </div>
          ) : error ? (
            <p className="text-[13px] text-destructive">{error}</p>
          ) : sortedLeaders.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-muted-foreground">
              Nenhum dirigente na escala de hoje. O backup sairá sem dirigente.
            </p>
          ) : (
            sortedLeaders.map((leader) => {
              const isSelected = String(leader.id) === selectedId;
              const time = leader.fixed_time?.trim();
              return (
                <button
                  key={leader.id}
                  type="button"
                  onClick={() => setSelectedId(String(leader.id))}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition',
                    isSelected
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:bg-muted/60',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-foreground">
                      {leader.assignee_name}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {leader.is_fixed ? 'Fixo' : 'Designado'}
                      {time ? ` · ${time}` : ''}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border transition',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40',
                    )}
                  >
                    {isSelected ? <IconCheck className="size-3" /> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {!loading && !error && sortedLeaders.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setSelectedId('');
              setError('');
            }}
            className="w-fit text-[12px] font-medium text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
          >
            Backup sem dirigente
          </button>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!loading) onConfirm(selected);
            }}
            disabled={loading}
          >
            <IconDownload className="size-4" />
            Baixar backup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}