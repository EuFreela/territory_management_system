import type { FormEvent, InvalidEvent } from 'react';

/** Mensagens de validação HTML5 em português (o browser usa o idioma da UI, não o lang da página). */

type ValidityTarget = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidityTarget(el: EventTarget | null): el is ValidityTarget {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

export function ptBrValidityMessage(el: ValidityTarget): string {
  const v = el.validity;
  if (v.valueMissing) {
    if (el instanceof HTMLSelectElement) return 'Selecione uma opção.';
    return 'Preencha este campo.';
  }
  if (v.typeMismatch) {
    if (el instanceof HTMLInputElement && el.type === 'email') {
      return 'Informe um email válido.';
    }
    if (el instanceof HTMLInputElement && el.type === 'url') {
      return 'Informe um URL válido.';
    }
    return 'Valor inválido.';
  }
  if (v.tooShort) {
    return `Use pelo menos ${el.minLength} caracteres.`;
  }
  if (v.tooLong) {
    return `Use no máximo ${el.maxLength} caracteres.`;
  }
  if (v.rangeUnderflow) {
    return `O valor mínimo é ${(el as HTMLInputElement).min}.`;
  }
  if (v.rangeOverflow) {
    return `O valor máximo é ${(el as HTMLInputElement).max}.`;
  }
  if (v.stepMismatch) return 'Valor inválido para este campo.';
  if (v.patternMismatch) return 'Formato inválido.';
  if (v.badInput) return 'Valor inválido.';
  return el.validationMessage || 'Valor inválido.';
}

/** Use em `onInvalidCapture` do form (invalid não borbulha). */
export function onInvalidPtBr(e: FormEvent | InvalidEvent<Element>) {
  const el = e.target;
  if (!isValidityTarget(el)) return;
  el.setCustomValidity('');
  if (!el.validity.valid) {
    el.setCustomValidity(ptBrValidityMessage(el));
  }
}

/** Use em `onInput` / `onChange` do form para liberar o campo após correção. */
export function onInputClearValidity(e: FormEvent) {
  const el = e.target;
  if (!isValidityTarget(el)) return;
  el.setCustomValidity('');
}
