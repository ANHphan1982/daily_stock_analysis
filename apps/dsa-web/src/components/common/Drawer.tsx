import type React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  zIndex?: number;
  side?: 'left' | 'right';
}

/**
 * Side drawer — wraps ShadCN Sheet (Radix UI).
 * Provides built-in Escape key, focus trap, backdrop click, and slide animations.
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  side = 'right',
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={side}
        className="flex flex-col gap-0 p-0"
        showCloseButton={true}
      >
        {title && (
          <SheetHeader className="border-b border-border/60 px-6 py-4">
            <span className="label-uppercase text-[10px] tracking-widest text-secondary-text">
              DETAIL VIEW
            </span>
            <SheetTitle className="mt-1 text-lg font-semibold text-foreground">
              {title}
            </SheetTitle>
          </SheetHeader>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
};
