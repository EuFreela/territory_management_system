import { useId, useState } from 'react';
import { IconCheck, IconCheckCircle, IconEye, IconEyeOff, IconKey, IconRefresh } from '@/components/Map/mapIcons';
import { PASSWORD_REQUIREMENTS, generateStrongPassword, isStrongPassword } from '@/lib/password';

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  /** Marca o campo como opcional (ex.: troca de senha no editar) */
  optional?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
};

type StrengthTier = {
  label: string;
  bar: string;
  dot: string;
};

function strengthTier(score: number): StrengthTier {
  if (score >= PASSWORD_REQUIREMENTS.length) {
    return { label: 'Forte', bar: 'bg-apple-green', dot: 'bg-apple-green' };
  }
  if (score >= 4) {
    return { label: 'Média', bar: 'bg-apple-orange', dot: 'bg-apple-orange' };
  }
  return { label: 'Fraca', bar: 'bg-apple-red', dot: 'bg-apple-red' };
}

/**
 * Campo de senha (estilo Apple) com:
 * - ícone de chave (SF Symbols) + botão de mostrar/ocultar
 * - medidor de força segmentado, como o de Ajustes do iOS
 * - checklist de requisitos em tempo real
 * - sugestão de senha forte aleatória quando a digitada é fraca
 */
export default function PasswordField({
  label,
  value,
  onChange,
  id,
  required = false,
  optional = false,
  disabled = false,
  autoComplete = 'new-password',
  placeholder,
  maxLength = 128,
}: PasswordFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [show, setShow] = useState(false);

  const touched = value !== '';
  const score = touched
    ? PASSWORD_REQUIREMENTS.filter((req) => req.test(value)).length
    : 0;
  const strong = touched && isStrongPassword(value);
  const tier = strengthTier(score);

  return (
    <div>
      <label htmlFor={inputId} className="app-label">
        {label}
        {optional ? <span className="font-normal text-apple-tertiary"> (opcional)</span> : null}
      </label>

      <div className="relative">
        <IconKey className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-apple-tertiary" />
        <input
          id={inputId}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="app-input pl-10 pr-11"
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          data-tooltip={show ? 'Ocultar senha' : 'Mostrar senha'}
          data-tooltip-side="left"
          disabled={disabled}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-apple-tertiary transition hover:bg-apple-fill hover:text-apple-ink active:scale-95 disabled:opacity-40"
        >
          {show ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {touched ? (
        <div className="mt-2.5">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1" role="meter" aria-label="Força da senha" aria-valuemin={0} aria-valuemax={PASSWORD_REQUIREMENTS.length} aria-valuenow={score}>
              {PASSWORD_REQUIREMENTS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    i < score ? tier.bar : 'bg-apple-line'
                  }`}
                />
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-apple-ink">
              <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
              Força: {tier.label}
            </span>
          </div>

          <div className="mt-2.5 rounded-apple border border-apple-line bg-apple-fill p-3">
            <ul className="space-y-1.5">
              {PASSWORD_REQUIREMENTS.map((req) => {
                const ok = req.test(value);
                return (
                  <li
                    key={req.label}
                    className={`flex items-center gap-2 text-[12px] transition ${
                      ok ? 'font-medium text-apple-green' : 'text-apple-tertiary'
                    }`}
                  >
                    <span
                      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition ${
                        ok ? 'bg-apple-green/15 text-apple-green' : 'bg-apple-surface text-apple-tertiary'
                      }`}
                    >
                      {ok ? (
                        <IconCheck className="h-3 w-3" />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                      )}
                    </span>
                    {req.label}
                  </li>
                );
              })}
            </ul>
          </div>

          {strong ? (
            <p className="mt-2.5 flex items-center gap-2 text-[12px] font-semibold text-apple-green">
              <IconCheckCircle className="h-[15px] w-[15px]" />
              Senha forte. Tudo certo.
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-apple border border-apple-red/20 bg-apple-red/[0.07] px-3 py-2">
              <span className="text-[12px] font-medium text-apple-red">Senha fraca — use a sugestão:</span>
              <button
                type="button"
                onClick={() => onChange(generateStrongPassword())}
                className="inline-flex items-center gap-1.5 rounded-full border border-apple-line bg-apple-surface px-3 py-1.5 text-[12px] font-semibold text-apple-ink shadow-soft transition hover:bg-apple-fill active:scale-[0.98]"
              >
                <IconRefresh className="h-3.5 w-3.5 text-apple-blue" />
                Gerar senha forte
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
