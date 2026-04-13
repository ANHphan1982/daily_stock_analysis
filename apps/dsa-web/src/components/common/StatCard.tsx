import type React from 'react';
import { cn } from '../../utils/cn';
import { Card as ShadCard, CardContent } from '../ui/card';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const toneStyles = {
  default: 'border-subtle',
  primary: 'border-cyan/18',
  success: 'border-success/18',
  warning: 'border-warning/18',
  danger: 'border-danger/18',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className = '',
}) => {
  return (
    <ShadCard
      className={cn(
        'gap-0 rounded-2xl border bg-card/75 shadow-soft-card p-4',
        toneStyles[tone],
        className,
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-secondary-text">{label}</p>
            <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
            {hint ? <div className="mt-2 text-sm text-secondary-text">{hint}</div> : null}
          </div>
          {icon ? <div className="text-cyan">{icon}</div> : null}
        </div>
      </CardContent>
    </ShadCard>
  );
};
