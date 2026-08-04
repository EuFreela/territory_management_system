import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { IconCheckCircle, IconLogOut, IconMap, IconUsers } from '@/components/Map/mapIcons';
import { useAuth } from '@/lib/auth-context';

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition',
    isActive
      ? 'bg-apple-ink text-white shadow-soft'
      : 'text-apple-secondary hover:bg-apple-fill hover:text-apple-ink',
  ].join(' ');
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [territoriesOpen, setTerritoriesOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const finishedActive = location.pathname === '/territories/finalizados';
  const territoriesActive =
    location.pathname === '/territories' ||
    location.pathname.startsWith('/territories/') && !finishedActive;
  const territoriesMenuActive = territoriesActive || finishedActive;

  function updateMenuPosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      left: Math.max(8, rect.left),
    });
  }

  useLayoutEffect(() => {
    if (!territoriesOpen) return;
    updateMenuPosition();
  }, [territoriesOpen]);

  useEffect(() => {
    if (!territoriesOpen) return;

    function onScrollOrResize() {
      updateMenuPosition();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setTerritoriesOpen(false);
    }

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setTerritoriesOpen(false);
    }

    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);

    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [territoriesOpen]);

  // fecha ao trocar de rota
  useEffect(() => {
    setTerritoriesOpen(false);
  }, [location.pathname]);

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function go(path: string) {
    setTerritoriesOpen(false);
    navigate(path);
  }

  const dropdown =
    territoriesOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[9990] min-w-[220px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.14)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => go('/territories')}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition ${
                territoriesActive && !finishedActive
                  ? 'bg-[#f5f5f7] text-[#1d1d1f]'
                  : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
              }`}
            >
              <IconMap className="h-4 w-4 shrink-0 text-[#86868b]" />
              Lista de territórios
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => go('/territories/finalizados')}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition ${
                finishedActive
                  ? 'bg-[#f5f5f7] text-[#1d1d1f]'
                  : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
              }`}
            >
              <IconCheckCircle className="h-4 w-4 shrink-0 text-[#34c759]" />
              Finalizados
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="min-h-screen bg-apple-bg">
      <header className="sticky top-0 z-[40] border-b border-apple-line bg-white/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link to="/dashboard" className="group flex shrink-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-apple-ink text-[13px] font-semibold tracking-tight text-white shadow-soft transition group-hover:scale-[1.03]">
                C
              </span>
              <span className="hidden text-[17px] font-semibold tracking-tightish text-apple-ink sm:inline">
                Campo
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <NavLink to="/dashboard" className={navClass} end>
                Início
              </NavLink>

              {can('territory:read') ? (
                <>
                  <button
                    ref={buttonRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTerritoriesOpen((o) => !o);
                    }}
                    className={[
                      'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition',
                      territoriesMenuActive || territoriesOpen
                        ? 'bg-apple-ink text-white shadow-soft'
                        : 'text-apple-secondary hover:bg-apple-fill hover:text-apple-ink',
                    ].join(' ')}
                    aria-expanded={territoriesOpen}
                    aria-haspopup="menu"
                  >
                    <IconMap className="h-3.5 w-3.5 opacity-80" />
                    Territórios
                    <svg
                      className={`h-3.5 w-3.5 opacity-70 transition-transform ${
                        territoriesOpen ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {dropdown}
                </>
              ) : null}

              <NavLink to="/dirigentes" className={navClass}>
                <IconUsers className="h-3.5 w-3.5 opacity-80" />
                Dirigentes
              </NavLink>
              {can('user:manage') ? (
                <NavLink to="/usuarios" className={navClass}>
                  Usuários
                </NavLink>
              ) : null}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[10rem] truncate text-[13px] font-medium text-apple-ink">
                {user?.name}
              </p>
              {user?.role?.name ? (
                <p className="text-[11px] text-apple-tertiary">{user.role.name}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              title="Sair"
              aria-label="Sair"
              className="app-icon-btn"
            >
              <IconLogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="pb-16">{children}</div>
    </div>
  );
}
