import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl z-10 w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 rounded-lg p-1 hover:bg-zinc-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 overflow-y-auto flex-1 text-sm text-zinc-600">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
