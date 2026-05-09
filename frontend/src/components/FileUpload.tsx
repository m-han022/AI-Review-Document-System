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

import { EmptyState, ErrorState, FilePreview, StatusBadge, SuccessState, Tooltip } from "./ui/States";
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
    if (!uploadedProjectId || !documentType || !selectedEvaluationSetId || uploadState !== "uploaded") {
      setMessage({ text: copy.disabledHelper, type: "error" });
      return;
    }
    setReviewing(true);
    setProcessingStep("read");
    setMessage(null);
    setFieldErrors({});

    try {
      const result = (await reviewMutation.mutateAsync({
        projectId: uploadedProjectId,
        documentVersionId: uploadedVersionId,
        force: forceRegrade,
        evaluationSetId: selectedEvaluationSetId,
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
    <div className="upload-container-v3" aria-label={copy.title}>
      <main className="upload-layout-v3">
        <section className="upload-main-v3">
          <Card 
            title={copy.chooseType}
            subtitle={undefined}
            className="mb-3 upload-type-compact"
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
                      if (uploadState !== "uploading" && !reviewing) {
                        setDocumentType(option.id);
                        setMessage(null);
                      }
                    }}
                    disabled={uploadState === "uploading" || reviewing}
                  >
                    <span className="prod-doc-type-card__icon" aria-hidden="true">
                      <Icon size="sm" />
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
          </Card>

          <Card
            title={copy.uploadFile}
            subtitle={documentType ? undefined : copy.disabledHelper}
            headerAction={
              <StatusBadge tone={uploadState === "uploaded" ? "success" : uploadState === "error" ? "danger" : "muted"}>
                {uploadState === "uploaded" ? copy.uploaded : uploadState.toUpperCase()}
              </StatusBadge>
            }
            className="mb-4 upload-stage-compact"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.pptx"
              onChange={(event) => void handleFileChange(event)}
              disabled={!documentType || uploadState === "uploading" || reviewing}
              hidden
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className={`prod-field upload-project-select ${fieldErrors.project ? "has-error" : ""} ${projectFieldPulse ? "is-shaking" : ""}`.trim()}>
                <div className="upload-project-select__head">
                  <label className="ds-input-label">{copy.projectSelect}</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateProjectDialog(true)}
                    disabled={uploadState === "uploading" || reviewing}
                  >
                    {`+ ${copy.createProjectNew}`}
                  </Button>
                </div>
                
                <Select
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
                
                {projects.length === 0 ? (
                  <div className="upload-project-select__empty">
                    <EmptyState
                      title={copy.noProjectAvailable}
                      description={copy.createProjectBeforeUpload}
                      tone="warning"
                      compact
                      action={
                        <Button
                          onClick={() => setShowCreateProjectDialog(true)}
                          disabled={uploadState === "uploading" || reviewing}
                        >
                          {copy.createProject}
                        </Button>
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div className="upload-project-upload-group">
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
              </div>
            </div>

            {fieldErrors.file && <ErrorState title={copy.uploadFailed} description={fieldErrors.file} compact />}

            {uploadState === "uploading" && selectedFile && (
              <div className="prod-upload-progress">
                <div className="prod-upload-progress__head">
                  <strong>{selectedFile.name}</strong>
                  <span>{copy.uploading}... {uploadProgress}%</span>
                </div>
                <div className="prod-upload-progress__bar" aria-hidden="true">
                  <span style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadState === "uploaded" && selectedFile && (
              <FilePreview
                filename={selectedFile.name}
                sizeLabel={formatFileSize(selectedFile.size)}
                statusLabel={`✓ ${copy.uploaded}`}
                replaceLabel={copy.replace}
                onReplace={openFilePicker}
                onRemove={resetFile}
                disabled={reviewing}
              />
            )}

            {uploadState === "error" && !fieldErrors.file && (
              <ErrorState
                title={copy.uploadFailed}
                description={message?.text}
                compact
                action={
                  <div className="prod-upload-error-actions">
                    <Button variant="secondary" onClick={() => void retryUpload()} disabled={!selectedFile}>
                      {copy.retry}
                    </Button>
                    <Button variant="outline" onClick={openFilePicker}>
                      {copy.chooseOther}
                    </Button>
                  </div>
                }
              />
            )}
            
            <div className="upload-description-block mb-6">
              <Input
                label={copy.projectDescription}
                multiline
                placeholder={copy.projectDescriptionHint}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                disabled={uploadState === "uploading" || reviewing}
              />
            </div>

            <div className="prod-upload-actions prod-upload-actions--sticky">
              <div className="upload-metadata-summary">
                {selectedEvaluationSetId && (
                  <div className="ds-chip-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '100px', background: 'var(--ds-color-bg-muted)', fontSize: '13px' }}>
                    <ShieldCheckIcon size="sm" />
                    <span>{t("upload.evaluationSet")}:</span>
                    <strong>{evaluationSets.find(s => s.id === selectedEvaluationSetId)?.name || "Auto"}</strong>
                  </div>
                )}
                {!canStartReview && <p className="ds-caption mt-2">{copy.disabledHelper}</p>}
                {message && uploadState !== "error" && (
                  message.type === "success" ? (
                    <SuccessState title={message.text} compact />
                  ) : (
                    <ErrorState title={message.text} compact />
                  )
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
                  disabled={reviewing || uploadState === "uploading"}
                  isLoading={reviewing}
                  size="lg"
                >
                  {reviewing ? reviewingMessage : copy.startReview}
                </Button>
                {reviewing && <span className="prod-reviewing-inline">{reviewingMessage}</span>}
              </div>
            </div>

            {reviewing && (
              <div className="prod-processing mt-4">
                {(["read", "extract", "grade", "recommend"] as ProcessingStep[]).map((step) => (
                  <div className={`prod-processing__step ${processingStep === step ? "is-active" : ""}`.trim()} key={step}>
                    <span />
                    <strong>{copy.processingSteps[step]}</strong>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </main>

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
