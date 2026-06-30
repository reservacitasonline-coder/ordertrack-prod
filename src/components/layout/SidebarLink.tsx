'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

export const SidebarLink: React.FC<SidebarLinkProps> = ({ href, icon, label }) => {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-teal-600/10 text-teal-400 border border-teal-500/20'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
      }`}
    >
      <span className={isActive ? 'text-teal-400' : 'text-zinc-500 group-hover:text-zinc-300'}>{icon}</span>
      {label}
    </Link>
  );
};
