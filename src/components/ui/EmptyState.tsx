import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-200 rounded-xl bg-white/50 backdrop-blur-3xl min-h-[300px]">
      <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 mb-4">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.2411.17.003-11.836 0 00-2.007-1.24l-.885-1.77a2.25 2.25 0 00-2.007-1.24H3.75" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m16.5 0v-2.25A2.25 2.25 0 0018 3H6a2.25 2.25 0 00-2.25 2.25V7.5m16.5 0l-1.378-4.135A2.25 2.25 0 0016.993 2H7.007a2.25 2.25 0 00-2.13 1.365L3.75 7.5" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 max-w-xs mb-5">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
