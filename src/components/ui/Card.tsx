import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white border border-zinc-200/80 rounded-xl p-5 shadow-xs shadow-zinc-100 backdrop-blur-xs transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
