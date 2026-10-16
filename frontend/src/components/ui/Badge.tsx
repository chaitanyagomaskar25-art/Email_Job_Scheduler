import React from 'react';
import { EmailStatus } from '../../types';

interface BadgeProps {
  status: EmailStatus | string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'SENT':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
      case 'SCHEDULED':
        return 'bg-blue-50 text-blue-700 ring-blue-600/20';
      case 'PROCESSING':
        return 'bg-amber-50 text-amber-700 ring-amber-600/20 animate-pulse';
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 ring-rose-600/20';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-600 ring-slate-500/20';
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-600/20';
    }
  };

  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ring-1 ring-inset ${getStyle()} ${sizeClass}`}
    >
      {normalized}
    </span>
  );
};

