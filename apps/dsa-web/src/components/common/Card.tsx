import type React from 'react';
import { cn } from '../../utils/cn';
import {
  Card as ShadCard,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../ui/card';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'gradient';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Card component — wraps ShadCN Card with project-specific variants.
 */
export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  className = '',
  variant = 'default',
  hoverable = false,
  padding = 'md',
}) => {
  const hoverStyles = hoverable ? 'cursor-pointer hover:shadow-md hover:border-border transition-shadow' : '';

  if (variant === 'gradient') {
    return (
      <div className={cn('gradient-border-card', className)}>
        <div className={cn('gradient-border-card-inner', paddingStyles[padding])}>
          {(title || subtitle) && (
            <div className="mb-3">
              {subtitle ? <span className="label-uppercase">{subtitle}</span> : null}
              {title ? <h3 className="mt-1 text-lg font-semibold text-foreground">{title}</h3> : null}
            </div>
          )}
          {children}
        </div>
      </div>
    );
  }

  return (
    <ShadCard
      className={cn(
        'terminal-card gap-0 rounded-2xl border-border/60 bg-card/80 shadow-soft-card backdrop-blur-sm',
        hoverStyles,
        paddingStyles[padding],
        className,
      )}
    >
      {(title || subtitle) && (
        <CardHeader className="px-0 pt-0 pb-3">
          {subtitle ? <CardDescription className="label-uppercase">{subtitle}</CardDescription> : null}
          {title ? <CardTitle className="mt-1 text-lg font-semibold text-foreground">{title}</CardTitle> : null}
        </CardHeader>
      )}
      <CardContent className="p-0">
        {children}
      </CardContent>
    </ShadCard>
  );
};
