import type React from 'react';
import { cn } from '../../utils/cn';
import { Card as ShadCard, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}) => {
  return (
    <ShadCard
      className={cn(
        'gap-0 rounded-3xl border border-border/60 bg-card/70 px-5 py-5 shadow-soft-card backdrop-blur-sm',
        className,
      )}
    >
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow ? (
              <span className="label-uppercase text-[10px] tracking-widest text-secondary-text">
                {eyebrow}
              </span>
            ) : null}
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm text-secondary-text md:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {(eyebrow || description) && (
          <Separator className="mt-4 bg-border/40" />
        )}
      </CardContent>
    </ShadCard>
  );
};
