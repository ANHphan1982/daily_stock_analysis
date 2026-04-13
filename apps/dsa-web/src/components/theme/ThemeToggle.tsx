import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '../../utils/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type ThemeOption = 'light' | 'dark' | 'system';
type ThemeToggleVariant = 'default' | 'nav';

const THEME_OPTIONS: Array<{
  value: ThemeOption;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light',  label: 'Sáng',          icon: Sun     },
  { value: 'dark',   label: 'Tối',            icon: Moon    },
  { value: 'system', label: 'Theo hệ thống',  icon: Monitor },
];

function resolveThemeLabel(theme: string | undefined) {
  switch (theme) {
    case 'light':  return 'Sáng';
    case 'dark':   return 'Tối';
    default:       return 'Hệ thống';
  }
}

interface ThemeToggleProps {
  variant?: ThemeToggleVariant;
  collapsed?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'default',
  collapsed = false,
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const activeTheme  = (theme as ThemeOption | undefined) ?? 'system';
  const visualTheme  = resolvedTheme ?? 'dark';
  const TriggerIcon  = visualTheme === 'light' ? Sun : Moon;
  const isNavVariant = variant === 'nav';

  const triggerButton = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      data-state={open ? 'open' : 'closed'}
      className={cn(
        isNavVariant
          ? 'group relative flex h-[var(--nav-item-height)] w-full select-none items-center gap-3 border-y border-x-0 border-transparent px-[var(--nav-item-padding-x)] text-sm text-secondary-text transition-all duration-200 hover:bg-[var(--nav-hover-bg)] hover:text-foreground data-[state=open]:border-[var(--nav-active-border)] data-[state=open]:bg-[var(--nav-active-bg)] data-[state=open]:text-foreground'
          : 'inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 text-sm text-secondary-text shadow-soft-card transition-colors hover:bg-hover hover:text-foreground',
        isNavVariant && collapsed ? 'justify-center px-0' : '',
      )}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Chuyển chủ đề"
    >
      <TriggerIcon className={cn('shrink-0', isNavVariant ? 'ml-1 h-5 w-5' : 'h-4 w-4')} />
      {isNavVariant ? (
        collapsed ? null : <span className="truncate text-sm">Chủ đề</span>
      ) : (
        <span className="hidden sm:inline">{resolveThemeLabel(activeTheme)}</span>
      )}
    </button>
  );

  return (
    <div className="relative" ref={containerRef}>
      {/* Wrap collapsed nav trigger in Tooltip */}
      {isNavVariant && collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Chủ đề: {resolveThemeLabel(activeTheme)}
          </TooltipContent>
        </Tooltip>
      ) : (
        triggerButton
      )}

      {open ? (
        <div
          role="menu"
          aria-label="Chủ đề hiển thị"
          className={cn(
            'z-[100] min-w-[9rem] overflow-hidden rounded-2xl border border-border/70 bg-elevated p-1.5 shadow-[0_24px_48px_rgba(3,8,20,0.32)] backdrop-blur-xl',
            isNavVariant
              ? 'absolute bottom-full left-0 mb-2 w-max'
              : 'absolute right-0 mt-2',
          )}
        >
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = activeTheme === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => { setTheme(value); setOpen(false); }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-cyan/10 text-foreground'
                    : 'text-secondary-text hover:bg-hover hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                {isActive ? <Check className="h-4 w-4 text-cyan" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
