import { getDocumentTypeKey } from "../../constants/documentTypes";
import type { Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import Badge from "../ui/Badge";
import { EyeIcon, MoreHorizontalIcon, RefreshIcon, TrashIcon } from "../ui/Icon";
import { formatUploadedAt, getLanguageLabel } from "./utils";

interface TableRowProps {
  submission: Submission;
  isActive: boolean;
  isSelected: boolean;
  showCheckbox: boolean;
  isDashboardVariant: boolean;
  gradingId: string | null;
  deletingId: string | null;
  isActionPending: boolean;
  onSelect: (projectId: string) => void;
  onToggleSelect: (projectId: string) => void;
  onGrade: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

export default function TableRow({
  submission,
  isActive,
  isSelected,
  showCheckbox,
  isDashboardVariant,
  gradingId,
  deletingId,
  isActionPending,
  onSelect,
  onToggleSelect,
  onGrade,
  onDelete,
}: TableRowProps) {
  const { t, lang } = useTranslation();
  const latestScore = submission.latest_run?.score ?? null;

  const statusTone = latestScore !== null ? "success" : "warning";
  const statusLabel = latestScore !== null ? t("project.completed") : t("project.pending");
  const gradeActionLabel =
    gradingId === submission.project_id
      ? t("submissions.grading")
      : latestScore !== null
        ? t("submissions.regrade")
        : t("submissions.gradeAll");
  const deleteActionLabel = deletingId === submission.project_id ? t("common.deleting") : t("common.delete");

  return (
    <tr className={isActive ? "is-active" : ""} onClick={() => onSelect(submission.project_id)}>
      {showCheckbox ? (
        <td className="review-table__checkbox">
          <span className="review-table__checkbox-inner">
            <input
              type="checkbox"
              checked={isSelected}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                event.stopPropagation();
                onToggleSelect(submission.project_id);
              }}
            />
          </span>
        </td>
      ) : null}
      <td>
        <div className="review-table__file">
          <strong>{submission.filename}</strong>
          <span>{submission.project_id} · {submission.project_name}</span>
        </div>
      </td>
      <td>
        <Badge>{t(getDocumentTypeKey(submission.document_type))}</Badge>
      </td>
      <td>
        <span className="review-table__language">{getLanguageLabel(submission, lang)}</span>
      </td>
      <td>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </td>
      <td>
        {latestScore !== null ? (
          <span className="review-table__score">
            {latestScore}
            <small>/100</small>
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>{formatUploadedAt(submission.uploaded_at, lang)}</td>
      <td>
        <div className={`review-table__actions ${isDashboardVariant ? "review-table__actions--icon" : ""}`.trim()}>
          {isDashboardVariant ? (
            <>
              <button
                className="review-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(submission.project_id);
                }}
                aria-label={t("project.reviewResult")}
              >
                <EyeIcon size="sm" />
              </button>
              <button
                className="review-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                aria-label={t("common.actions")}
              >
                <MoreHorizontalIcon size="sm" />
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary btn-secondary--compact review-table__row-action review-table__row-action--primary"
                onClick={(event) => {
                  event.stopPropagation();
                  onGrade(submission.project_id);
                }}
                disabled={gradingId === submission.project_id || isActionPending}
                aria-label={gradeActionLabel}
                title={gradeActionLabel}
              >
                <RefreshIcon size="sm" />
                <span>{gradeActionLabel}</span>
              </button>
              <button
                className="btn-danger-soft btn-danger-soft--compact review-table__row-action"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(submission.project_id);
                }}
                disabled={deletingId === submission.project_id || isActionPending}
                aria-label={deleteActionLabel}
                title={deleteActionLabel}
              >
                <TrashIcon size="sm" />
                <span>{deleteActionLabel}</span>
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
