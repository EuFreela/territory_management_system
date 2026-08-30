import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  IconCheckCircle,
  IconChevronDown,
  IconHelp,
  IconInfo,
  IconLogOut,
  IconMap,
  IconMenu,
  IconMoon,
  IconSettings,
  IconSun,
  IconUser,
  IconUsers,
  IconX,
} from '@/components/Map/mapIcons';
import FloatingChat from '@/components/chat/FloatingChat';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

type MenuId = 'territories' | 'users' | 'account' | null;

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

function HeaderDropdown({
  open,
  anchorRef,
  menuRef,
  align = 'left',
  minWidth = 220,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  align?: 'left' | 'right';
  minWidth?: number;
  children: ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function updatePosition() {
    const btn = anchorRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left =
      align === 'right'
        ? Math.max(8, Math.min(rect.right - minWidth, window.innerWidth - minWidth - 8))
        : Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8));
    setPos({ top: rect.bottom + 8, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updatePosition();
    }
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ top: pos.top, left: pos.left, minWidth }}
      className="fixed z-[9990] overflow-hidden rounded-2xl border border-apple-line bg-apple-surface py-1.5 shadow-float"
    >
      {children}
    </div>,
    document.body,
  );
}

function menuItemClass(active: boolean) {
  return [
    'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition',
    active ? 'bg-apple-fill text-apple-ink' : 'text-apple-ink hover:bg-apple-fill',
  ].join(' ');
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const territoriesBtnRef = useRef<HTMLButtonElement>(null);
  const usersBtnRef = useRef<HTMLButtonElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const finishedActive = location.pathname === '/territories/finalizados';
  const territoriesActive =
    location.pathname === '/territories' ||
    (location.pathname.startsWith('/territories/') && !finishedActive);
  const territoriesMenuActive = territoriesActive || finishedActive;
  const profileActive = location.pathname === '/perfil';
  const usersActive = location.pathname === '/usuarios';
  const usersMenuActive = profileActive || usersActive;

  useEffect(() => {
    if (!openMenu) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenu(null);
    }

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (territoriesBtnRef.current?.contains(target)) return;
      if (usersBtnRef.current?.contains(target)) return;
      if (accountBtnRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpenMenu(null);
    }

    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [openMenu]);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [location.pathname]);

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
    setOpenMenu(null);
    await logout();
    navigate('/login', { replace: true });
  }

  function go(path: string) {
    setOpenMenu(null);
    setMobileOpen(false);
    navigate(path);
  }

  function toggleMenu(id: MenuId) {
    setOpenMenu((current) => (current === id ? null : id));
  }

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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-[100] border-b border-apple-line bg-apple-surface/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            {logo}

            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/dashboard" className={navClass} end>
                Início
              </NavLink>

              {can('territory:read') ? (
                <>
                  <button
                    ref={territoriesBtnRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu('territories');
                    }}
                    className={[
                      'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] leading-none font-medium transition',
                      territoriesMenuActive || openMenu === 'territories'
                        ? 'bg-apple-ink text-apple-bg shadow-soft'
                        : 'text-apple-secondary hover:bg-apple-fill hover:text-apple-ink',
                    ].join(' ')}
                    aria-expanded={openMenu === 'territories'}
                    aria-haspopup="menu"
                  >
                    <IconMap className="h-3.5 w-3.5 opacity-80" />
                    Territórios
                    <IconChevronDown
                      className={`h-3.5 w-3.5 opacity-70 transition-transform ${
                        openMenu === 'territories' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <HeaderDropdown
                    open={openMenu === 'territories'}
                    anchorRef={territoriesBtnRef}
                    menuRef={menuRef}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => go('/territories')}
                      className={menuItemClass(territoriesActive && !finishedActive)}
                    >
                      <IconMap className="h-4 w-4 shrink-0 text-apple-tertiary" />
                      Lista de territórios
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => go('/territories/finalizados')}
                      className={menuItemClass(finishedActive)}
                    >
                      <IconCheckCircle className="h-4 w-4 shrink-0 text-apple-green" />
                      Finalizados
                    </button>
                  </HeaderDropdown>
                </>
              ) : null}

              {can('block:manage') ? (
                <NavLink to="/dirigentes" className={navClass}>
                  Dirigentes
                </NavLink>
              ) : null}

              <button
                ref={usersBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu('users');
                }}
                className={[
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] leading-none font-medium transition',
                  usersMenuActive || openMenu === 'users'
                    ? 'bg-apple-ink text-apple-bg shadow-soft'
                    : 'text-apple-secondary hover:bg-apple-fill hover:text-apple-ink',
                ].join(' ')}
                aria-expanded={openMenu === 'users'}
                aria-haspopup="menu"
              >
                <IconUsers className="h-3.5 w-3.5 opacity-80" />
                Usuários
                <IconChevronDown
                  className={`h-3.5 w-3.5 opacity-70 transition-transform ${
                    openMenu === 'users' ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <HeaderDropdown
                open={openMenu === 'users'}
                anchorRef={usersBtnRef}
                menuRef={menuRef}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => go('/perfil')}
                  className={menuItemClass(profileActive)}
                >
                  <IconUser className="h-4 w-4 shrink-0 text-apple-tertiary" />
                  Minha conta
                </button>
                {can('user:manage') ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => go('/usuarios#novo-usuario')}
                    className={menuItemClass(usersActive)}
                  >
                    <IconUsers className="h-4 w-4 shrink-0 text-apple-tertiary" />
                    Criar usuários
                  </button>
                ) : null}
              </HeaderDropdown>

              <a href="/docs/tutorial.html" target="_blank" rel="noopener noreferrer" className={navClass({ isActive: false })}>
                <IconHelp className="h-3.5 w-3.5 opacity-80" />
                Tutorial
              </a>
              <NavLink to="/sobre" className={navClass}>
                <IconInfo className="h-3.5 w-3.5 opacity-80" />
                Sobre
              </NavLink>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              ref={accountBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu('account');
              }}
              className={[
                'app-icon-btn',
                openMenu === 'account' ? 'bg-apple-fill' : '',
              ].join(' ')}
              aria-label="Conta"
              aria-expanded={openMenu === 'account'}
              aria-haspopup="menu"
              data-tooltip="Conta"
              data-tooltip-side="bottom"
            >
              <IconUser className="h-4 w-4" />
            </button>
            <HeaderDropdown
              open={openMenu === 'account'}
              anchorRef={accountBtnRef}
              menuRef={menuRef}
              align="right"
              minWidth={240}
            >
              <div className="border-b border-apple-line px-3.5 py-3">
                <p className="truncate text-[13px] font-medium text-apple-ink">{user?.name}</p>
                {user?.role?.name ? (
                  <p className="mt-0.5 text-[12px] text-apple-tertiary">{user.role.name}</p>
                ) : null}
                {user?.congregation_name ? (
                  <p className="mt-0.5 truncate text-[12px] text-apple-tertiary">
                    {user.congregation_name}
                  </p>
                ) : null}
                {user?.working_cep ? (
                  <p className="mt-0.5 text-[12px] text-apple-tertiary">CEP {user.working_cep}</p>
                ) : null}
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => go('/configuracao')}
                className={menuItemClass(location.pathname === '/configuracao')}
              >
                <IconSettings className="h-4 w-4 shrink-0 text-apple-tertiary" />
                Configuração
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void onLogout()}
                className={menuItemClass(false)}
              >
                <IconLogOut className="h-4 w-4 shrink-0 text-apple-tertiary" />
                Sair
              </button>
            </HeaderDropdown>

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
              className="app-icon-btn md:hidden"
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
              onClick={() => {
                setOpenMenu(null);
                setMobileOpen((o) => !o);
              }}
            >
              {mobileOpen ? <IconX className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

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
              {user?.congregation_name ? (
                <p className="text-[12px] text-apple-tertiary">{user.congregation_name}</p>
              ) : null}
              {user?.working_cep ? (
                <p className="text-[12px] text-apple-tertiary">CEP {user.working_cep}</p>
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

              {can('block:manage') ? (
                <NavLink to="/dirigentes" className={mobileNavClass}>
                  Dirigentes
                </NavLink>
              ) : null}

              <div className="space-y-2">
                <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-apple-tertiary">
                  Usuários
                </p>
                <button
                  type="button"
                  onClick={() => go('/perfil')}
                  className={mobileNavClass({ isActive: profileActive })}
                >
                  <IconUser className="h-4 w-4 opacity-70" />
                  Minha conta
                </button>
                {can('user:manage') ? (
                  <button
                    type="button"
                    onClick={() => go('/usuarios#novo-usuario')}
                    className={mobileNavClass({ isActive: usersActive })}
                  >
                    <IconUsers className="h-4 w-4 opacity-70" />
                    Criar usuários
                  </button>
                ) : null}
              </div>

              <a href="/docs/tutorial.html" target="_blank" rel="noopener noreferrer" className={mobileNavClass({ isActive: false })}>
                <IconHelp className="h-4 w-4 opacity-70" />
                Tutorial
              </a>

              <NavLink to="/sobre" className={mobileNavClass}>
                <IconInfo className="h-4 w-4 opacity-70" />
                Sobre
              </NavLink>
            </nav>

            <div className="flex items-center justify-center gap-2 border-t border-apple-line p-4">
              <button
                type="button"
                onClick={toggleTheme}
                data-tooltip={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
                className="app-icon-btn"
              >
                {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => void onLogout()}
                data-tooltip="Sair"
                aria-label="Sair"
                className="app-icon-btn"
              >
                <IconLogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pb-16">{children}</div>

      <FloatingChat />
    </div>
  );
}
