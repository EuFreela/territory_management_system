import { useId, useState } from 'react';
import {
  IconCheck,
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconKey,
  IconRefresh,
} from '@/components/Map/mapIcons';
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
  /** Mensagem de erro do campo (borda vermelha + texto abaixo do input) */
  error?: string;
  /** Estado controlado de visibilidade (quando showToggle=false, o olho interno some) */
  show?: boolean;
  /** Mostrar o olho individual do campo (padrão true). Use false para um olho único externo. */
  showToggle?: boolean;
};

/** Segmentos do medidor (visual compacto do app, não 1 barra fina “progress”) */
const METER_SEGMENTS = 4;

function tierFromScore(score: number, total: number) {
  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 1) {
    return {
      label: 'Forte',
      segments: METER_SEGMENTS,
      // Light: cores mais saturadas para leitura; dark: tokens do tema (já bons)
      bar: 'bg-[rgb(36,160,70)] dark:bg-apple-green',
      chip: 'bg-apple-green/25 text-[rgb(22,128,52)] dark:bg-apple-green/15 dark:text-apple-green',
      status: 'text-[rgb(22,128,52)] dark:text-apple-green',
    } as const;
  }
  if (score >= 4) {
    return {
      label: 'Média',
      segments: 3,
      bar: 'bg-[rgb(217,130,0)] dark:bg-apple-orange',
      chip: 'bg-apple-orange/25 text-[rgb(176,96,0)] dark:bg-apple-orange/15 dark:text-apple-orange',
      status: 'text-[rgb(176,96,0)] dark:text-apple-orange',
    } as const;
  }
  if (score >= 2) {
    return {
      label: 'Fraca',
      segments: 2,
      bar: 'bg-[rgb(215,48,40)] dark:bg-apple-red',
      chip: 'bg-apple-red/15 text-[rgb(196,40,32)] dark:bg-apple-red/10 dark:text-apple-red',
      status: 'text-[rgb(196,40,32)] dark:text-apple-red',
    } as const;
  }
  return {
    label: 'Fraca',
    segments: Math.max(score, 1),
    bar: 'bg-[rgb(215,48,40)] dark:bg-apple-red',
    chip: 'bg-apple-red/15 text-[rgb(196,40,32)] dark:bg-apple-red/10 dark:text-apple-red',
    status: 'text-[rgb(196,40,32)] dark:text-apple-red',
  } as const;
}

/**
 * Campo de senha alinhado ao layout do app (cards, fills, azul/verde suaves).
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
  error,
  show,
  showToggle = true,
}: PasswordFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  const [internalShow, setInternalShow] = useState(false);
  const visible = showToggle ? internalShow : Boolean(show);
  const toggleVisible = () => setInternalShow((s) => !s);

  const touched = value !== '';
  const total = PASSWORD_REQUIREMENTS.length;
  const score = touched ? PASSWORD_REQUIREMENTS.filter((req) => req.test(value)).length : 0;
  const strong = touched && isStrongPassword(value);
  const tier = tierFromScore(score, total);

  return (
    <div>
      {/* min-h-6 alinha com labels que têm botão de ajuda (ex.: Papel na UsersPage) */}
      <label htmlFor={inputId} className="app-label mb-1.5 flex min-h-6 items-center">
        {label}
        {optional ? <span className="font-normal text-apple-tertiary"> (opcional)</span> : null}
      </label>

      <div className="relative">
        <IconKey className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-apple-tertiary" />
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`app-input pl-10 pr-11 ${
            error ? 'border-apple-red/60 inset-ring-2 inset-ring-apple-red/25' : ''
          }`}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-describedby={touched ? helpId : undefined}
        />
        {showToggle ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={toggleVisible}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            data-tooltip={visible ? 'Ocultar senha' : 'Mostrar senha'}
            data-tooltip-side="left"
            disabled={disabled}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-apple-tertiary transition hover:bg-apple-fill hover:text-apple-ink active:scale-95 disabled:opacity-40"
          >
            {visible ? (
              <IconEyeOff className="h-[18px] w-[18px]" />
            ) : (
              <IconEye className="h-[18px] w-[18px]" />
            )}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-apple-red">
          {error}
        </p>
      ) : null}

      {touched ? (
        <div id={helpId} className="mt-2.5 space-y-2.5">
          {/* Medidor + chip de força — padrão visual do app */}
          <div className="flex items-center gap-3">
            <div
              role="meter"
              aria-label="Força da senha"
              aria-valuemin={0}
              aria-valuemax={METER_SEGMENTS}
              aria-valuenow={tier.segments}
              aria-valuetext={tier.label}
              className="flex min-w-0 flex-1 gap-1"
            >
              {Array.from({ length: METER_SEGMENTS }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    i < tier.segments ? tier.bar : 'bg-apple-line'
                  }`}
                />
              ))}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${tier.chip}`}
            >
              {tier.label}
            </span>
          </div>

          {/* Card de requisitos — mesmo idioma de RolesModal / app-fill */}
          <div className="rounded-apple border border-apple-line bg-apple-fill px-3.5 py-3 shadow-soft">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold tracking-tightish text-apple-secondary">
                Requisitos
              </p>
              <p className="text-[11px] tabular-nums text-apple-tertiary">
                {score}/{total}
              </p>
            </div>

            <ul className="grid gap-1.5 sm:grid-cols-2">
              {PASSWORD_REQUIREMENTS.map((req) => {
                const ok = req.test(value);
                return (
                  <li key={req.label} className="flex min-w-0 items-start gap-2">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                        ok
                          ? 'bg-apple-green/25 text-[rgb(22,128,52)] dark:bg-apple-green/15 dark:text-apple-green'
                          : 'bg-apple-surface text-apple-tertiary inset-ring-1 inset-ring-apple-line'
                      }`}
                      aria-hidden
                    >
                      {ok ? (
                        <IconCheck className="h-2.5 w-2.5" />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                      )}
                    </span>
                    <span
                      className={`min-w-0 text-[12px] leading-snug transition-colors duration-200 ${
                        ok ? 'font-medium text-apple-ink' : 'text-apple-secondary'
                      }`}
                    >
                      {req.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex flex-col gap-2.5 border-t border-apple-line pt-3 sm:flex-row sm:items-center sm:justify-between">
              {strong ? (
                <p className={`flex items-center gap-2 text-[12px] font-semibold ${tier.status}`}>
                  <IconCheckCircle className="h-4 w-4 shrink-0" />
                  Senha forte — tudo certo.
                </p>
              ) : score >= 4 ? (
                <p className={`text-[12px] font-semibold ${tier.status}`}>Senha média — quase lá.</p>
              ) : (
                <p className={`text-[12px] font-semibold ${tier.status}`}>Senha fraca — complete os requisitos.</p>
              )}

              {!strong ? (
                <button
                  type="button"
                  onClick={() => onChange(generateStrongPassword())}
                  disabled={disabled}
                  className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-apple-line bg-apple-surface px-3 text-[13px] font-semibold text-apple-ink shadow-soft transition hover:bg-apple-bg active:scale-[0.99] disabled:opacity-40 sm:w-auto"
                >
                  <IconRefresh className="h-3.5 w-3.5 text-apple-blue" />
                  Gerar senha forte
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
