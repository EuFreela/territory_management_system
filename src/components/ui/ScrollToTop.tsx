import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IconArrowUp } from '@/components/Map/mapIcons';

const SHOW_AFTER_PX = 120;

function getScrollY() {
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/** Seta flutuante global — volta ao topo em qualquer página */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const update = () => {
      setVisible(getScrollY() > SHOW_AFTER_PX);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    document.addEventListener('scroll', update, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, []);

  // Reavalia ao trocar de rota (conteúdo pode ser mais curto/longo)
  useEffect(() => {
    setVisible(getScrollY() > SHOW_AFTER_PX);
  }, [location.pathname, location.hash, location.search]);

  function goTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <button
      type="button"
      onClick={goTop}
      title="Voltar ao topo"
      aria-label="Voltar ao topo"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-5 right-5 z-[9999] inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-900/25 transition-all duration-200 hover:bg-sky-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 active:scale-95 sm:bottom-6 sm:right-6 ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <IconArrowUp className="h-5 w-5" />
    </button>
  );
}
