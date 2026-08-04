import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  IconCheckCircle,
  IconInfo,
  IconLogOut,
  IconMap,
  IconMoon,
  IconSun,
  IconUsers,
  IconX,
} from '@/components/Map/mapIcons';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition',
    isActive
      ? 'bg-apple-ink text-apple-bg shadow-soft'
      : 'text-apple-secondary hover:bg-apple-fill hover:text-apple-ink',
  ].join(' ');
}

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return [
    'flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-medium transition',
    isActive
      ? 'bg-apple-ink text-apple-bg'
      : 'bg-apple-fill text-apple-ink hover:bg-apple-line',
  ].join(' ');
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [territoriesOpen, setTerritoriesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const finishedActive = location.pathname === '/territories/finalizados';
  const territoriesActive =
    location.pathname === '/territories' ||
    (location.pathname.startsWith('/territories/') && !finishedActive);
  const territoriesMenuActive = territoriesActive || finishedActive;

  function updateMenuPosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 236)),
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

  // fecha menus ao trocar de rota
  useEffect(() => {
    setTerritoriesOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  // trava scroll do body com menu mobile aberto
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  async function onLogout() {
    setMobileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  function go(path: string) {
    setTerritoriesOpen(false);
    setMobileOpen(false);
    navigate(path);
  }

  const dropdown =
    territoriesOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[9990] min-w-[220px] overflow-hidden rounded-2xl border border-apple-line bg-apple-surface py-1.5 shadow-float"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => go('/territories')}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition ${
                territoriesActive && !finishedActive
                  ? 'bg-apple-fill text-apple-ink'
                  : 'text-apple-ink hover:bg-apple-fill'
              }`}
            >
              <IconMap className="h-4 w-4 shrink-0 text-apple-tertiary" />
              Lista de territórios
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => go('/territories/finalizados')}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition ${
                finishedActive
                  ? 'bg-apple-fill text-apple-ink'
                  : 'text-apple-ink hover:bg-apple-fill'
              }`}
            >
              <IconCheckCircle className="h-4 w-4 shrink-0 text-apple-green" />
              Finalizados
            </button>
          </div>,
          document.body,
        )
      : null;

  const logo = (
    <Link
      to="/dashboard"
      className="group flex shrink-0 items-center"
      onClick={() => setMobileOpen(false)}
      aria-label="Campo — Início"
    >
      <img
        src="/logo.webp"
        alt="Campo"
        width={36}
        height={36}
        className="h-9 w-9 rounded-[10px] object-cover shadow-soft ring-1 ring-black/[0.06] transition group-hover:scale-[1.03]"
      />
    </Link>
  );

  return (
    <div className="min-h-screen bg-apple-bg">
      <header className="sticky top-0 z-[100] border-b border-apple-line bg-apple-surface/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            {logo}

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex">
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
                        ? 'bg-apple-ink text-apple-bg shadow-soft'
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
                  <IconUsers className="h-3.5 w-3.5 opacity-80" />
                  Usuários
                </NavLink>
              ) : null}
              <NavLink to="/sobre" className={navClass}>
                <IconInfo className="h-3.5 w-3.5 opacity-80" />
                Sobre
              </NavLink>
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
              onClick={toggleTheme}
              data-tooltip={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              data-tooltip-side="bottom"
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              className="app-icon-btn"
            >
              {theme === 'dark' ? (
                <IconSun className="h-4 w-4" />
              ) : (
                <IconMoon className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void onLogout()}
              data-tooltip="Sair"
              data-tooltip-side="bottom"
              aria-label="Sair"
              className="app-icon-btn hidden sm:inline-flex"
            >
              <IconLogOut className="h-4 w-4" />
            </button>

            {/* Hamburger — mobile */}
            <button
              type="button"
              className="app-icon-btn md:hidden"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
              onClick={() => {
                setTerritoriesOpen(false);
                setMobileOpen((o) => !o);
              }}
            >
              {mobileOpen ? (
                <IconX className="h-5 w-5" />
              ) : (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[110] md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="app-mobile-drawer absolute inset-x-0 top-14 bottom-0 flex flex-col bg-apple-surface shadow-float">
            <div className="border-b border-apple-line px-5 py-4">
              <p className="text-[13px] font-medium text-apple-ink">{user?.name}</p>
              {user?.role?.name ? (
                <p className="text-[12px] text-apple-tertiary">{user.role.name}</p>
              ) : null}
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              <NavLink to="/dashboard" className={mobileNavClass} end>
                Início
              </NavLink>

              {can('territory:read') ? (
                <div className="space-y-2">
                  <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-apple-tertiary">
                    Territórios
                  </p>
                  <button
                    type="button"
                    onClick={() => go('/territories')}
                    className={mobileNavClass({ isActive: territoriesActive && !finishedActive })}
                  >
                    <IconMap className="h-4 w-4 opacity-70" />
                    Lista de territórios
                  </button>
                  <button
                    type="button"
                    onClick={() => go('/territories/finalizados')}
                    className={mobileNavClass({ isActive: finishedActive })}
                  >
                    <IconCheckCircle className="h-4 w-4 text-apple-green" />
                    Finalizados
                  </button>
                </div>
              ) : null}

              <NavLink to="/dirigentes" className={mobileNavClass}>
                <IconUsers className="h-4 w-4 opacity-70" />
                Dirigentes
              </NavLink>

              {can('user:manage') ? (
                <NavLink to="/usuarios" className={mobileNavClass}>
                  <IconUsers className="h-4 w-4 opacity-70" />
                  Usuários
                </NavLink>
              ) : null}

              <NavLink to="/sobre" className={mobileNavClass}>
                <IconInfo className="h-4 w-4 opacity-70" />
                Sobre
              </NavLink>
            </nav>

            <div className="space-y-2 border-t border-apple-line p-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-apple-line bg-apple-fill px-4 py-3 text-[14px] font-medium text-apple-ink transition hover:bg-apple-line"
              >
                {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
                {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              </button>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-apple-line bg-apple-surface px-4 py-3 text-[14px] font-medium text-apple-ink transition hover:bg-apple-fill"
              >
                <IconLogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pb-16">{children}</div>
    </div>
  );
}
