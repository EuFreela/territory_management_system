import type { ReactNode } from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

const SPINNER_SIZE: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
};

/** Anel giratório de carregamento — padrão do app. */
export function Spinner({
  size = 'md',
  label,
  className = '',
}: {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-block animate-spin rounded-full border-current border-t-transparent ${SPINNER_SIZE[size]} ${className}`}
      />
      {label ? <span className="text-[13px] font-medium text-apple-secondary">{label}</span> : null}
    </span>
  );
}

/** Tela cheia de carregamento (auth, proteção de rota) */
export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-apple-bg">
      <Spinner size="lg" className="text-apple-secondary" />
      {label ? <p className="text-[14px] font-medium text-apple-secondary">{label}</p> : null}
    </div>
  );
}

/** Caixa centralizada com spinner — mapas, imagens e áreas que carregam */
export function LoadingBox({
  label = 'Carregando…',
  className = 'min-h-[20rem]',
  children,
}: {
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-apple-line bg-apple-fill ${className}`}
    >
      <Spinner size="lg" className="text-apple-secondary" />
      {label ? <p className="text-[14px] font-medium text-apple-secondary">{label}</p> : null}
      {children}
    </div>
  );
}
