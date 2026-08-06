/**
 * Tooltips curtos e legíveis (evita caixa alta demais).
 * Limite fixo de caracteres para todas as dicas da UI.
 */
export const TOOLTIP_MAX_CHARS = 40;

/** Normaliza espaços e corta em TOOLTIP_MAX_CHARS com reticências. */
export function tooltipText(text: string, maxChars = TOOLTIP_MAX_CHARS): string {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}
