import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { toBusinessStatus } from "../ui/businessStatus";
import { EditIcon, EyeIcon, FileReviewIcon, RefreshIcon, TrashIcon } from "../ui/Icon";
import { StatusBadge } from "../ui/States";
import { formatUploadedAt } from "./utils";
import "./TableRow.css";

interface TableRowProps {
  project: Project;
  isActive: boolean;
  isSelected: boolean;
  showCheckbox: boolean;
  gradingId: string | null;
  deletingId: string | null;
  isActionPending: boolean;
  onSelect: (projectId: string) => void;
  onToggleSelect: (projectId: string) => void;
  onGrade: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onEdit: (project: Project) => void;
}

export default function TableRow({
  project,
  isActive,
  isSelected,
  showCheckbox,
  gradingId,
  deletingId,
  isActionPending,
  onSelect,
  onToggleSelect,
  onGrade,
  onDelete,
  onEdit,
}: TableRowProps) {
  const { t, lang } = useTranslation();
  const latestScore = project.latest_score;
  const scoreValue = latestScore ?? 0;

  const renderStatus = () => {
    const status = project.latest_status?.toUpperCase() || "PENDING";
    const businessStatus = toBusinessStatus(status);

    if (status === "FAILED") {
      return (
        <div className="status-cell-stack">
          <StatusBadge tone="danger">{t("statusBiz.attentionNeeded")}</StatusBadge>
          {project.latest_error_message && (
            <span className="error-message-mini ds-text-truncate" title={project.latest_error_message}>
              {project.latest_error_message}
            </span>
          )}
        </div>
      );
    }

    if (businessStatus === "reviewReady") {
      return <StatusBadge tone="success">{t("statusBiz.reviewReady")}</StatusBadge>;
    }
    
    return <StatusBadge tone="warning">{t("statusBiz.processing")}</StatusBadge>;
  };

  const scoreColor = scoreValue >= 80 ? 'var(--ds-color-success)' : scoreValue >= 60 ? 'var(--ds-color-warning)' : 'var(--ds-color-danger)';

  return (
    <tr className={`is-clickable ${isActive ? "is-active" : ""}`} onClick={() => onSelect(project.project_id)}>
      {showCheckbox && (
        <td onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="ds-checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(project.project_id)}
          />
        </td>
      )}

      <td>
        <div className="table-row-project">
          <div className="project-icon-box">
            <FileReviewIcon size="sm" />
          </div>
          <div className="project-info-stack">
            <strong className="project-name-text ds-text-truncate" title={project.project_name}>
              {project.project_name}
            </strong>
            <span className="project-id-text">{project.project_id}</span>
          </div>
        </div>
      </td>

      <td style={{ fontWeight: 600, color: 'var(--ds-color-text-muted)' }}>
        {project.total_documents}
      </td>

      <td>
        {renderStatus()}
      </td>

      <td>
        {latestScore !== null ? (
          <div className="score-display-stack">
            <div className="score-value-row">
              <strong className="score-main-value" style={{ color: scoreColor }}>
                {latestScore}
              </strong>
              <small className="score-max-value">/100</small>
            </div>
            <div className="score-progress-track">
              <div 
                className="score-progress-bar" 
                style={{ width: `${scoreValue}%`, backgroundColor: scoreColor }} 
              />
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--ds-color-text-muted)' }}>—</span>
        )}
      </td>

      <td style={{ fontSize: '12px', color: 'var(--ds-color-text-muted)' }}>
        {formatUploadedAt(project.latest_updated_at, lang)}
      </td>

      <td>
        <div className="row-actions-group" onClick={(e) => e.stopPropagation()}>
          <button
            className="ds-button ds-button--ghost ds-button--sm"
            onClick={() => onGrade(project.project_id)}
            disabled={gradingId === project.project_id || isActionPending}
            title={t("submissions.regrade")}
          >
            <RefreshIcon size="sm" className={gradingId === project.project_id ? "animate-spin" : ""} />
          </button>
          
          <button
            className="ds-button ds-button--ghost ds-button--sm"
            onClick={() => onSelect(project.project_id)}
            title={t("submissions.viewResult")}
          >
            <EyeIcon size="sm" />
          </button>

          <button
            className="ds-button ds-button--ghost ds-button--sm"
            onClick={() => onEdit(project)}
            disabled={isActionPending}
            title={t("common.edit")}
          >
            <EditIcon size="sm" />
          </button>

          <button
            className="ds-button ds-button--ghost ds-button--sm text-danger"
            style={{ color: 'var(--ds-color-danger)' }}
            onClick={() => onDelete(project.project_id)}
            disabled={deletingId === project.project_id || isActionPending}
            title={t("common.delete")}
          >
            <TrashIcon size="sm" />
          </button>
        </div>
      </td>
    </tr>
  );
}
