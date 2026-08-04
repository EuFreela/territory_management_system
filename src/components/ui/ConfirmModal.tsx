import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ação destrutiva (vermelho) */
  tone?: 'default' | 'danger' | 'warning';
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type Pending = {
  options: Required<Omit<ConfirmOptions, 'tone'>> & { tone: ConfirmOptions['tone'] };
  resolve: (value: boolean) => void;
};

const defaults = {
  title: 'Confirmar',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  tone: 'default' as const,
};

function normalize(options: ConfirmOptions | string): Pending['options'] {
  if (typeof options === 'string') {
    return { ...defaults, message: options };
  }
  return {
    title: options.title ?? defaults.title,
    message: options.message,
    confirmLabel: options.confirmLabel ?? defaults.confirmLabel,
    cancelLabel: options.cancelLabel ?? defaults.cancelLabel,
    tone: options.tone ?? defaults.tone,
  };
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options: normalize(options), resolve });
    });
  }, []);

  function close(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  useEffect(() => {
    if (!pending) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    // foco no botão principal
    queueMicrotask(() => confirmBtnRef.current?.focus());

    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const tone = pending?.options.tone ?? 'default';
  const confirmBtnClass =
    tone === 'danger'
      ? 'bg-apple-red hover:bg-red-600 focus-visible:ring-red-400'
      : tone === 'warning'
        ? 'bg-apple-orange hover:bg-amber-600 focus-visible:ring-amber-400'
        : 'bg-apple-blue hover:bg-apple-blue-hover focus-visible:ring-apple-blue/40';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {pending ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center p-4"
          role="presentation"
        >
          {/* backdrop */}
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition"
            onClick={() => close(false)}
          />

          {/* dialog */}
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-apple-xl border border-apple-line bg-apple-surface shadow-float"
          >
            <div
              className={`h-1 w-full ${
                tone === 'danger'
                  ? 'bg-apple-red'
                  : tone === 'warning'
                    ? 'bg-apple-orange'
                    : 'bg-apple-blue'
              }`}
            />

            <div className="px-6 pb-6 pt-5">
              <div className="mb-4 flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    tone === 'danger'
                      ? 'bg-red-50 text-apple-red'
                      : tone === 'warning'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-apple-blue/10 text-apple-blue'
                  }`}
                >
                  {tone === 'danger' ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4" />
                      <path d="M12 16h.01" />
                    </svg>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2
                    id="confirm-modal-title"
                    className="text-[17px] font-semibold tracking-tightish text-apple-ink"
                  >
                    {pending.options.title}
                  </h2>
                  <p
                    id="confirm-modal-desc"
                    className="mt-1.5 text-[14px] leading-relaxed text-apple-secondary"
                  >
                    {pending.options.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => close(false)} className="app-btn-secondary">
                  {pending.options.cancelLabel}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={() => close(true)}
                  className={`app-btn text-white ${confirmBtnClass}`}
                >
                  {pending.options.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  }
  return ctx.confirm;
}
