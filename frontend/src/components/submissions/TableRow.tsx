import type { Project } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { EditIcon, EyeIcon, FileReviewIcon, RefreshIcon, TrashIcon } from "../ui/Icon";
import { formatUploadedAt } from "./utils";

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

  const iconClass = "review-table__file-icon-v3 review-table__file-icon-v3--default";
  
  const getStatusBadge = () => {
    const status = project.latest_status?.toUpperCase() || "PENDING";
    const error = project.latest_error_message;
    
    const baseStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: 600,
      textTransform: "uppercase",
    };

    switch (status) {
      case "COMPLETED":
      case "GRADED":
        return <span style={{ ...baseStyle, backgroundColor: "#dcfce7", color: "#166534" }}>{t("status.completed") || "Completed"}</span>;
      case "FAILED":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ ...baseStyle, backgroundColor: "#fee2e2", color: "#991b1b" }}>{t("status.failed") || "Failed"}</span>
            {error && <span style={{ fontSize: "10px", color: "#ef4444", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={error}>{error}</span>}
          </div>
        );
      case "GRADING":
        return <span style={{ ...baseStyle, backgroundColor: "#fef9c3", color: "#854d0e" }}>{t("status.grading") || "Grading..."}</span>;
      case "EXTRACTING":
        return <span style={{ ...baseStyle, backgroundColor: "#e0f2fe", color: "#075985" }}>{t("status.extracting") || "Extracting..."}</span>;
      case "PENDING":
      default:
        return <span style={{ ...baseStyle, backgroundColor: "#f1f5f9", color: "#475569" }}>{t("status.pending") || "Pending"}</span>;
    }
  };

  return (
    <tr className={isActive ? "is-active" : ""} onClick={() => onSelect(project.project_id)}>
      {showCheckbox ? (
        <td className="review-table__checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(project.project_id)}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
        </td>
      ) : null}

      <td>
        <div className="review-table__file-v3">
          <div className={iconClass}>
            <FileReviewIcon size="sm" />
          </div>
          <div className="review-table__file-info-v3">
            <strong className="review-table__file-name-v3" title={project.project_name}>
              {project.project_name}
            </strong>
            <span className="review-table__file-meta-v3">{project.project_id}</span>
            {project.project_description && (
              <span className="review-table__file-desc-v3" style={{ fontSize: "12px", color: "#64748b", display: "block", marginTop: "2px", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.project_description}
              </span>
            )}
          </div>
        </div>
      </td>

      <td>
        <span style={{ fontWeight: 500, color: "#475569" }}>
          {project.total_documents}
        </span>
      </td>

      <td>
        {getStatusBadge()}
      </td>

      <td>
        {latestScore !== null ? (
          <div className="review-table__score-v3">
            <div className="review-table__score-text-v3">
              <strong style={{ color: scoreValue >= 80 ? "#16a34a" : scoreValue >= 50 ? "#ca8a04" : "#ef4444" }}>
                {latestScore}
              </strong>
              <small>/100</small>
            </div>
            <div className="review-table__score-progress-v3">
              <div
                className="review-table__score-bar-v3"
                style={{
                  width: `${scoreValue}%`,
                  background:
                    scoreValue >= 80
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : scoreValue >= 50
                        ? "linear-gradient(90deg, #eab308, #ca8a04)"
                        : "linear-gradient(90deg, #ef4444, #dc2626)",
                }}
              />
            </div>
          </div>
        ) : (
          <span style={{ color: "#94a3b8" }}>—</span>
        )}
      </td>

      <td style={{ fontSize: "13px", color: "#64748b" }}>{formatUploadedAt(project.latest_updated_at, lang)}</td>

      <td>
        <div className="review-table__actions-v3">
          <button
            className="review-action-button-v3"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(project.project_id);
            }}
            title={t("project.reviewResult")}
          >
            <EyeIcon size="sm" />
          </button>

          <button
            className="review-action-button-v3"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(project);
            }}
            disabled={isActionPending}
            title={t("common.edit") || "Sửa"}
          >
            <EditIcon size="sm" />
          </button>

          <button
            className="review-action-button-v3"
            onClick={(event) => {
              event.stopPropagation();
              onGrade(project.project_id);
            }}
            disabled={gradingId === project.project_id || isActionPending}
            title={latestScore !== null ? t("submissions.regrade") : t("submissions.gradeAll")}
          >
            <RefreshIcon size="sm" className={gradingId === project.project_id ? "animate-spin" : ""} />
          </button>

          <button
            className="review-action-button-v3 review-action-button-v3--danger"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project.project_id);
            }}
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
