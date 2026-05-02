import { getDocumentTypeKey } from "../../constants/documentTypes";
import type { Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import { EyeIcon, FileReviewIcon, RefreshIcon, TrashIcon } from "../ui/Icon";
import { formatUploadedAt, getLanguageLabel } from "./utils";

interface TableRowProps {
  submission: Submission;
  isActive: boolean;
  isSelected: boolean;
  showCheckbox: boolean;
  isReferenceVariant: boolean;
  gradingId: string | null;
  deletingId: string | null;
  isActionPending: boolean;
  onSelect: (projectId: string) => void;
  onToggleSelect: (projectId: string) => void;
  onGrade: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export default function TableRow({
  submission,
  isActive,
  isSelected,
  showCheckbox,
  isReferenceVariant,
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
  const scoreValue = latestScore ?? 0;

  const statusClass = 
    latestScore !== null ? "review-badge-v3--completed" : "review-badge-v3--pending";
  const statusLabel = latestScore !== null ? t("project.completed") : t("project.pending");
  
  const extension = getFileExtension(submission.filename);
  const iconClass = `review-table__file-icon-v3 review-table__file-icon-v3--${
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension) 
      ? extension.substring(0, 3) 
      : 'default'
  }`;

  if (!isReferenceVariant) {
    // Original layout for other variants if needed, but let's just return a standard V3 row for now 
    // unless it's the dashboard variant.
  }

  return (
    <tr className={isActive ? "is-active" : ""} onClick={() => onSelect(submission.project_id)}>
      {showCheckbox ? (
        <td className="review-table__checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(submission.project_id)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </td>
      ) : null}
      
      <td>
        <div className="review-table__file-v3">
          <div className={iconClass}>
            <FileReviewIcon size="sm" />
          </div>
          <div className="review-table__file-info-v3">
            <strong className="review-table__file-name-v3" title={submission.filename}>
              {submission.filename}
            </strong>
            <span className="review-table__file-meta-v3" title={submission.project_name || submission.project_id}>
              {submission.project_id}
            </span>
          </div>
        </div>
      </td>

      <td>
        <span className="review-badge-v3 review-badge-v3--type">
          {t(getDocumentTypeKey(submission.document_type))}
        </span>
      </td>

      <td>
        <span style={{ fontWeight: 500, color: '#475569' }}>
          {getLanguageLabel(submission, lang)}
        </span>
      </td>

      <td>
        <span className={`review-badge-v3 ${statusClass}`}>
          {statusLabel}
        </span>
      </td>

      <td>
        {latestScore !== null ? (
          <div className="review-table__score-v3">
            <div className="review-table__score-text-v3">
              <strong style={{ color: scoreValue >= 80 ? '#16a34a' : scoreValue >= 50 ? '#ca8a04' : '#ef4444' }}>
                {latestScore}
              </strong>
              <small>/100</small>
            </div>
            <div className="review-table__score-progress-v3">
              <div 
                className="review-table__score-bar-v3" 
                style={{ 
                  width: `${scoreValue}%`,
                  background: scoreValue >= 80 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 
                              scoreValue >= 50 ? 'linear-gradient(90deg, #eab308, #ca8a04)' : 
                                               'linear-gradient(90deg, #ef4444, #dc2626)'
                }} 
              />
            </div>
          </div>
        ) : (
          <span style={{ color: '#94a3b8' }}>—</span>
        )}
      </td>

      <td style={{ fontSize: '13px', color: '#64748b' }}>
        {formatUploadedAt(submission.uploaded_at, lang)}
      </td>

      <td>
        <div className="review-table__actions-v3">
          <button
            className="review-action-button-v3"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(submission.project_id);
            }}
            title={t("project.reviewResult")}
          >
            <EyeIcon size="sm" />
          </button>
          
          <button
            className="review-action-button-v3"
            onClick={(event) => {
              event.stopPropagation();
              onGrade(submission.project_id);
            }}
            disabled={gradingId === submission.project_id || isActionPending}
            title={latestScore !== null ? t("submissions.regrade") : t("submissions.gradeAll")}
          >
            <RefreshIcon size="sm" className={gradingId === submission.project_id ? "animate-spin" : ""} />
          </button>

          <button
            className="review-action-button-v3 review-action-button-v3--danger"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(submission.project_id);
            }}
            disabled={deletingId === submission.project_id || isActionPending}
            title={t("common.delete")}
          >
            <TrashIcon size="sm" />
          </button>
        </div>
      </td>
    </tr>
  );
}
