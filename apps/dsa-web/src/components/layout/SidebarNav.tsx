import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, BriefcaseBusiness, Home, LogOut, MessageSquareQuote, Settings2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAgentChatStore } from '../../stores/agentChatStore';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: 'completion';
  group?: 'main' | 'tools';
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home',      label: 'Trang chủ', to: '/',          icon: Home,               exact: true, group: 'main' },
  { key: 'chat',      label: 'Hỏi AI',    to: '/chat',      icon: MessageSquareQuote, badge: 'completion', group: 'main' },
  { key: 'portfolio', label: 'Danh mục',  to: '/portfolio', icon: BriefcaseBusiness,  group: 'tools' },
  { key: 'backtest',  label: 'Backtest',  to: '/backtest',  icon: BarChart3,           group: 'tools' },
  { key: 'settings',  label: 'Cài đặt',  to: '/settings',  icon: Settings2,           group: 'tools' },
];

const mainItems  = NAV_ITEMS.filter((i) => i.group === 'main');
const toolsItems = NAV_ITEMS.filter((i) => i.group === 'tools');

function NavItemLink({
  item,
  collapsed,
  completionBadge,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  completionBadge: boolean;
  onNavigate?: () => void;
}) {
  const { key, label, to, icon: Icon, exact, badge } = item;

  const link = (
    <NavLink
      key={key}
      to={to}
      end={exact}
      onClick={onNavigate}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 border-y border-x-0 text-sm transition-all',
          'h-[var(--nav-item-height)]',
          collapsed ? 'justify-center px-0' : 'px-[var(--nav-item-padding-x)]',
          isActive
            ? 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-foreground shadow-[inset_0_0_15px_var(--nav-active-shadow)]'
            : 'border-transparent text-secondary-text hover:bg-[var(--nav-hover-bg)] hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="activeIndicator"
              className="absolute top-0 bottom-0 left-0 w-[var(--nav-indicator-width)] bg-[var(--nav-indicator-bg)] shadow-[0_0_10px_var(--nav-indicator-shadow)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
          <Icon
            className={cn(
              'ml-1 h-5 w-5 shrink-0',
              isActive ? 'text-[var(--nav-icon-active)]' : 'text-current',
            )}
          />
          {!collapsed ? <span className="truncate">{label}</span> : null}
          {badge === 'completion' && completionBadge ? (
            <span
              data-testid="chat-completion-badge"
              className={cn(
                'absolute right-3 h-2.5 w-2.5 rounded-full border-2 border-background bg-[var(--nav-badge-bg)] shadow-[0_0_10px_var(--nav-indicator-shadow)]',
                collapsed ? 'right-2 top-2' : '',
              )}
              aria-label="Hỏi CP có tin nhắn mới"
            />
          ) : null}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed = false, onNavigate }) => {
  const { authEnabled, logout } = useAuth();
  const completionBadge = useAgentChatStore((state) => state.completionBadge);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const logoutButton = (
    <button
      type="button"
      onClick={() => setShowLogoutConfirm(true)}
      className={cn(
        'mt-2 flex h-11 w-full cursor-pointer select-none items-center gap-3 rounded-2xl border border-transparent px-3 text-sm text-secondary-text transition-all hover:border-border/70 hover:bg-hover hover:text-foreground',
        collapsed ? 'justify-center px-2' : '',
      )}
    >
      <LogOut className="h-5 w-5 shrink-0" />
      {!collapsed ? <span>Đăng xuất</span> : null}
    </button>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        {/* ── Logo / Brand ── */}
        <div className={cn('mb-3 flex items-center gap-2.5 px-1', collapsed ? 'justify-center' : '')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
            <BarChart3 className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-foreground">DSA</p>
              <p className="truncate text-[10px] text-secondary-text">Stock Analysis</p>
            </div>
          ) : null}
        </div>

        <Separator className="mb-3 bg-border/40" />

        {/* ── Main nav group ── */}
        <nav className="flex flex-col gap-1" aria-label="Điều hướng chính">
          {mainItems.map((item) => (
            <NavItemLink
              key={item.key}
              item={item}
              collapsed={collapsed}
              completionBadge={completionBadge}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <Separator className="my-3 bg-border/40" />

        {/* ── Tools nav group ── */}
        {!collapsed ? (
          <p className="mb-1 px-[var(--nav-item-padding-x)] text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-text/70">
            Công cụ
          </p>
        ) : null}
        <nav className="flex flex-col gap-1" aria-label="Công cụ">
          {toolsItems.map((item) => (
            <NavItemLink
              key={item.key}
              item={item}
              collapsed={collapsed}
              completionBadge={completionBadge}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        {/* ── Theme toggle ── */}
        <div className="mt-4 mb-2">
          <ThemeToggle variant="nav" collapsed={collapsed} />
        </div>

        {/* ── Logout ── */}
        {authEnabled ? (
          <>
            <Separator className="mb-2 bg-border/40" />
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Đăng xuất
                </TooltipContent>
              </Tooltip>
            ) : (
              logoutButton
            )}
          </>
        ) : null}

        <ConfirmDialog
          isOpen={showLogoutConfirm}
          title="Đăng xuất"
          message="Xác nhận đăng xuất phiên hiện tại? Sau khi đăng xuất cần nhập lại mật khẩu."
          confirmText="Xác nhận đăng xuất"
          cancelText="Hủy"
          isDanger
          onConfirm={() => {
            setShowLogoutConfirm(false);
            onNavigate?.();
            void logout();
          }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      </div>
    </TooltipProvider>
  );
};
