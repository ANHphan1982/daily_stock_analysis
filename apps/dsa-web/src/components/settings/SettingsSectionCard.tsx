import type React from 'react';
import { cn } from '../../utils/cn';
import { Card as ShadCard, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '../ui/card';
import { Separator } from '../ui/separator';

interface SettingsSectionCardProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSectionCard: React.FC<SettingsSectionCardProps> = ({
  title,
  description,
  actions,
  children,
  className = '',
}) => {
  return (
    <ShadCard
      className={cn(
        'gap-0 rounded-[1.5rem] border settings-border bg-card shadow-soft-card-strong',
        className,
      )}
    >
      <CardHeader className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-foreground">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription className="text-xs leading-6 text-muted-text">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {actions ? (
            <CardAction className="flex shrink-0 items-center gap-2">{actions}</CardAction>
          ) : null}
        </div>
      </CardHeader>

      <Separator className="bg-border/40" />

      <CardContent className="px-5 py-5">
        <div className="space-y-5">{children}</div>
      </CardContent>
    </ShadCard>
  );
};
