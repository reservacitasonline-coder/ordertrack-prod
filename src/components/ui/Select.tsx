import React, { useId } from 'react';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  placeholder,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-zinc-600">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-2 text-sm text-zinc-800 bg-white border ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 focus:ring-teal-500'
        } rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-150 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em] ${className}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
    </div>
  );
};
