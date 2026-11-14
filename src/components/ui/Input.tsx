'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export function Input({
  label,
  error,
  icon,
  showPasswordToggle = false,
  className,
  type,
  id,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = showPasswordToggle
    ? showPassword ? 'text' : 'password'
    : type;

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-gray-300 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          id={id}
          type={inputType}
          className={cn(
            'w-full px-4 py-3 rounded-xl bg-uzu-900/80 border text-white text-sm transition-all outline-none',
            'focus:border-bybit-yellow focus:ring-2 focus:ring-bybit-yellow/20',
            error ? 'border-red-500' : 'border-bybit-border',
            icon && 'pl-10',
            showPasswordToggle && 'pr-10',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-400 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}