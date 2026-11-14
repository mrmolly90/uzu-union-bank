'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  primary:
    'bg-bybit-yellow text-bybit-bg font-bold shadow-bybit-glow hover:bg-bybit-yellowHover hover:shadow-[0_0_30px_rgba(247,166,0,0.35)]',
  'primary-dark':
    'bg-bybit-surface border border-bybit-border text-bybit-yellow hover:bg-bybit-elevated hover:border-bybit-yellow/50',
  secondary:
    'bg-bybit-surface border border-bybit-border text-gray-200 hover:border-bybit-yellow/50 hover:text-bybit-yellow',
  ghost:
    'bg-transparent text-gray-400 hover:text-bybit-yellow hover:bg-white/5',
  danger:
    'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20 hover:brightness-110',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-4 text-base',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-bybit-yellow disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-bybit-bg/30 border-t-bybit-bg rounded-full animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}