import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  gradeSubmission,
  uploadFile,
  listProjects,
  listProjectDocuments,
  listDocumentVersions,
} from "../api/client";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../constants/documentTypes";
import { DOCUMENT_CARD_COPY, UPLOAD_COPY } from "../constants/uploadCopy";
import { mapErrorCodeToI18nKey } from "../locales/errorMapping";
import { toHumanErrorMessage } from "../utils/humanizeError";
import { projectsQueryKey } from "../query";
import type { GradeResponse } from "../types";
import { useTranslation } from "./LanguageSelector";
import ProjectCreateDialog from "./project/ProjectCreateDialog";
import ConfirmDialog from "./ui/ConfirmDialog";
import {
  BookOpenIcon,
  BugIcon,
  ClipboardCheckIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
  PlusIcon,
} from "./ui/Icon";

import { FieldError, StatusBadge } from "./ui/States";
import { Button, Card, Input, Select } from "./ui";
import "./FileUpload.css";

const ACCEPTED_EXTENSIONS = [".pdf", ".pptx", ".txt", ".xlsx", ".png", ".jpg", ".jpeg"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PROJECT_FILENAME_PATTERN = /^(P\d+)[_-](.+?)\.(pdf|pptx|txt|xlsx|png|jpg|jpeg)$/i;

interface FileUploadProps {
  onReviewComplete?: (projectId: string) => void;
}

type UploadState = "idle" | "uploading" | "uploaded" | "error";
type ProcessingStep = "read" | "extract" | "grade" | "recommend";

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
  if (!size) return null;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function resolveUploadMetadata(file: File) {
  const match = PROJECT_FILENAME_PATTERN.exec(file.name);
  const stem = file.name.replace(/\.[^.]+$/, "");
  const normalizedName = match ? match[2].replace(/[_-]/g, " ").trim() : stem;

  return {
    projectId: match?.[1]?.toUpperCase() ?? "",
    projectName: normalizedName || stem,
    documentName: normalizedName || stem,
  };
}

function mapReviewErrorByCode(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string
): { kind: "config" | "runtime"; text: string } {
  if (error instanceof ApiClientError) {
    const key = mapErrorCodeToI18nKey(error.code);
    if (
      error.code === "EVALUATION_SET_REQUIRED" ||
      error.code === "EVALUATION_SET_INVALID" ||
      error.code === "EVALUATION_SET_INACTIVE" ||
      error.code === "EVALUATION_SET_SCOPE_MISMATCH"
    ) {
      return { kind: "config", text: t(key) };
    }
    if (error.code === "REQUEST_TIMEOUT") {
      return { kind: "runtime", text: `${t(key)} (${error.message})` };
    }
    const suffix = error.detail && error.detail !== "Internal Server Error" ? `: ${error.detail}` : "";
    return { kind: "runtime", text: `${t(key)}${suffix}` };
  }
  return { kind: "runtime", text: t("api.unexpectedError") };
}

export default function FileUpload({ onReviewComplete }: FileUploadProps) {
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedProjectId, setUploadedProjectId] = useState<string | null>(null);
  const [uploadedVersionId, setUploadedVersionId] = useState<number | null>(null);
  const [uploadedProjectName, setUploadedProjectName] = useState<string | null>(null);
  const [projectDescription, setProjectDescription] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [forceRegrade, setForceRegrade] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("read");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [, setReviewErrorKind] = useState<"config" | "runtime" | null>(null);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [selectedExistingProjectId, setSelectedExistingProjectId] = useState<string | null>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [pendingDuplicateFile, setPendingDuplicateFile] = useState<File | null>(null);
  const [projectFieldPulse, setProjectFieldPulse] = useState(false);
  const [reviewDone, setReviewDone] = useState<{ projectId: string; score: number | null | undefined; isPending: boolean } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    project?: string;
    file?: string;
    rubric?: string;
  }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { lang, t } = useTranslation();
  const copy = UPLOAD_COPY[lang] ?? UPLOAD_COPY.vi;
  const reviewingMessage = copy.reviewingMessage;

  const canStartReview = Boolean(
    documentType &&
      uploadedProjectId &&
      uploadState === "uploaded" &&
      !reviewing
  );
  


  useEffect(() => {
    if (!reviewing) return;

    const steps: ProcessingStep[] = ["read", "extract", "grade", "recommend"];
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, steps.length - 1);
      setProcessingStep(steps[index] ?? "recommend");
    }, 900);

    return () => window.clearInterval(timer);
  }, [reviewing]);

  const uploadMutation = useMutation({
    mutationFn: uploadFile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: gradeSubmission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });

  const { data: projectsData } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => listProjects(),
  });
  const projects = Array.isArray(projectsData) ? projectsData : [];

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const resetFile = () => {
    setSelectedFile(null);
    setUploadedProjectId(null);
    setUploadedProjectName(null);
    setUploadState("idle");
    setUploadProgress(0);
    setMessage(null);
    setReviewErrorKind(null);
    setFieldErrors({});
    setReviewDone(null);
    resetInput();
  };

  const openFilePicker = () => {
    if (!reviewing && uploadState !== "uploading") {
      inputRef.current?.click();
    }
  };

  const uploadSelectedFile = async (file: File, skipDuplicateCheck: boolean = false) => {
    setFieldErrors({});
    if (!documentType) {
      setMessage({ text: copy.disabledHelper, type: "error" });
      return;
    }

    if (!isAcceptedFile(file)) {
      setSelectedFile(file);
      setUploadState("error");
      setFieldErrors({ file: copy.invalidType });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(file);
      setUploadState("error");
      setFieldErrors({ file: copy.tooLarge });
      return;
    }

    setSelectedFile(file);
    setUploadedProjectId(null);
    setUploadedProjectName(null);
    setMessage(null);

    if (!selectedExistingProjectId) {
      setUploadState("error");
      setFieldErrors({ project: copy.projectRequired });
      return;
    }

    const uploadMetadata = resolveUploadMetadata(file);
    if (!skipDuplicateCheck) {
      try {
        const docs = await listProjectDocuments(selectedExistingProjectId);
        const matchedDoc = docs.find(
          (d) =>
            d.document_type === documentType &&
            d.document_name.trim().toLowerCase() === uploadMetadata.documentName.trim().toLowerCase(),
        );
        if (matchedDoc) {
          const versions = await listDocumentVersions(matchedDoc.document_id);
          const latestVersion = versions.find((v) => v.is_latest) ?? versions[0];
          if (latestVersion?.binary_hash) {
            const newFileHash = await sha256Hex(file);
            if (newFileHash === latestVersion.binary_hash) {
              setPendingDuplicateFile(file);
              setShowDuplicateConfirm(true);
              setUploadState("idle");
              return;
            }
          }
        }
      } catch {
        // Non-blocking UX check
      }
    }

    setUploadState("uploading");
    setUploadProgress(8);

    const timer = window.setInterval(() => {
      setUploadProgress((current) => Math.min(92, current + 14));
    }, 220);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", lang);

      formData.append("project_id", selectedExistingProjectId);
      formData.append("project_name", uploadMetadata.projectName);
      formData.append("document_type", documentType);
      formData.append("document_name", uploadMetadata.documentName);
      if (projectDescription) {
        formData.append("project_description", projectDescription);
      }

      const result = await uploadMutation.mutateAsync(formData);
      setUploadProgress(100);
      setUploadedProjectId(result.project_id);
      setUploadedVersionId(result.document_version_id);
      setUploadedProjectName(result.project_name);
      setUploadState("uploaded");
      setMessage({ text: `${copy.uploaded}: ${result.project_name}`, type: "success" });
    } catch (err) {
      setUploadState("error");
      setFieldErrors({ file: toHumanErrorMessage(err, copy.uploadFailed) });
    } finally {
      window.clearInterval(timer);
      resetInput();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await uploadSelectedFile(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await uploadSelectedFile(file);
  };

  const handleReview = async () => {
    if (!selectedExistingProjectId) {
      setFieldErrors((prev) => ({ ...prev, project: copy.projectRequired }));
      setProjectFieldPulse(true);
      window.setTimeout(() => setProjectFieldPulse(false), 520);
      return;
    }
    if (!uploadedProjectId || !documentType || uploadState !== "uploaded") {
      setMessage({ text: copy.disabledHelper, type: "error" });
      return;
    }
    setReviewing(true);
    setProcessingStep("read");
    setMessage(null);
    setFieldErrors({});
    setReviewDone(null);

    try {
      const result = (await reviewMutation.mutateAsync({
        projectId: uploadedProjectId,
        documentVersionId: uploadedVersionId,
        force: forceRegrade,
      })) as GradeResponse;

      const isPending = (result.status ?? "").toLowerCase() === "pending";
      setReviewDone({
        projectId: result.project_id,
        score: result.score,
        isPending,
      });
      setReviewErrorKind(null);
      setMessage(null);
      
      if (isPending) {
        onReviewComplete?.(result.project_id);
      }
    } catch (err) {
      const mapped = mapReviewErrorByCode(err, t);
      setReviewErrorKind(mapped.kind);
      setMessage({ text: mapped.text, type: "error" });
    } finally {
      setReviewing(false);
    }
  };

  const handleConfirmDuplicateUpload = async () => {
    const file = pendingDuplicateFile;
    setShowDuplicateConfirm(false);
    setPendingDuplicateFile(null);
    if (file) {
      await uploadSelectedFile(file, true);
    }
  };

  const handleCancelDuplicateUpload = () => {
    setShowDuplicateConfirm(false);
    setPendingDuplicateFile(null);
    setUploadState("idle");
    setMessage(null);
    resetInput();
  };

  return (
    <div className="upload-container-v3" aria-label={copy.title}>
      <div className="upload-main-v4">
        {/* Stepper Header */}
        <div className="upload-stepper-v4">
          {[
            { id: 1, label: copy.steps[0] },
            { id: 2, label: copy.steps[1] },
            { id: 3, label: copy.steps[2] },
          ].map((s) => {
            const currentStep = !selectedExistingProjectId ? 1 : (uploadState !== "uploaded" && !reviewDone ? 2 : 3);
            const isActive = s.id <= currentStep;
            const isCompleted = s.id < currentStep;
            return (
              <div key={s.id} className={`upload-step-v4 ${isActive ? "is-active" : ""} ${isCompleted ? "is-completed" : ""}`.trim()}>
                <div className="upload-step-v4__circle">
                  {isCompleted ? "✓" : s.id}
                </div>
                <div className="upload-step-v4__label">{s.label}</div>
                {s.id < 3 && <div className="upload-step-v4__connector" />}
              </div>
            );
          })}
        </div>

        <div className="ds-container upload-one-shot-container">
          <Card 
            title={reviewing ? reviewingMessage : reviewDone ? t("project.reviewResult") : copy.title}
            className="upload-card-full"
            headerAction={
              reviewDone && (
                <Button variant="ghost" size="sm" onClick={resetFile}>
                  ← {copy.startOver}
                </Button>
              )
            }
          >
            {reviewing ? (
              <div className="upload-wizard-processing">
                <div className="prod-processing">
                  {(["read", "extract", "grade", "recommend"] as ProcessingStep[]).map((step) => (
                    <div className={`prod-processing__step ${processingStep === step ? "is-active" : ""}`.trim()} key={step}>
                      <span />
                      <strong>{copy.processingSteps[step]}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : reviewDone ? (
              <div className="upload-wizard-result">
                <div className="upload-result-hero">
                  <div className="upload-result-hero__score">
                    <span className={`upload-result-hero__value ${(reviewDone.score ?? 0) < 60 ? "is-danger" : "is-success"}`}>
                      {reviewDone.score ?? "—"}
                      <small>/100</small>
                    </span>
                    <label>{copy.overallScoreLabel}</label>
                  </div>
                  <div className="upload-result-hero__actions">
                    <Button size="lg" variant="primary" onClick={() => onReviewComplete?.(reviewDone.projectId)}>
                      {copy.viewDetailReport} →
                    </Button>
                    <p>{copy.aiAnalysisDesc}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="upload-one-shot-form animate-fade-in">
                <div className="upload-section-v4">
                  <h4 className="upload-section-title">{copy.chooseType}</h4>
                  <div className="prod-doc-type-grid">
                    {DOCUMENT_TYPE_OPTIONS.map((option) => {
                      const cardCopy = DOCUMENT_CARD_COPY[lang][option.id];
                      const Icon = getDocumentIcon(option.id);
                      const isSelected = documentType === option.id;

                      return (
                        <button
                          className={`prod-doc-type-card ${isSelected ? "is-active" : ""}`.trim()}
                          type="button"
                          key={option.id}
                          onClick={() => {
                            setDocumentType(option.id);
                            setMessage(null);
                          }}
                        >
                          <span className="prod-doc-type-card__icon" aria-hidden="true">
                            <Icon size="sm" />
                          </span>
                          <span className="prod-doc-type-card__copy">
                            <strong>{cardCopy.title}</strong>
                            <small>{cardCopy.description}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ margin: "32px 0", borderTop: "1px solid var(--ds-color-border-subtle)" }} />

                <div className="upload-wizard-grid">
                  <div className="upload-wizard-col-left">
                    <div className={`upload-project-section ${fieldErrors.project ? "has-error" : ""} ${projectFieldPulse ? "is-shaking" : ""}`.trim()}>
                      <label className="ds-input-label">{copy.projectSelect}</label>
                      <div className="upload-project-input-group">
                        <Select
                          className={fieldErrors.project ? "has-error" : ""}
                          options={[
                            { value: "", label: `-- ${copy.selectExistingProject} --` },
                            ...projects.map((p) => ({ value: p.project_id, label: `${p.project_id} - ${p.project_name}` }))
                          ]}
                          value={selectedExistingProjectId || ""}
                          onChange={(e) => {
                            const pid = e.target.value;
                            setSelectedExistingProjectId(pid || null);
                            setFieldErrors((prev) => ({ ...prev, project: undefined }));
                            const p = projects.find((proj) => proj.project_id === pid);
                            if (p) {
                              setProjectDescription(p.project_description || "");
                            }
                          }}
                          error={fieldErrors.project}
                        />
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => setShowCreateProjectDialog(true)}
                          disabled={uploadState === "uploading" || reviewing}
                          className="upload-project-add-btn"
                        >
                          <PlusIcon size="sm" />
                          {copy.createProjectNew}
                        </Button>
                      </div>
                    </div>

                    <div className="upload-description-header">
                      <label className="ds-input-label">{copy.projectDescription}</label>
                    </div>
                    <Input
                      multiline
                      rows={4}
                      placeholder={copy.projectDescriptionHint}
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      disabled={uploadState === "uploading" || reviewing}
                      className="upload-project-description-area"
                    />
                  </div>

                  <div className="upload-wizard-col-right">
                    <div className="upload-project-upload-group">
                      <input
                        ref={inputRef}
                        type="file"
                        accept=".pdf,.pptx,.txt,.xlsx,.png,.jpg,.jpeg"
                        onChange={(event) => void handleFileChange(event)}
                        disabled={!documentType || uploadState === "uploading" || reviewing}
                        hidden
                      />
                      {uploadState === "uploading" ? (
                        <div className="prod-dropzone prod-dropzone--uploading">
                          <div className="prod-dropzone__spinner" aria-label="Uploading">
                            <svg viewBox="0 0 50 50" width="48" height="48">
                              <circle cx="25" cy="25" r="20" fill="none" stroke="var(--ds-color-border)" strokeWidth="4" />
                              <circle cx="25" cy="25" r="20" fill="none" stroke="var(--ds-color-primary)" strokeWidth="4"
                                strokeDasharray="125.6"
                                strokeDashoffset={125.6 - (uploadProgress / 100) * 125.6}
                                strokeLinecap="round" transform="rotate(-90 25 25)"
                                style={{ transition: "stroke-dashoffset 0.3s ease" }} />
                            </svg>
                            <span className="prod-dropzone__pct">{uploadProgress}%</span>
                          </div>
                          <span className="prod-dropzone__copy">
                            <strong>{selectedFile?.name}</strong>
                            <small>{copy.uploading}...</small>
                          </span>
                        </div>
                      ) : uploadState === "uploaded" && selectedFile ? (
                        <div className="prod-dropzone prod-dropzone--success">
                          <div className="prod-dropzone__success-icon">✓</div>
                          <span className="prod-dropzone__copy">
                            <strong>{selectedFile.name}</strong>
                            <small>{formatFileSize(selectedFile.size)}</small>
                          </span>
                          <button type="button" className="prod-dropzone__replace" onClick={openFilePicker} disabled={reviewing}>
                            {copy.replace}
                          </button>
                        </div>
                      ) : (
                        <label
                          className={`prod-dropzone ${dragActive ? "is-drag-active" : ""} ${!documentType || reviewing ? "is-disabled" : ""}`.trim()}
                          onClick={(event) => {
                            event.preventDefault();
                            openFilePicker();
                          }}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            if (documentType && !reviewing) setDragActive(true);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (documentType && !reviewing) setDragActive(true);
                          }}
                          onDragLeave={(event) => {
                            event.preventDefault();
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
                          }}
                          onDrop={(event) => void handleDrop(event)}
                        >
                          <UploadCloudIcon size="lg" />
                          <span className="prod-dropzone__copy">
                            <strong>{dragActive ? copy.dragTitle : copy.idleTitle}</strong>
                            <span>{copy.idleLink}</span>
                          </span>
                        </label>
                      )}
                      <FieldError message={fieldErrors.file} />
                    </div>
                  </div>
                </div>

                <div className="upload-actions-group">
                  <div className="upload-metadata-summary">
                    <label className="ds-checkbox-control prod-upload-btn-group__checkbox">
                      <input
                        type="checkbox"
                        checked={forceRegrade}
                        onChange={(e) => setForceRegrade(e.target.checked)}
                        disabled={reviewing || uploadState === "uploading"}
                      />
                      <span>{copy.rerunWithoutCache}</span>
                    </label>

                    {message && uploadState !== "error" && (
                      <div style={{ marginLeft: "auto" }}>
                        <StatusBadge tone={message.type === "success" ? "success" : "danger"}>
                          {uploadState === "uploaded" && message.type === "success" && uploadedProjectName
                            ? `${copy.uploaded}: ${uploadedProjectName}`
                            : message.text}
                        </StatusBadge>
                      </div>
                    )}
                  </div>

                  <div className="prod-upload-btn-group">
                    <Button
                      variant="ghost"
                      onClick={resetFile}
                      disabled={reviewing || uploadState === "uploading"}
                      size="lg"
                    >
                      {t("common.cancel") || "Hủy"}
                    </Button>
                    <Button
                      onClick={() => void handleReview()}
                      disabled={!canStartReview || reviewing}
                      isLoading={reviewing}
                      size="lg"
                      variant="primary"
                      className={`upload-main-review-btn ${canStartReview && !reviewing ? "btn-pulse" : ""}`.trim()}
                    >
                      {reviewing ? reviewingMessage : copy.startReview}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ProjectCreateDialog
        open={showCreateProjectDialog}
        onClose={() => setShowCreateProjectDialog(false)}
        onCreated={(project) => {
          setSelectedExistingProjectId(project.project_id);
          setProjectDescription(project.project_description || "");
          setFieldErrors((prev) => ({ ...prev, project: undefined }));
        }}
      />
      
      <ConfirmDialog
        open={showDuplicateConfirm}
        title={copy.duplicateTitle}
        description={copy.duplicateDescription}
        details={
          pendingDuplicateFile
            ? [pendingDuplicateFile.name, documentType ? DOCUMENT_CARD_COPY[lang][documentType].title : ""].filter(Boolean)
            : undefined
        }
        confirmLabel={copy.duplicateConfirm}
        cancelLabel={copy.duplicateCancel}
        onConfirm={() => {
          void handleConfirmDuplicateUpload();
        }}
        onCancel={handleCancelDuplicateUpload}
      />
    </div>
  );
}
