import { toast } from 'sonner';
import { IconInfo, IconWarning } from '@/components/Map/mapIcons';

type ConfirmToastOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ação destrutiva (vermelho) */
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
};

const warningIcon = <IconWarning className="h-5 w-5 text-apple-red" />;

export const infoIcon = <IconInfo className="h-5 w-5 text-apple-blue" />;

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
