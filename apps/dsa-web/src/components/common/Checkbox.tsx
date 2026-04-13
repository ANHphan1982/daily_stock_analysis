import type React from 'react';
import { useId } from 'react';
import { cn } from '../../utils/cn';
import { Checkbox as ShadCheckbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  /** @deprecated Use onCheckedChange instead for Radix Checkbox */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  name?: string;
  value?: string;
}

/**
 * Checkbox — wraps ShadCN Checkbox (Radix UI).
 * Keeps the label+container API from the original component.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  id,
  className = '',
  containerClassName = '',
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  name,
}) => {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <div className={cn('flex items-center gap-3', containerClassName)}>
      <ShadCheckbox
        id={checkboxId}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded border-border/70 text-cyan focus:ring-cyan/20',
          className,
        )}
      />
      {label && (
        <Label
          htmlFor={checkboxId}
          className="cursor-pointer select-none text-sm font-medium text-foreground"
        >
          {label}
        </Label>
      )}
    </div>
  );
};
