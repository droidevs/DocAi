import { CheckCircle, RotateCw, Clock, XCircle, RefreshCw } from 'lucide-react';
import type { DocumentStatus } from './types';

const CONFIG: Record<
  DocumentStatus,
  { bg: string; color: string; icon: React.ReactNode; label: string; spin?: boolean }
> = {
  COMPLETED: {
    bg: '#d1e7dd',
    color: '#0f5132',
    icon: <CheckCircle size={11} />,
    label: 'COMPLETED',
  },
  PROCESSING: {
    bg: '#fff3cd',
    color: '#664d03',
    icon: <RotateCw size={11} />,
    label: 'PROCESSING',
    spin: true,
  },
  PENDING: {
    bg: '#e2e3e5',
    color: '#41464b',
    icon: <Clock size={11} />,
    label: 'PENDING',
  },
  FAILED: {
    bg: '#f8d7da',
    color: '#842029',
    icon: <XCircle size={11} />,
    label: 'FAILED',
  },
  REPROCESSING: {
    bg: '#cff4fc',
    color: '#055160',
    icon: <RefreshCw size={11} />,
    label: 'REPROCESSING',
    spin: true,
  },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const cfg = CONFIG[status];
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        borderRadius: 6,
        padding: '3px 8px',
        fontSize: '0.72rem',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={cfg.spin ? { animation: 'spin 1s linear infinite', display: 'flex' } : {}}>
        {cfg.icon}
      </span>
      {cfg.label}
    </span>
  );
}
