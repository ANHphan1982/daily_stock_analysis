import type React from 'react';
import { cn } from '../../utils/cn';
import { Card as ShadCard, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '../ui/card';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
}) => {
  return (
    <ShadCard
      className={cn(
        'terminal-card gap-0 rounded-2xl border-border/60 bg-card/80 shadow-soft-card backdrop-blur-sm p-5',
        className,
      )}
    >
      <CardHeader className="px-0 pt-0 pb-4">
        {subtitle ? (
          <CardDescription className="label-uppercase">{subtitle}</CardDescription>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="mt-1 text-lg font-semibold text-foreground">{title}</CardTitle>
          {actions ? (
            <CardAction className="flex shrink-0 items-center gap-2">{actions}</CardAction>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </ShadCard>
  );
};
