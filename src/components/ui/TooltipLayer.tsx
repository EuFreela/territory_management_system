import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
type TooltipAlign = 'start' | 'center' | 'end';

type TooltipState = {
  text: string;
  side: TooltipSide;
  align: TooltipAlign;
  multiline: boolean;
};

/**
 * Tooltip global em portal (body). Resolve o problema do ::after preso em
 * stacking contexts (cards overflow-hidden, mapa isolate, tabelas z-*), que
 * fazia dicas aparecerem atrás dos elementos. Fica sempre acima de tudo.
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const targetRef = useRef<HTMLElement | null>(null);
  const showTimer = useRef<number | null>(null);

  function updatePosition(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const side = (el.getAttribute('data-tooltip-side') ?? 'top') as TooltipSide;
    const align = (el.getAttribute('data-tooltip-align') ?? 'center') as TooltipAlign;

    let top = 0;
    let left = 0;
    if (side === 'top') {
      left = rect.left + rect.width / 2;
      top = rect.top - 8;
    } else if (side === 'bottom') {
      top = rect.bottom + 8;
      left = align === 'end' ? rect.right : rect.left + rect.width / 2;
    } else if (side === 'left') {
      left = rect.left - 8;
      top = rect.top + rect.height / 2;
    } else {
      left = rect.right + 8;
      top = rect.top + rect.height / 2;
    }
    setPos({ top, left });
  }

  function show(el: HTMLElement) {
    const text = el.getAttribute('data-tooltip');
    if (!text) return;
    targetRef.current = el;
    updatePosition(el);
    setTip({
      text,
      side: (el.getAttribute('data-tooltip-side') ?? 'top') as TooltipSide,
      align: (el.getAttribute('data-tooltip-align') ?? 'center') as TooltipAlign,
      multiline: el.hasAttribute('data-tooltip-multiline'),
    });
  }

  function hide() {
    targetRef.current = null;
    setTip(null);
    if (showTimer.current != null) window.clearTimeout(showTimer.current);
  }

  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');
      if (el) {
        if (showTimer.current != null) window.clearTimeout(showTimer.current);
        showTimer.current = window.setTimeout(() => show(el), 120);
      } else if (!(e.target as HTMLElement).closest('[data-tooltip-layer]')) {
        hide();
      }
    };
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');
      if (el) show(el);
    };
    const onBlur = (e: FocusEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tooltip]');
      if (el) hide();
    };
    const onScrollOrResize = () => {
      if (targetRef.current) updatePosition(targetRef.current);
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      if (showTimer.current != null) window.clearTimeout(showTimer.current);
    };
  }, []);

  if (!tip) return null;

  const transform =
    tip.side === 'top'
      ? 'translate(-50%, -100%)'
      : tip.side === 'bottom'
        ? tip.align === 'end'
          ? 'translate(-100%, 0)'
          : 'translate(-50%, 0)'
        : tip.side === 'left'
          ? 'translate(-100%, -50%)'
          : 'translate(0, -50%)';

  return createPortal(
    <div
      data-tooltip-layer
      role="tooltip"
      style={{ top: pos.top, left: pos.left, transform }}
      className="tooltip-layer"
      data-multiline={tip.multiline ? '' : undefined}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
