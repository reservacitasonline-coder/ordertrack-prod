import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  bg?: string;
  text?: string;
  border?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  bg = 'bg-zinc-100',
  text = 'text-zinc-700',
  border = 'border-zinc-200',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${bg} ${text} ${border} ${className}`}
    >
      {children}
    </span>
  );
};
