'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'live' | 'pending' | 'confirmed' | 'error' | 'default' | 'premium';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  live: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  default: 'bg-white/5 text-gray-300 border-white/10',
  premium: 'bg-bybit-yellow/10 text-bybit-yellow border-bybit-border',
};

const dotColors: Record<BadgeVariant, string> = {
  live: 'bg-red-400',
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-400',
  error: 'bg-red-400',
  default: 'bg-gray-400',
  premium: 'bg-bybit-yellow',
};

export function Badge({
  variant = 'default',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border',
        variantStyles[variant],
        className
      )}
    >
      {variant !== 'default' && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotColors[variant],
            variant === 'live' && 'animate-pulse'
          )}
        />
      )}
      {children}
    </span>
  );
}