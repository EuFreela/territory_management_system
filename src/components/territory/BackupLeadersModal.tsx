import { useEffect, useState } from 'react';
import { IconDownload } from '@/components/Map/mapIcons';
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
import { formatDateBr } from '@/lib/date';
import type { FieldAssignment } from '@/lib/types';

/** Mesmo estilo dos demais selects do sistema (ver FieldLeadersPage) */
const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted';

function leaderOptionLabel(leader: FieldAssignment) {
  const day = leader.service_date
    ? formatDateBr(leader.service_date)
    : leader.weekday_label?.trim() || '';
  const time = leader.fixed_time?.trim();
  const kind = leader.is_fixed ? 'Fixo' : 'Designado';
  return `${leader.assignee_name}${day ? ` · ${day}` : ''}${time ? ` · ${time}` : ''} (${kind})`;
}

type Props = {
  onClose: () => void;
  /** Dirigente escolhido (null quando o backup sai sem dirigente) */
  onConfirm: (leader: FieldAssignment | null) => void;
};

/**
 * Escolhe o dirigente responsável pelo campo no dia em que os não em casa
 * foram registrados. Lista completa (a mesma da página Dirigentes); o nome
 * e o horário do escolhido entram no arquivo do backup.
 */
export default function BackupLeadersModal({ onClose, onConfirm }: Props) {
  const [leaders, setLeaders] = useState<FieldAssignment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<FieldAssignment[]>('/api/field-assignments/leaders')
      .then((rows) => {
        if (cancelled) return;
        setLeaders(rows ?? []);
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

  const selected = leaders.find((l) => String(l.id) === selectedId) ?? null;

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

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Carregando dirigentes…" />
          </div>
        ) : error ? (
          <p className="text-[13px] text-destructive">{error}</p>
        ) : leaders.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Nenhum dirigente cadastrado. O backup sairá sem dirigente.
          </p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={SELECT_CLASS}
            autoFocus
          >
            <option value="">— Sem dirigente —</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={String(leader.id)}>
                {leaderOptionLabel(leader)}
              </option>
            ))}
          </select>
        )}

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