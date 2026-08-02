import { useEffect, useState } from 'react';
import { IconArrowUp } from '@/components/Map/mapIcons';

/** Seta flutuante para subir ao topo da página */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 280);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function goTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={goTop}
      title="Voltar ao topo"
      aria-label="Voltar ao topo"
      className="fixed bottom-6 right-6 z-[100] inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 active:scale-95"
    >
      <IconArrowUp className="h-5 w-5" />
    </button>
  );
}
