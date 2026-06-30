import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', id, ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-zinc-600">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 text-sm text-zinc-800 bg-white border ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 focus:ring-teal-500'
        } rounded-lg shadow-2xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all duration-150 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
    </div>
  );
};
