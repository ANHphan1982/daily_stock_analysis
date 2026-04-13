import type React from 'react';
import { useEffect, useState } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { Drawer } from '../common/Drawer';
import { SidebarNav } from './SidebarNav';
import { cn } from '../../utils/cn';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';

type ShellProps = {
  children?: React.ReactNode;
};

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Auto-close mobile drawer on large viewports
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileOpen]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background text-foreground">
        {/* ── Mobile top bar ── */}
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex items-start justify-between px-3 lg:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/85 text-secondary-text shadow-soft-card backdrop-blur-md transition-colors hover:bg-hover hover:text-foreground"
                aria-label="Mở menu điều hướng"
              >
                <Menu className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Menu
            </TooltipContent>
          </Tooltip>

          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex min-h-screen w-full max-w-[1680px] px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
          {/* ── Desktop sidebar ── */}
          <aside
            className={cn(
              'sticky top-3 hidden shrink-0 overflow-visible rounded-[1.5rem] border border-[#00d4ff]/50 bg-card/72 shadow-soft-card backdrop-blur-sm transition-[width] duration-200 lg:flex',
              'max-h-[calc(100vh-1.5rem)] self-start sm:top-4 sm:max-h-[calc(100vh-2rem)]',
              collapsed ? 'w-[64px] p-2' : 'w-[172px] p-3',
            )}
            aria-label="Điều hướng thanh bên máy tính"
          >
            <div className="flex w-full flex-col">
              {/* Collapse toggle button */}
              <div className={cn('mb-2 flex', collapsed ? 'justify-center' : 'justify-end')}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setCollapsed((v) => !v)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-secondary-text/60 transition-colors hover:bg-hover hover:text-foreground"
                      aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
                    >
                      {collapsed
                        ? <PanelLeftOpen className="h-4 w-4" />
                        : <PanelLeftClose className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {collapsed ? 'Mở rộng' : 'Thu gọn'}
                  </TooltipContent>
                </Tooltip>
              </div>

              <SidebarNav collapsed={collapsed} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="min-h-0 min-w-0 flex-1 pt-14 lg:pl-3 lg:pt-0">
            {children ?? <Outlet />}
          </main>
        </div>

        {/* ── Mobile drawer ── */}
        <Drawer
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          title="Menu điều hướng"
          width="max-w-xs"
          zIndex={90}
          side="left"
        >
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      </div>
    </TooltipProvider>
  );
};
