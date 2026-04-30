import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { gradeSubmission, uploadFile } from "../api/client";
import { getActiveRubricConfig } from "../constants/gradingCriteria";
import {
  DOCUMENT_TYPE_OPTIONS,
  getDocumentTypeKey,
  type DocumentType,
} from "../constants/documentTypes";
import { useRubricList } from "../hooks/useRubrics";
import { submissionsQueryKey } from "../query";
import { useTranslation } from "./LanguageSelector";
import {
  BookOpenIcon,
  BugIcon,
  ClipboardCheckIcon,
  PlusIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
  XIcon,
} from "./ui/Icon";

const ACCEPTED_EXTENSIONS = [".pdf", ".pptx"];

function getDocumentIcon(type: DocumentType) {
  switch (type) {
    case "bug-analysis":
      return BugIcon;
    case "qa-review":
      return ShieldCheckIcon;
    case "explanation-review":
      return BookOpenIcon;
    case "project-review":
    default:
      return ClipboardCheckIcon;
  }
}

function formatFileSize(size: number | null) {
  if (!size) {
    return null;
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("project-review");
  const [selectedRubricVersion, setSelectedRubricVersion] = useState<string>("active");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [uploadedProjectId, setUploadedProjectId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { t, lang } = useTranslation();
  const rubrics = useRubricList();
  const documentRubrics = useMemo(
    () => rubrics.filter((rubric) => rubric.document_type === documentType),
    [documentType, rubrics],
  );
  const selectedActiveRubric = documentRubrics.find((rubric) => rubric.active);
  const resolvedRubricVersion =
    selectedRubricVersion === "active" ? selectedActiveRubric?.version ?? null : selectedRubricVersion;
  const selectedDocumentOption =
    DOCUMENT_TYPE_OPTIONS.find((option) => option.id === documentType) ?? DOCUMENT_TYPE_OPTIONS[0];

  useEffect(() => {
    if (
      selectedRubricVersion !== "active" &&
      !documentRubrics.some((rubric) => rubric.version === selectedRubricVersion)
    ) {
      setSelectedRubricVersion("active");
    }
  }, [documentRubrics, selectedRubricVersion]);

  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: gradeSubmission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });

  const isAcceptedFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  };

  const processFile = async (file: File) => {
    if (!isAcceptedFile(file)) {
      setMessage({
        text: t("upload.invalidType"),
        type: "error",
      });
      return;
    }

    setUploading(true);
    setMessage(null);
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    setUploadedProjectId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", lang);
      formData.append("document_type", documentType);

      const result = await uploadMutation.mutateAsync(formData);
      setUploadedProjectId(result.project_id);
      setMessage({
        text: `${result.project_id} - ${result.project_name} - ${t(getDocumentTypeKey(result.document_type ?? documentType))}`,
        type: "success",
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : t("upload.failed"),
        type: "error",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const openFilePicker = () => {
    if (!uploading && !reviewing) {
      inputRef.current?.click();
    }
  };

  const resetLocalState = () => {
    setSelectedFileName(null);
    setSelectedFileSize(null);
    setUploadedProjectId(null);
    setMessage(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleReviewUploadedFile = async () => {
    if (!uploadedProjectId) {
      return;
    }

    setReviewing(true);
    setMessage(null);

    try {
      const result = await reviewMutation.mutateAsync({
        projectId: uploadedProjectId,
        force: true,
        rubricVersion: resolvedRubricVersion,
      });
      setMessage({
        text: `${result.project_id} - ${result.project_name} - ${t("upload.overallScore")}: ${result.score}/100`,
        type: "success",
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : t("submissions.gradingFailed"),
        type: "error",
      });
    } finally {
      setReviewing(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await processFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!uploading && !reviewing) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setDragActive(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);

    if (uploading || reviewing) {
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) {
      return;
    }
    if (files.length > 1) {
      setMessage({
        text: t("upload.multipleFiles"),
        type: "error",
      });
      return;
    }

    await processFile(files[0]);
  };

  return (
    <div className="upload-page">
      <div className="upload-progress">
        <div className="upload-progress__step is-active">
          <span className="upload-progress__dot">1</span>
          <span>{t("upload.documentType")}</span>
        </div>
        <span className="upload-progress__line" />
        <div className="upload-progress__step">
          <span className="upload-progress__dot">2</span>
          <span>{t("upload.stepUpload")}</span>
        </div>
        <span className="upload-progress__line" />
        <div className="upload-progress__step">
          <span className="upload-progress__dot">3</span>
          <span>{t("upload.stepExecute")}</span>
        </div>
      </div>

      <div className="upload-stage">
        <div className="upload-stage__header">
          <h3>1. {t("upload.documentType")}</h3>
          <p>{t("upload.documentTypeHint")}</p>
        </div>

        <div className="upload-type-grid">
          {DOCUMENT_TYPE_OPTIONS.map((option) => {
            const Icon = getDocumentIcon(option.id);
            const isActive = option.id === documentType;
            const criteriaConfig = getActiveRubricConfig(rubrics, option.id, lang);
            const criteriaPreview = criteriaConfig.order.map((criterionKey) => {
              const label = t(`upload.criteria.${criterionKey}`);
              const maxScore = criteriaConfig.maxScores[criterionKey];
              return maxScore ? `${label} /${maxScore}` : label;
            });
            return (
              <button
                key={option.id}
                type="button"
                className={`upload-type-card ${isActive ? "is-active" : ""}`.trim()}
                onClick={() => setDocumentType(option.id)}
                disabled={uploading || reviewing}
              >
                <div className="upload-type-card__top">
                  <span className="upload-type-card__icon">
                    <Icon size="md" />
                  </span>
                  {isActive ? <span className="upload-type-card__selected" aria-hidden="true" /> : null}
                </div>
                <strong>{t(option.labelKey)}</strong>
                <p>{t(option.descKey)}</p>
                <ul className="upload-type-card__criteria">
                  {criteriaPreview.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      <div className="upload-stage">
        <div className="upload-stage__header">
          <h3>2. {t("upload.fileSectionTitle")}</h3>
        </div>

        <div className="upload-file-layout">
          <div className="upload-file-layout__main">
            <div className="upload-file-layout__summary">
              <div className="upload-file-layout__summary-item">
                <span>{t("upload.documentType")}</span>
                <strong>{t(selectedDocumentOption.labelKey)}</strong>
              </div>
              <div className="upload-file-layout__summary-item">
                <span>{t("upload.rubricVersionLabel")}</span>
                <strong>{resolvedRubricVersion ?? "—"}</strong>
              </div>
              <div className="upload-file-layout__summary-item">
                <span>{t("common.language")}</span>
                <strong>{lang.toUpperCase()}</strong>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.pptx"
              id="pdf-upload"
              onChange={handleFileChange}
              disabled={uploading || reviewing}
              hidden
            />

            <label
              htmlFor="pdf-upload"
              className={`upload-dropzone upload-dropzone--refined ${uploading || reviewing ? "is-disabled" : ""} ${
                dragActive ? "is-drag-active" : ""
              }`.trim()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(event) => {
                void handleDrop(event);
              }}
            >
              <span className="upload-dropzone__icon">
                <UploadCloudIcon size="lg" />
              </span>
              <span className="upload-dropzone__content">
                <span className="upload-dropzone__title">{dragActive ? t("upload.dropzoneActive") : t("upload.dropzoneText")}</span>
                <span className="upload-dropzone__link">{t("upload.selectFile")}</span>
                <span className="upload-dropzone__hint">{t("upload.dropzoneHint")}</span>
              </span>
            </label>

            {selectedFileName ? (
              <div className="upload-file-row">
                <div className="upload-file-row__meta">
                  <strong>{selectedFileName}</strong>
                  <span>
                    {formatFileSize(selectedFileSize) ?? t(getDocumentTypeKey(documentType))}
                    {uploadedProjectId ? ` · ${uploadedProjectId}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="upload-file-row__remove"
                  onClick={resetLocalState}
                  disabled={uploading || reviewing}
                  aria-label={t("common.cancel")}
                >
                  <XIcon size="sm" />
                </button>
              </div>
            ) : null}

            <div className="upload-footer">
              <button
                type="button"
                className="btn-secondary btn-secondary--compact"
                onClick={openFilePicker}
                disabled={uploading || reviewing}
              >
                <PlusIcon size="sm" />
                {t("upload.selectFile")}
              </button>

              <div className="upload-footer__actions">
                <button
                  type="button"
                  className="btn-secondary btn-secondary--compact"
                  onClick={resetLocalState}
                  disabled={uploading || reviewing}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact"
                  onClick={() => {
                    void handleReviewUploadedFile();
                  }}
                  disabled={!uploadedProjectId || uploading || reviewing}
                >
                  {reviewing ? t("submissions.grading") : t("submissions.gradeAll")}
                </button>
              </div>
            </div>

            {message ? <div className={`upload-message upload-message--${message.type}`}>{message.text}</div> : null}
          </div>

          <aside className="upload-options-card">
            <h4>{t("upload.processingOptions")}</h4>
            <div className="upload-options-card__fields">
              <label>
                <span>{t("upload.rubricVersionLabel")}</span>
                <select
                  className="upload-options-card__select"
                  value={selectedRubricVersion}
                  onChange={(event) => setSelectedRubricVersion(event.target.value)}
                  disabled={uploading || reviewing}
                >
                  <option value="active">
                    {t("upload.activeVersionLabel")}
                    {selectedActiveRubric?.version ? ` (${selectedActiveRubric.version})` : ""}
                  </option>
                  {documentRubrics.filter((rubric) => !rubric.active).map((rubric) => (
                    <option key={`${rubric.document_type}-${rubric.version}`} value={rubric.version}>
                      {rubric.version}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="upload-options-card__summary">
              <div>
                <span>{t("upload.documentType")}</span>
                <strong>{t(selectedDocumentOption.labelKey)}</strong>
              </div>
              <div>
                <span>{t("upload.rubricVersionLabel")}</span>
                <strong>{resolvedRubricVersion ?? "—"}</strong>
              </div>
              <div>
                <span>{t("common.language")}</span>
                <strong>{lang.toUpperCase()}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
