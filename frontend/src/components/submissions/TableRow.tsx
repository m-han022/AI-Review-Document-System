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
          {project.total_documents} {t("project.documents") || "Tài liệu"}
        </span>
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
