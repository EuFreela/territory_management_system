import { toast } from 'sonner';

type ConfirmToastOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ação destrutiva (vermelho) */
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
};

const warningIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-apple-red">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
);

export const infoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-apple-blue">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const accentVars = {
  default: {
    '--confirm-accent': 'rgb(var(--apple-blue))',
    '--confirm-accent-soft': 'rgb(var(--apple-blue) / 0.12)',
  },
  danger: {
    '--confirm-accent': 'rgb(var(--apple-red))',
    '--confirm-accent-soft': 'rgb(var(--apple-red) / 0.12)',
  },
} as const;

/** Confirmação padrão do app: alerta estilo iOS via toast do Sonner, centralizado
 *  na tela com fundo escurecido e desfocado (toaster 'confirm'). */
export function confirmToast({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
}: ConfirmToastOptions) {
  toast(title, {
    description,
    duration: Infinity,
    toasterId: 'confirm',
    icon: tone === 'danger' ? warningIcon : infoIcon,
    style: accentVars[tone] as React.CSSProperties,
    action: {
      label: confirmLabel,
      onClick: () => void onConfirm(),
    },
    cancel: {
      label: cancelLabel,
      onClick: () => {},
    },
  });
}
