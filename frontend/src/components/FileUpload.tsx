import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  gradeSubmission,
  uploadFile,
  listProjects,
  listEvaluationSets,
  listProjectDocuments,
  listDocumentVersions,
  getGlobalDefaults,
} from "../api/client";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../constants/documentTypes";
import { DOCUMENT_CARD_COPY, UPLOAD_COPY } from "../constants/uploadCopy";
import { mapErrorCodeToI18nKey } from "../locales/errorMapping";
import { toHumanErrorMessage } from "../utils/humanizeError";
import { projectsQueryKey } from "../query";
import type { EvaluationSet, GradeResponse } from "../types";
import { useTranslation } from "./LanguageSelector";
import ProjectCreateDialog from "./project/ProjectCreateDialog";
import ConfirmDialog from "./ui/ConfirmDialog";
import {
  BookOpenIcon,
  BugIcon,
  ClipboardCheckIcon,
  HelpIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
} from "./ui/Icon";

import { EmptyState, ErrorState, FieldError, FilePreview, StatusBadge, SuccessState, Tooltip } from "./ui/States";
import { Button, Card, Input, Select } from "./ui";
import "./FileUpload.css";

const ACCEPTED_EXTENSIONS = [".pdf", ".pptx"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PROJECT_FILENAME_PATTERN = /^(P\d+)[_-](.+?)\.(pdf|pptx)$/i;

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
    return { kind: "runtime", text: t(key) };
  }
  return { kind: "runtime", text: t("api.unexpectedError") };
}

export default function FileUpload({ onReviewComplete }: FileUploadProps) {
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [selectedEvaluationSetId, setSelectedEvaluationSetId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedProjectId, setUploadedProjectId] = useState<string | null>(null);
  const [uploadedVersionId, setUploadedVersionId] = useState<number | null>(null);
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
  const [activeStep, setActiveStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<{
    project?: string;
    file?: string;
    rubric?: string;
  }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { lang, t } = useTranslation();
  const copy = UPLOAD_COPY[lang] ?? UPLOAD_COPY.vi;
  const reviewingMessage =
    lang === "vi"
      ? "AI đang đọc tài liệu của bạn..."
      : lang === "ja"
        ? "AI が資料を読み込んでいます..."
        : "AI is reading your document...";
  const effectiveDocumentType = documentType ?? "project-review";
  const canStartReview = Boolean(
    documentType &&
      uploadedProjectId &&
      uploadState === "uploaded" &&
      !reviewing
  );
  
  const { data: globalDefaults } = useQuery({
    queryKey: ["global-defaults"],
    queryFn: getGlobalDefaults,
  });
  
  const { data: evaluationSetsData } = useQuery({
    queryKey: ["upload-evaluation-sets", effectiveDocumentType],
    queryFn: () => listEvaluationSets(effectiveDocumentType),
    enabled: Boolean(documentType),
  });
  const evaluationSets = (Array.isArray(evaluationSetsData) ? evaluationSetsData : []) as EvaluationSet[];
  const scopedEvaluationSets = useMemo(
    () => evaluationSets.filter((item) => item.document_type === effectiveDocumentType),
    [evaluationSets, effectiveDocumentType],
  );

  useEffect(() => {
    if (!documentType) {
      setSelectedEvaluationSetId(null);
      return;
    }
    if (!scopedEvaluationSets.length) {
      setSelectedEvaluationSetId(null);
      return;
    }
    if (selectedEvaluationSetId && scopedEvaluationSets.some((item) => item.id === selectedEvaluationSetId)) {
      return;
    }
    const preferred = scopedEvaluationSets.find((item) => item.status === "active") ?? scopedEvaluationSets[0];
    setSelectedEvaluationSetId(preferred?.id ?? null);
  }, [documentType, scopedEvaluationSets, selectedEvaluationSetId]);

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
    setUploadState("idle");
    setUploadProgress(0);
    setMessage(null);
    setReviewErrorKind(null);
    setFieldErrors({});
    setReviewDone(null);  // clear stale review result when file is replaced
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
          if (latestVersion?.content_hash) {
            const newFileHash = await sha256Hex(file);
            if (newFileHash === latestVersion.content_hash) {
              setPendingDuplicateFile(file);
              setShowDuplicateConfirm(true);
              setUploadState("idle");
              return;
            }
          }
        }
      } catch {
        // Non-blocking UX check: if hash pre-check fails, continue upload normally.
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
    // Fix: removed selectedEvaluationSetId guard - backend auto-resolves it per AGENTS.md
    if (!uploadedProjectId || !documentType || uploadState !== "uploaded") {
      setMessage({ text: copy.disabledHelper, type: "error" });
      return;
    }
    setReviewing(true);
    setProcessingStep("read");
    setMessage(null);  // clear upload success message to avoid confusion
    setFieldErrors({});
    setReviewDone(null);

    try {
      const result = (await reviewMutation.mutateAsync({
        projectId: uploadedProjectId,
        documentVersionId: uploadedVersionId,
        force: forceRegrade,
        evaluationSetId: selectedEvaluationSetId ?? undefined,
      })) as GradeResponse;

      const isPending = (result.status ?? "").toLowerCase() === "pending";
      setReviewDone({
        projectId: result.project_id,
        score: result.score,
        isPending,
      });
      setReviewErrorKind(null);
      setMessage(null);
      
      // Advance to result step
      setActiveStep(2);

      // Async mode (USE_CELERY=true): navigate immediately, result screen will poll for status
      if (isPending) {
        onReviewComplete?.(result.project_id);
      }
      // Sync mode (USE_CELERY=false): show success inline with score + view-details button
    } catch (err) {
      const mapped = mapReviewErrorByCode(err, t);
      setReviewErrorKind(mapped.kind);
      setMessage({ text: mapped.text, type: "error" });
    } finally {
      setReviewing(false);
    }
  };

  const retryUpload = async () => {
    if (selectedFile) await uploadSelectedFile(selectedFile);
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

  // Stepper logic
  const currentStep = (() => {
    if (!documentType) return 0;
    if (uploadState !== "uploaded") return 1;
    if (!selectedExistingProjectId) return 2;
    return 3;
  })();
  const steps = [
    { label: lang === "ja" ? "資料タイプ選択" : lang === "en" ? "Select Type" : "Chọn loại tài liệu", icon: "📄" },
    { label: lang === "ja" ? "ファイルをアップロード" : lang === "en" ? "Upload File" : "Tải tệp lên", icon: "☁" },
    { label: lang === "ja" ? "プロジェクト設定" : lang === "en" ? "Setup Project" : "Thiết lập dự án", icon: "⚙" },
    { label: lang === "ja" ? "レビュー開始" : lang === "en" ? "Ready" : "Sẵn sàng", icon: "🚀" },
  ];

  return (
    <div className="upload-container-v3" aria-label={copy.title}>
      {/* Step 1: Selection & Flow Overview */}
      <div className="upload-header-section">
        <div className="ds-container">
          <div className="upload-stepper">
            {steps.map((step, i) => (
              <div 
                key={i} 
                className={`upload-stepper__item ${
                  i < activeStep ? "is-done" : i === activeStep ? "is-active" : "is-pending"
                } ${(!documentType && i > 0) || reviewing ? "is-disabled" : "is-clickable"}`.trim()}
                onClick={() => {
                  if (!reviewing && (i === 0 || (documentType && i <= activeStep))) {
                    setActiveStep(i);
                  }
                }}
              >
                <div className="upload-stepper__circle">
                  {i < activeStep ? <span>✓</span> : <span>{step.icon}</span>}
                </div>
                <span className="upload-stepper__label">{step.label}</span>
                {i < steps.length - 1 && <div className="upload-stepper__line" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area - Wizard Steps */}
      <div className="upload-main-v4">
        <div className="ds-container upload-wizard-container">
          {/* STEP 0: Selection */}
          {activeStep === 0 && (
            <div className="upload-step-view animate-fade-in">
              <Card 
                title={copy.chooseType}
                subtitle={undefined}
                className="upload-type-compact"
              >
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
                          setActiveStep(1);
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
              </Card>
            </div>
          )}

          {/* STEP 1: Upload & Config */}
          {activeStep === 1 && (
            <div className="upload-step-view animate-fade-in">
              <Card
                title={copy.uploadFile}
                headerAction={
                  <Button variant="ghost" size="sm" onClick={() => setActiveStep(0)}>
                    ← {lang === "ja" ? "戻る" : "Quay lại"}
                  </Button>
                }
                className="upload-stage-compact"
              >
                <div className="upload-wizard-grid">
                  <div className="upload-wizard-col-left">
                    <div className={`upload-project-section ${fieldErrors.project ? "has-error" : ""} ${projectFieldPulse ? "is-shaking" : ""}`.trim()}>
                      <label className="ds-input-label">{copy.projectSelect}</label>
                      <div className="upload-project-input-group">
                        <Select
                          className={fieldErrors.project ? "has-error" : ""}
                          options={[
                            { value: "", label: `-- ${copy.selectExistingProject} --` },
                            ...projects.map(p => ({ value: p.project_id, label: `${p.project_id} - ${p.project_name}` }))
                          ]}
                          value={selectedExistingProjectId || ""}
                          onChange={(e) => {
                            const pid = e.target.value;
                            setSelectedExistingProjectId(pid || null);
                            setFieldErrors((prev) => ({ ...prev, project: undefined }));
                            const p = projects.find(proj => proj.project_id === pid);
                            if (p) {
                              setProjectDescription(p.project_description || "");
                            }
                          }}
                          error={fieldErrors.project}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowCreateProjectDialog(true)}
                          disabled={uploadState === "uploading" || reviewing}
                          className="upload-project-add-btn"
                          title={copy.createProjectNew}
                        >
                          +
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
                        accept=".pdf,.pptx"
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
                    <div className="ds-chip-muted">
                      <ShieldCheckIcon size="sm" />
                      <span>{t("upload.evaluationSet")}:</span>
                      <strong>
                        {selectedEvaluationSetId
                          ? (evaluationSets.find(s => s.id === selectedEvaluationSetId)?.name || "Auto")
                          : "Auto"}
                      </strong>
                    </div>

                    <Tooltip content={globalDefaults?.policies["medium"]?.[lang] || "..."}>
                      <div className="ds-chip-muted" style={{ cursor: 'help' }}>
                        <HelpIcon size="sm" />
                        <span>Medium</span>
                      </div>
                    </Tooltip>

                    {message && uploadState !== "error" && (
                      <div style={{ marginLeft: 'auto' }}>
                        <StatusBadge tone={message.type === "success" ? "success" : "danger"}>
                          {message.text}
                        </StatusBadge>
                      </div>
                    )}
                  </div>

                  <div className="prod-upload-btn-group">
                    <label className="ds-checkbox-control prod-upload-btn-group__checkbox">
                      <input
                        type="checkbox"
                        checked={forceRegrade}
                        onChange={(e) => setForceRegrade(e.target.checked)}
                        disabled={reviewing || uploadState === "uploading"}
                      />
                      <span>{copy.rerunWithoutCache}</span>
                    </label>
                    <Button
                      onClick={() => void handleReview()}
                      disabled={!canStartReview || reviewing}
                      isLoading={reviewing}
                      size="lg"
                      className={canStartReview && !reviewing ? "btn-pulse" : ""}
                    >
                      {reviewing ? reviewingMessage : copy.startReview}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 2: Processing & Result */}
          {activeStep === 2 && (
            <div className="upload-step-view animate-fade-in">
              <Card 
                title={reviewing ? lang === "ja" ? "AI レビュー中" : "AI đang chấm điểm" : lang === "ja" ? "レビュー結果" : "Kết quả review"}
                className="upload-result-compact"
                headerAction={
                  !reviewing && (
                    <Button variant="ghost" size="sm" onClick={() => setActiveStep(1)}>
                      ← {lang === "ja" ? "再アップロード" : "Tải lên lại"}
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
                        <label>{lang === "ja" ? "総合スコア" : "Điểm tổng quát"}</label>
                      </div>
                      <div className="upload-result-hero__actions">
                        <Button size="lg" variant="primary" onClick={() => onReviewComplete?.(reviewDone.projectId)}>
                          {lang === "ja" ? "詳細レポートを見る" : "Xem báo cáo chi tiết"} →
                        </Button>
                        <p>{lang === "ja" ? "AI がドキュメントを分析し、改善案を生成しました。" : "AI đã phân tích tài liệu và đưa ra các đề xuất cải thiện."}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                   <EmptyState title="No data" description="Please complete step 1" />
                )}
              </Card>
            </div>
          )}
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
