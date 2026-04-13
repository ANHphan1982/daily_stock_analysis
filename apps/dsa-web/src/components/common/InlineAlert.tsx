import type React from 'react';
import { cn } from '../../utils/cn';
import { Separator } from '../ui/separator';

type InlineAlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface InlineAlertProps {
  title?: string;
  message: React.ReactNode;
  variant?: InlineAlertVariant;
  action?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<InlineAlertVariant, string> = {
  info: 'border-cyan/20 bg-cyan/10 text-cyan',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  danger: 'border-danger/20 bg-danger/10 text-danger',
};

const separatorStyles: Record<InlineAlertVariant, string> = {
  info: 'bg-cyan/20',
  success: 'bg-success/20',
  warning: 'bg-warning/20',
  danger: 'bg-danger/20',
};

export const InlineAlert: React.FC<InlineAlertProps> = ({
  title,
  message,
  variant = 'info',
  action,
  className = '',
}) => {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 shadow-soft-card',
        variantStyles[variant],
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          {title && <Separator className={cn('my-2', separatorStyles[variant])} />}
          <div className={cn('text-sm', title ? 'opacity-90' : 'opacity-90')}>{message}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
};
