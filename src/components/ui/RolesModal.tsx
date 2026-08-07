import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@/components/Map/mapIcons';

export type RolesModalRole = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

/** Modal Apple listando os papéis e suas permissões (RBAC) */
export default function RolesModal({
  roles,
  onClose,
}: {
  roles: RolesModalRole[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="roles-modal-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-apple-xl border border-apple-line bg-apple-surface shadow-float"
      >
        <div className="h-1 w-full bg-apple-blue" />

        <div className="px-6 pb-6 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="roles-modal-title"
                className="text-[17px] font-semibold tracking-tightish text-apple-ink"
              >
                Papéis e permissões
              </h2>
              <p className="mb-4 mt-1 text-[13px] text-apple-secondary">
                Cada papel define o que o usuário pode fazer. O administrador sempre tem todas as
                permissões.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-1.5 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-apple-secondary transition hover:bg-apple-fill hover:text-apple-ink"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {roles.map((r) => (
              <li key={r.id} className="rounded-apple border border-apple-line bg-apple-fill px-3.5 py-3">
                <p className="text-sm font-semibold text-apple-ink">
                  {r.name}{' '}
                  <span className="font-mono text-xs font-normal text-apple-tertiary">{r.slug}</span>
                </p>
                {r.description ? (
                  <p className="mt-0.5 text-xs text-apple-secondary">{r.description}</p>
                ) : null}
                <p className="mt-1.5 font-mono text-xs leading-relaxed text-apple-blue">
                  {r.permissions?.join(' · ') || '—'}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
