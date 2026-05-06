import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  gradeSubmission,
  uploadFile,
  listProjects,
  listEvaluationSets,
  getEvaluationSetDetail,
  listProjectDocuments,
  listDocumentVersions,
} from "../api/client";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../constants/documentTypes";
import { DOCUMENT_CARD_COPY, UPLOAD_COPY } from "../constants/uploadCopy";
import { getDocumentTypeLabel, getLevelLabel } from "../constants/uiLabels";
import { mapErrorCodeToI18nKey } from "../locales/errorMapping";
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
import { PageHeader } from "./ui/PageHeader";
import { EmptyState, ErrorState, FilePreview, StatusBadge, SuccessState, Tooltip } from "./ui/States";

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

function getStepIndex(documentType: DocumentType | null, uploadState: UploadState, reviewing: boolean) {
  if (reviewing) return 2;
  if (uploadState === "uploaded" || uploadState === "uploading") return 1;
  if (documentType) return 0;
  return 0;
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
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedExistingProjectId, setSelectedExistingProjectId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [forceRegrade, setForceRegrade] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("read");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [reviewErrorKind, setReviewErrorKind] = useState<"config" | "runtime" | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [pendingDuplicateFile, setPendingDuplicateFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    project?: string;
    file?: string;
    rubric?: string;
  }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { lang, t } = useTranslation();
  const copy = UPLOAD_COPY[lang] ?? UPLOAD_COPY.vi;
  const effectiveDocumentType = documentType ?? "project-review";
  const activeStep = getStepIndex(documentType, uploadState, reviewing);
  const canStartReview = Boolean(
    documentType &&
      uploadedProjectId &&
      uploadState === "uploaded" &&
      selectedEvaluationSetId &&
      !reviewing 
  );
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
  const selectedEvaluationSet = scopedEvaluationSets.find((item) => item.id === selectedEvaluationSetId) ?? null;
  const { data: selectedEvaluationSetDetail } = useQuery({
    queryKey: ["upload-evaluation-set-detail", selectedEvaluationSetId],
    queryFn: () => getEvaluationSetDetail(selectedEvaluationSetId as number),
    enabled: showAdvancedOptions && typeof selectedEvaluationSetId === "number",
  });
  const selectedCriteriaPreview = useMemo(() => {
    const raw = selectedEvaluationSetDetail?.criteria ?? [];
    return raw.map((item) => ({
      key: item.key,
      label: item?.[`label_${lang}` as "label_vi" | "label_ja"] || item.label_vi || item.label_ja || item.key,
      maxScore: item.max_score,
    }));
  }, [selectedEvaluationSetDetail, lang]);

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
  const selectedExistingProject = projects.find(p => p.project_id === selectedExistingProjectId);

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
      setUploadState("uploaded");
      setMessage({ text: `${copy.uploaded}: ${result.project_name}`, type: "success" });
    } catch (err) {
      setUploadState("error");
      setFieldErrors({ file: err instanceof Error ? err.message : copy.uploadFailed });
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
    if (!uploadedProjectId || !documentType) return;
    setReviewing(true);
    setProcessingStep("read");
    setMessage(null);
    setFieldErrors({});

    try {
      const result = (await reviewMutation.mutateAsync({
        projectId: uploadedProjectId,
        force: forceRegrade,
      })) as GradeResponse;
      setMessage({ text: `${copy.success}: ${result.score}/100`, type: "success" });
      setReviewErrorKind(null);
      onReviewComplete?.(result.project_id);
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

  return (
    <section className="prod-upload" aria-label={copy.title}>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <div className="prod-upload__panel">
        <div className="prod-upload-steps">
          {copy.steps.map((step, index) => (
            <div className={`prod-upload-step ${activeStep === index ? "is-active" : activeStep > index ? "is-complete" : ""}`.trim()} key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>

        <div className="prod-upload__layout">
          <main className="prod-upload__main">
            <section className="prod-upload-card">
              <header className="prod-upload-card__head">
                <div>
                  <h2>{copy.chooseType}</h2>
                  <p>{copy.chooseTypeHint}</p>
                </div>
              </header>
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
                        if (uploadState !== "uploading" && !reviewing) {
                          setDocumentType(option.id);
                          setMessage(null);
                        }
                      }}
                      disabled={uploadState === "uploading" || reviewing}
                    >
                      <span className="prod-doc-type-card__icon" aria-hidden="true">
                        <Icon size="md" />
                      </span>
                      <span className="prod-doc-type-card__copy">
                        <strong>{cardCopy.title}</strong>
                        <small>{cardCopy.description}</small>
                        <em>{cardCopy.example}</em>
                      </span>
                      <Tooltip content={cardCopy.tooltip}>
                        <span className="prod-doc-type-card__help" aria-label={copy.scoringHintAria}>
                          <HelpIcon size="sm" />
                        </span>
                      </Tooltip>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="prod-upload-card">
              <header className="prod-upload-card__head">
                <div>
                  <h2>{copy.uploadFile}</h2>
                  <p>{documentType ? DOCUMENT_CARD_COPY[lang][documentType].title : copy.disabledHelper}</p>
                </div>
                <StatusBadge tone={uploadState === "uploaded" ? "success" : uploadState === "error" ? "danger" : "muted"}>
                  {uploadState === "uploaded" ? copy.uploaded : uploadState.toUpperCase()}
                </StatusBadge>
              </header>

              <div className="prod-field upload-project-select">
                <label className="upload-project-select__label">{copy.projectSelect}</label>
                <div className="upload-project-select__control-wrap">
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--compact"
                    onClick={() => setShowCreateProjectDialog(true)}
                    disabled={uploadState === "uploading" || reviewing}
                  >
                    {`+ ${copy.createProjectNew}`}
                  </button>
                </div>
                <select
                  className="prod-select upload-project-select__control"
                  value={selectedExistingProjectId || ""}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedExistingProjectId(pid || null);
                    const p = projects.find(proj => proj.project_id === pid);
                    if (p) {
                      setProjectDescription(p.project_description || "");
                    }
                  }}
                >
                  <option value="">{`-- ${copy.selectExistingProject} --`}</option>
                  {projects.map(p => (
                    <option key={p.project_id} value={p.project_id}>{p.project_id} - {p.project_name}</option>
                  ))}
                </select>
                {fieldErrors.project ? (
                  <p className="upload-project-select__error">{fieldErrors.project}</p>
                ) : null}
                {projects.length === 0 ? (
                  <div className="upload-project-select__empty">
                    <EmptyState
                      title={copy.noProjectAvailable}
                      description={copy.createProjectBeforeUpload}
                      tone="warning"
                      compact
                      action={
                        <button
                          type="button"
                          className="prod-button"
                          onClick={() => setShowCreateProjectDialog(true)}
                          disabled={uploadState === "uploading" || reviewing}
                        >
                          {copy.createProject}
                        </button>
                      }
                    />
                  </div>
                ) : null}
                {selectedExistingProject && (
                  <div className="upload-project-select__summary">
                    <strong className="upload-project-select__summary-title">{selectedExistingProject.project_name}</strong>
                    <p className="upload-project-select__summary-desc">
                      {selectedExistingProject.project_description || copy.noProjectDescription}
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.pptx"
                onChange={(event) => void handleFileChange(event)}
                disabled={!documentType || uploadState === "uploading" || reviewing}
                hidden
              />

              <label
                className={`prod-dropzone ${dragActive ? "is-drag-active" : ""} ${!documentType || uploadState === "uploading" || reviewing ? "is-disabled" : ""}`.trim()}
                onClick={(event) => {
                  event.preventDefault();
                  openFilePicker();
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (documentType && uploadState !== "uploading" && !reviewing) setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (documentType && uploadState !== "uploading" && !reviewing) setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
                }}
                onDrop={(event) => void handleDrop(event)}
              >
                <span className="prod-dropzone__icon" aria-hidden="true">
                  <UploadCloudIcon size="lg" />
                </span>
                <span className="prod-dropzone__copy">
                  <strong>{dragActive ? copy.dragTitle : copy.idleTitle}</strong>
                  <span>{copy.idleLink}</span>
                  <small>{copy.idleHint}</small>
                </span>
              </label>
              {fieldErrors.file ? (
                <ErrorState title={copy.uploadFailed} description={fieldErrors.file} compact />
              ) : null}

              {uploadState === "uploading" && selectedFile ? (
                <div className="prod-upload-progress">
                  <div className="prod-upload-progress__head">
                    <strong>{selectedFile.name}</strong>
                    <span>{copy.uploading}... {uploadProgress}%</span>
                  </div>
                  <div className="prod-upload-progress__bar" aria-hidden="true">
                    <span style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : null}

              {uploadState === "uploaded" && selectedFile ? (
                <FilePreview
                  filename={selectedFile.name}
                  sizeLabel={formatFileSize(selectedFile.size)}
                  statusLabel={`✓ ${copy.uploaded}`}
                  replaceLabel={copy.replace}
                  onReplace={openFilePicker}
                  onRemove={resetFile}
                  disabled={reviewing}
                />
              ) : null}

              {uploadState === "error" && !fieldErrors.file ? (
                <ErrorState
                  title={copy.uploadFailed}
                  description={message?.text}
                  compact
                  action={
                    <div className="prod-upload-error-actions">
                      <button type="button" className="prod-button" onClick={() => void retryUpload()} disabled={!selectedFile}>
                        {copy.retry}
                      </button>
                      <button type="button" className="prod-button" onClick={openFilePicker}>
                        {copy.chooseOther}
                      </button>
                    </div>
                  }
                />
              ) : null}
              
              <div className="prod-field upload-project-desc">
                <span className="upload-project-desc__label">{copy.projectDescription}</span>
                <textarea
                  className="prod-textarea upload-project-desc__input"
                  placeholder={copy.projectDescriptionHint}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  disabled={uploadState === "uploading" || reviewing}
                />
              </div>

              <div className="prod-upload-actions">
                <div>
                  {!canStartReview ? <p>{copy.disabledHelper}</p> : null}
                  {documentType && !selectedEvaluationSetId ? (
                    <ErrorState
                      title={copy.setMissingTitle}
                      description={
                        copy.setMissingDescription
                      }
                      compact
                    />
                  ) : null}
                  {message && uploadState !== "error" ? (
                    message.type === "success" ? (
                      <SuccessState title={message.text} compact />
                    ) : reviewErrorKind === "config" ? (
                      <EmptyState title={message.text} tone="warning" compact />
                    ) : (
                      <ErrorState title={message.text} compact />
                    )
                  ) : null}
                </div>
                <button
                  type="button"
                  className="prod-button prod-button--primary"
                  onClick={() => void handleReview()}
                  disabled={!canStartReview}
                >
                  {reviewing ? copy.reviewing : copy.startReview}
                </button>
              </div>

              {reviewing ? (
                <div className="prod-processing">
                  {(["read", "extract", "grade", "recommend"] as ProcessingStep[]).map((step) => (
                    <div className={`prod-processing__step ${processingStep === step ? "is-active" : ""}`.trim()} key={step}>
                      <span />
                      <strong>{copy.processingSteps[step]}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </main>

          <aside className="prod-upload__side">
            <section className="prod-upload-card">
              <header className="prod-upload-card__head">
                <div>
                  <h2>{copy.options}</h2>
                  <p>{copy.criteriaNote}</p>
                </div>
              </header>
              <div className="prod-options-stack">
                <div className="prod-option-summary">
                  <div>
                    <span>{copy.activeSetLabel}</span>
                    <strong>
                      {selectedEvaluationSet
                        ? `[Auto] ${selectedEvaluationSet.name}`
                        : copy.activeSetNotConfigured}
                    </strong>
                  </div>
                </div>
                <div className="prod-option-summary">
                  <div>
                    <span>{copy.levelLabel}</span>
                    <strong>{getLevelLabel(selectedEvaluationSet?.level ?? null, lang)}</strong>
                  </div>
                </div>
                <div className="prod-field">
                  <small style={{ color: "#64748b" }}>
                    {copy.activeSetAutoNote}
                  </small>
                </div>
                {!selectedEvaluationSet ? (
                  <ErrorState
                    title={copy.setMissingShortTitle}
                    description={
                      copy.setMissingDescription
                    }
                    compact
                  />
                ) : null}
                <div className="prod-field" style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--compact"
                    onClick={() => setShowAdvancedOptions((prev) => !prev)}
                    disabled={uploadState === "uploading" || reviewing}
                  >
                    {showAdvancedOptions
                      ? copy.hideDetailInfo
                      : copy.detailInfo}
                  </button>
                </div>

                {showAdvancedOptions ? (
                  <div className="prod-option-summary">
                    <label className="prod-field" style={{ marginBottom: "10px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={forceRegrade}
                          onChange={(event) => setForceRegrade(event.target.checked)}
                          disabled={reviewing || uploadState === "uploading"}
                        />
                        {copy.rerunWithoutCache}
                      </span>
                      <small style={{ color: "#64748b" }}>{copy.rerunWithoutCacheHint}</small>
                    </label>
                    <div>
                      <span>{copy.selectedType}</span>
                      <strong>{documentType ? getDocumentTypeLabel(documentType, lang) : t("common.noValue")}</strong>
                    </div>
                    <div>
                      <span>{copy.rubricLabel}</span>
                      <strong>{selectedEvaluationSetDetail?.rubric_version ?? t("common.noValue")}</strong>
                    </div>
                    <div>
                      <span>{copy.promptLabel}</span>
                      <strong>{selectedEvaluationSetDetail?.prompt_version ?? t("common.noValue")}</strong>
                    </div>
                    <div>
                      <span>{copy.policyLabel}</span>
                      <strong>{selectedEvaluationSetDetail?.policy_version ?? t("common.noValue")}</strong>
                    </div>
                    <div>
                      <span>{copy.requiredRulesLabel}</span>
                      <strong>{selectedEvaluationSet?.required_rules_version ?? t("common.noValue")}</strong>
                    </div>
                    <div>
                      <span>{copy.rulesHashLabel}</span>
                      <strong>{selectedEvaluationSet?.required_rule_hash?.slice(0, 10) ?? t("common.noValue")}</strong>
                    </div>
                    <div>
                      <span>{copy.setStatusLabel}</span>
                      <strong>{selectedEvaluationSet?.status ?? t("common.noValue")}</strong>
                    </div>
                    <div className="prod-criteria-list">
                      {selectedCriteriaPreview.length > 0 ? (
                        selectedCriteriaPreview.map((criterion) => (
                          <article key={criterion.key}>
                            <ShieldCheckIcon size="sm" />
                            <span>{criterion.label}</span>
                            <strong>/{criterion.maxScore}</strong>
                          </article>
                        ))
                      ) : (
                        <article>
                          <ShieldCheckIcon size="sm" />
                          <span>{copy.selectedSetNoCriteria}</span>
                        </article>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
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
        description={
          copy.duplicateDescription
        }
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
    </section>
  );
}


