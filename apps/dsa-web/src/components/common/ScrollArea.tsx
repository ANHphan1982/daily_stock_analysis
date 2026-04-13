import type React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '../../utils/cn';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  testId?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

/**
 * ScrollArea — wraps Radix ScrollArea with a custom scrollbar.
 * Preserves viewportRef and onScroll from the original API.
 */
export const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className,
  viewportClassName,
  testId,
  viewportRef,
  onScroll,
}) => {
  return (
    <ScrollAreaPrimitive.Root
      className={cn('min-h-0 flex-1 overflow-hidden', className)}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-testid={testId}
        onScroll={onScroll}
        className={cn('h-full w-full rounded-[inherit]', viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex touch-none select-none p-px transition-colors w-2.5 border-l border-l-transparent"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border/60 hover:bg-border" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
};
