import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { toBusinessStatus } from "../ui/businessStatus";
import { AlertCircleIcon, CheckCircleIcon, DownloadIcon, EditIcon, EyeIcon, FileReviewIcon, RefreshIcon, TrashIcon } from "../ui/Icon";
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
  onExportReport: (projectId: string) => void;
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
  onExportReport,
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
          <StatusBadge tone="danger" icon={<AlertCircleIcon size="xs" />}>
            {t("statusBiz.attentionNeeded")}
          </StatusBadge>
          {project.latest_error_message && (
            <span className="error-message-mini ds-text-truncate" title={project.latest_error_message}>
              {project.latest_error_message}
            </span>
          )}
        </div>
      );
    }

    if (businessStatus === "reviewReady") {
      return (
        <StatusBadge tone="success" icon={<CheckCircleIcon size="xs" />}>
          {t("statusBiz.reviewReady")}
        </StatusBadge>
      );
    }

    return (
      <StatusBadge tone="warning" icon={<RefreshIcon size="xs" className="animate-spin" />}>
        {t("statusBiz.processing")}
      </StatusBadge>
    );
  };

  const scoreColor = scoreValue >= 80 ? "var(--ds-color-success)" : scoreValue >= 60 ? "var(--ds-color-warning)" : "var(--ds-color-danger)";

  return (
    <tr className={`ds-table-row-v4 ${isActive ? "is-active" : ""}`} onClick={() => onSelect(project.project_id)}>
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
        <div className="table-row-project-v4">
          <div className={`project-icon-box-v4 ${latestScore !== null ? "has-score" : ""}`}>
            <FileReviewIcon size="sm" />
          </div>
          <div className="project-info-stack-v4">
            <strong className="project-name-v4 ds-text-truncate" title={project.project_name}>
              {project.project_name}
            </strong>
            <code className="project-id-v4">{project.project_id}</code>
          </div>
        </div>
      </td>

      <td className="table-cell-centered-v4">
        <span className="doc-count-badge-v4">{project.total_documents}</span>
      </td>

      <td>{renderStatus()}</td>

      <td>
        {latestScore !== null ? (
          <div className="score-widget-v4">
            <div className="score-numbers-v4">
              <span className="score-value-v4" style={{ color: scoreColor }}>{Math.round(latestScore)}</span>
              <span className="score-max-v4">/100</span>
            </div>
            <div className="score-bar-v4">
              <div className="score-bar-fill-v4" style={{ width: `${scoreValue}%`, backgroundColor: scoreColor }} />
            </div>
          </div>
        ) : (
          <span className="text-placeholder-v4">—</span>
        )}
      </td>

      <td className="table-cell-date-v4">{formatUploadedAt(project.latest_updated_at, lang)}</td>

      <td>
        <div className="row-actions-v4" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="action-btn-v4 primary"
            onClick={() => onSelect(project.project_id)}
            title={t("common.tooltips.view")}
            data-tooltip={t("common.tooltips.view")}
          >
            <EyeIcon size="sm" />
          </button>

          <button
            type="button"
            className="action-btn-v4"
            style={{ color: 'var(--ds-color-primary)' }}
            onClick={() => onGrade(project.project_id)}
            disabled={gradingId === project.project_id || isActionPending}
            title={t("common.tooltips.grade")}
            data-tooltip={t("common.tooltips.grade")}
          >
            {gradingId === project.project_id ? (
              <RefreshIcon size="sm" className="animate-spin" />
            ) : (
              <FileReviewIcon size="sm" />
            )}
          </button>

          <button
            type="button"
            className="action-btn-v4"
            onClick={() => onEdit(project)}
            disabled={isActionPending}
            title={t("common.tooltips.edit")}
            data-tooltip={t("common.tooltips.edit")}
          >
            <EditIcon size="sm" />
          </button>

          <button
            type="button"
            className="action-btn-v4 danger"
            onClick={() => onDelete(project.project_id)}
            disabled={deletingId === project.project_id || isActionPending}
            title={t("common.tooltips.delete")}
            data-tooltip={t("common.tooltips.delete")}
          >
            <TrashIcon size="sm" />
          </button>
        </div>
      </td>
    </tr>
  );
}

