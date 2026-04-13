import React, { useId } from 'react';
import { cn } from '../../utils/cn';
import { Label } from '../ui/label';
import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}

/**
 * Select component — wraps ShadCN Select (Radix) with project-specific styling.
 * Keyboard-navigable and accessible out of the box.
 */
export const Select: React.FC<SelectProps> = ({
  id,
  value,
  onChange,
  options,
  label,
  placeholder = '请选择',
  disabled = false,
  className = '',
}) => {
  const selectId = useId();
  const resolvedId = id ?? selectId;

  return (
    <div className={cn('flex flex-col', className)}>
      {label ? (
        <Label htmlFor={resolvedId} className="mb-2 text-sm font-medium text-foreground">
          {label}
        </Label>
      ) : null}
      <ShadSelect
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={resolvedId}
          className="h-11 w-full rounded-xl border-subtle bg-card px-4 text-sm text-foreground shadow-soft-card transition-all hover:border-subtle-hover focus:ring-4 focus:ring-cyan/15 focus:border-cyan/40"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadSelect>
    </div>
  );
};
