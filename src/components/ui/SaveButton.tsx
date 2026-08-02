import { IconSave } from '@/components/Map/mapIcons';

type SaveButtonProps = {
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  loadingLabel?: string;
  type?: 'button' | 'submit';
  /** Associa o botão a um <form id="..."> fora do formulário */
  form?: string;
  className?: string;
  onClick?: () => void;
};

/**
 * CTA principal de salvar — ícone + texto, destaque visual claro.
 */
export default function SaveButton({
  loading = false,
  disabled = false,
  label = 'Salvar',
  loadingLabel = 'Salvando…',
  type = 'submit',
  form,
  className = '',
  onClick,
}: SaveButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      form={form}
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={loading}
      className={`group inline-flex items-center justify-center gap-2.5 rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/25 transition
        hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-600/30
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2
        active:scale-[0.98]
        disabled:cursor-not-allowed disabled:bg-sky-400 disabled:shadow-none disabled:opacity-80
        ${className}`}
    >
      {loading ? (
        <span
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden
        />
      ) : (
        <IconSave className="h-5 w-5 shrink-0 transition group-hover:scale-105" />
      )}
      <span>{loading ? loadingLabel : label}</span>
    </button>
  );
}

/** Barra de ação final — última etapa da página */
export function SaveActionBar({
  children,
  hint = 'Salve para gravar localidade, Terr. N.º e as áreas desenhadas no mapa.',
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Salvar alterações</p>
          <p className="mt-0.5 text-xs text-slate-500 sm:max-w-md">{hint}</p>
        </div>
        <div className="flex shrink-0 justify-end">{children}</div>
      </div>
    </div>
  );
}
