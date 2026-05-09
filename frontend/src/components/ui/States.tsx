import type { ReactNode } from "react";
import "./States.css";

import {
  AlertTriangleIcon,
  FileReviewIcon,
  PackageIcon,
  RefreshIcon,
  ShieldCheckIcon,
  UploadIcon,
  XIcon,
} from "./Icon";

type StateTone = "default" | "success" | "warning" | "danger" | "primary";

interface StatePanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: StateTone;
  compact?: boolean;
  icon?: ReactNode;
}

function StatePanel({ title, description, action, tone = "default", compact = false, icon }: StatePanelProps) {
  return (
    <div className={`ui-state ui-state--${tone} ${compact ? "ui-state--compact" : ""}`.trim()}>
      <span className="ui-state__icon" aria-hidden="true">
        {icon ? icon : (
          tone === "danger" ? (
            <AlertTriangleIcon size="md" />
          ) : tone === "success" ? (
            <ShieldCheckIcon size="md" />
          ) : tone === "warning" ? (
            <AlertTriangleIcon size="md" />
          ) : (
            <FileReviewIcon size="md" />
          )
        )}
      </span>
      <div className="ui-state__copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-state__action">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StatePanelProps) {
  return <StatePanel {...props} icon={props.icon || <PackageIcon size="md" style={{ opacity: 0.4, border: '2px dashed currentColor', borderRadius: '8px', padding: '8px' }} />} />;
}

export function LoadingState({ title, description }: Pick<StatePanelProps, "title" | "description">) {
  return (
    <div className="ui-state ui-state--primary">
      <span className="ui-state__icon ui-state__icon--spin" aria-hidden="true">
        <RefreshIcon size="md" />
      </span>
      <div className="ui-state__copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 4, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="ui-skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="ui-skeleton-table__row"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, colIdx) => (
            <span key={`cell-${rowIdx}-${colIdx}`} className="ui-skeleton-table__cell ds-skeleton" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState(props: StatePanelProps) {
  return <StatePanel {...props} tone="danger" />;
}

export function SuccessState(props: StatePanelProps) {
  return <StatePanel {...props} tone="success" />;
}

interface FilePreviewProps {
  filename: string;
  sizeLabel?: string | null;
  statusLabel?: string;
  replaceLabel?: string;
  onReplace?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export function FilePreview({
  filename,
  sizeLabel,
  statusLabel,
  replaceLabel = "Thay file",
  onReplace,
  onRemove,
  disabled = false,
}: FilePreviewProps) {
  return (
    <div className="ui-file-preview">
      <span className="ui-file-preview__icon" aria-hidden="true">
        <UploadIcon size="md" />
      </span>
      <div className="ui-file-preview__copy">
        <strong title={filename}>{filename}</strong>
        <span>
          {[sizeLabel, statusLabel].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="ui-file-preview__actions">
        {onReplace ? (
          <button type="button" onClick={onReplace} disabled={disabled}>
            {replaceLabel}
          </button>
        ) : null}
        {onRemove ? (
          <button type="button" onClick={onRemove} disabled={disabled} aria-label="Xoa file">
            <XIcon size="sm" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onClear?: () => void;
}

export function FilterChip({ label, onClear }: FilterChipProps) {
  return (
    <span className="ui-filter-chip">
      {label}
      {onClear ? (
        <button type="button" onClick={onClear} aria-label="Clear filter">
          <XIcon size="sm" />
        </button>
      ) : null}
    </span>
  );
}

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="ui-tooltip">
      {children}
      <span className="ui-tooltip__content" role="tooltip">
        {content}
      </span>
    </span>
  );
}

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StateTone | "muted";
  className?: string;
}

export function StatusBadge({ children, tone = "muted", className = "" }: StatusBadgeProps) {
  return <span className={`ui-status-badge ui-status-badge--${tone} ${className}`}>{children}</span>;
}
