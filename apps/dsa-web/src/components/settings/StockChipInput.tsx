import type React from 'react';
import { useState } from 'react';

interface StockChipInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function parseCodes(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function serializeCodes(codes: string[]): string {
  return codes.join(',');
}

export const StockChipInput: React.FC<StockChipInputProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Thêm mã...',
}) => {
  const [inputVal, setInputVal] = useState('');
  const codes = parseCodes(value);

  const addCode = (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code || codes.includes(code)) return;
    onChange(serializeCodes([...codes, code]));
  };

  const removeCode = (code: string) => {
    const next = codes.filter((c) => c !== code);
    onChange(serializeCodes(next));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.endsWith(',')) {
      addCode(v.slice(0, -1));
      setInputVal('');
    } else {
      setInputVal(v);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCode(inputVal);
      setInputVal('');
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/55 bg-card/94 p-2 min-h-[44px]">
      {codes.map((code) => (
        <span
          key={code}
          data-testid={`chip-${code}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary"
        >
          <span data-testid={`chip-label-${code}`}>{code}</span>
          <button
            type="button"
            data-testid={`chip-remove-${code}`}
            disabled={disabled}
            onClick={() => removeCode(code)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Xóa ${code}`}
          >
            <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      <input
        data-testid="chip-input"
        type="text"
        value={inputVal}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={codes.length === 0 ? placeholder : ''}
        className="min-w-[80px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-text disabled:cursor-not-allowed"
      />
    </div>
  );
};
