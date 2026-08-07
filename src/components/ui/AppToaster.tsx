import { Toaster } from 'sonner';
import { useTheme } from '@/lib/theme-context';

/** Central de toasts (Sonner) com visual Apple, seguindo o tema claro/escuro do app */
export default function AppToaster() {
  const { theme } = useTheme();

  return (
    <>
      <Toaster
        theme={theme}
        position="bottom-right"
        offset={20}
        gap={10}
        closeButton
        richColors
        visibleToasts={4}
        toastOptions={{ duration: 4000 }}
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
