import type { CSSProperties } from 'react';
import { Toaster } from 'sonner';
import { useTheme } from '@/lib/theme-context';

/** Central de toasts (Sonner): padrão único (caixas quadradas + richColors) em todo o app */
export default function AppToaster() {
  const { theme } = useTheme();

  return (
    <>
      <Toaster
        theme={theme}
        position="bottom-center"
        offset={20}
        gap={10}
        closeButton
        richColors
        visibleToasts={4}
        className="app-toaster"
        toastOptions={{
          duration: 4000,
          style: { '--toast-duration': '4000ms' } as CSSProperties,
        }}
      />
      {/* Toaster exclusivo para confirmações (toasterId: 'confirm'): centralizado,
          com fundo escurecido e desfocado, como os modais do app */}
      <Toaster
        id="confirm"
        theme={theme}
        position="top-center"
        richColors
        visibleToasts={1}
        className="app-confirm-toaster"
        toastOptions={{ duration: Infinity }}
      />
    </>
  );
}
