import type { DocStatus } from '../types';

const STATUS_ICONS: Record<DocStatus, string> = {
  missing: '✗',
  expiry_needed: '⏰',
  expired: '⚠',
  not_provided: '○',
  ok: '✓',
};

interface StatusBadgeProps {
  status: DocStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`status-badge status-badge--${status}`}
      role="status"
      aria-label={`Status: ${label}`}
    >
      <span aria-hidden="true">{STATUS_ICONS[status]}</span>
      {label}
    </span>
  );
}
