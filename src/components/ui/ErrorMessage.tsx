import React from 'react';

interface ErrorMessageProps {
  message: string;
  title?: string;
  retry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, title = 'Ha ocurrido un error', retry }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 max-w-xl mx-auto shadow-sm">
      <div className="text-red-500 shrink-0">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-red-900">{title}</h4>
        <p className="text-xs text-red-700 leading-relaxed">{message}</p>
        {retry && (
          <button
            onClick={retry}
            className="text-xs font-semibold text-red-800 hover:text-red-950 underline self-start mt-2 transition-all"
          >
            Intentar de nuevo
          </button>
        )}
      </div>
    </div>
  );
};
