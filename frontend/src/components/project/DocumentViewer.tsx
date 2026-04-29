import { getSubmissionFileUrl } from "../../api/client";
import type { Submission } from "../../types";
import { useTranslation } from "../LanguageSelector";
import SectionBlock from "../ui/SectionBlock";
import { DownloadIcon, EyeIcon, FileReviewIcon } from "../ui/Icon";

interface DocumentViewerProps {
  submission: Submission;
}

function getFileExtension(filename: string) {
  return filename.split(".").pop()?.toUpperCase() ?? "FILE";
}

export default function DocumentViewer({ submission }: DocumentViewerProps) {
  const { t } = useTranslation();
  const extension = getFileExtension(submission.filename);
  const fileUrl = getSubmissionFileUrl(submission.project_id);
  const downloadUrl = getSubmissionFileUrl(submission.project_id, "attachment");
  const isPdf = submission.filename.toLowerCase().endsWith(".pdf");
  const isPptx = submission.filename.toLowerCase().endsWith(".pptx");

  return (
    <SectionBlock className="document-viewer">
      <SectionBlock.Header
        title={t("project.documentViewer.title")}
        subtitle={submission.filename}
        aside={<span className="document-type-pill">{extension}</span>}
      />
      <SectionBlock.Body className="document-viewer__body">
        {isPdf ? (
          <div className="document-viewer__frame-shell" aria-label={t("project.documentViewer.pdfTitle")}>
            <iframe className="document-viewer__frame" src={fileUrl} title={submission.filename} />
          </div>
        ) : (
          <div className="document-viewer__fallback">
            <span className="document-viewer__fallback-icon">
              <FileReviewIcon size="lg" />
            </span>
            <strong>{isPptx ? t("project.documentViewer.pptxTitle") : t("project.documentViewer.unavailableTitle")}</strong>
            <p>{isPptx ? t("project.documentViewer.pptxDescription") : t("project.documentViewer.unavailableDescription")}</p>
          </div>
        )}

        <div className="document-viewer__actions">
          <a className="btn-secondary btn-secondary--compact" href={fileUrl} target="_blank" rel="noreferrer">
            <EyeIcon size="sm" />
            {t("project.documentViewer.openNewTab")}
          </a>
          <a className="btn-primary btn-primary--compact" href={downloadUrl}>
            <DownloadIcon size="sm" />
            {t("project.documentViewer.download")}
          </a>
        </div>
      </SectionBlock.Body>
    </SectionBlock>
  );
}
