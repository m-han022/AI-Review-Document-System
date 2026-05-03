import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { gradeSubmission, uploadFile } from "../api/client";
import { getActiveRubricConfig } from "../constants/gradingCriteria";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../constants/documentTypes";
import { useRubricList } from "../hooks/useRubrics";
import { projectsQueryKey } from "../query";
import type { GradeResponse, LanguageCode } from "../types";
import { useTranslation } from "./LanguageSelector";
import {
  BookOpenIcon,
  BugIcon,
  ClipboardCheckIcon,
  HelpIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
} from "./ui/Icon";
import { PageHeader } from "./ui/PageHeader";
import { ErrorState, FilePreview, StatusBadge, SuccessState, Tooltip } from "./ui/States";

const ACCEPTED_EXTENSIONS = [".pdf", ".pptx"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PROJECT_FILENAME_PATTERN = /^(P\d+)[_-](.+?)\.(pdf|pptx)$/i;

interface FileUploadProps {
  onReviewComplete?: (projectId: string) => void;
}

type UploadState = "idle" | "uploading" | "uploaded" | "error";
type ProcessingStep = "read" | "extract" | "grade" | "recommend";

const UPLOAD_COPY = {
  vi: {
    title: "Tải tài liệu lên",
    subtitle: "Chọn đúng loại tài liệu, tải file PDF/PPTX và chạy AI review theo bộ tiêu chí đang kích hoạt.",
    steps: ["Chọn loại tài liệu", "Tải file", "Chạy review"],
    chooseType: "Chọn loại tài liệu",
    chooseTypeHint: "AI sẽ áp dụng rubric, tiêu chí và prompt theo loại tài liệu bạn chọn.",
    uploadFile: "Tải file",
    options: "Tiêu chuẩn đánh giá",
    recommendedVersion: "Đang dùng phiên bản khuyến nghị",
    criteriaNote: "AI sẽ áp dụng bộ tiêu chí theo loại tài liệu bạn chọn.",
    idleTitle: "Kéo và thả file vào đây",
    idleLink: "hoặc bấm để chọn file",
    idleHint: "Định dạng hỗ trợ: PDF, PPTX (tối đa 100MB)",
    dragTitle: "Thả file để tải lên",
    uploading: "Đang tải lên",
    uploaded: "Đã tải lên",
    replace: "Thay file",
    invalidType: "File không được hỗ trợ. Vui lòng chọn PDF hoặc PPTX.",
    tooLarge: "File vượt quá 100MB. Vui lòng chọn file nhỏ hơn.",
    uploadFailed: "Upload thất bại. Vui lòng thử lại.",
    retry: "Thử lại",
    chooseOther: "Chọn file khác",
    startReview: "Bắt đầu review",
    reviewing: "AI đang review...",
    disabledHelper: "Vui lòng chọn loại tài liệu và tải file để bắt đầu review.",
    success: "Review hoàn tất",
    language: "Ngôn ngữ",
    version: "Version",
    selectedType: "Loại tài liệu",
    processingSteps: {
      read: "Đang đọc tài liệu",
      extract: "Đang trích xuất nội dung",
      grade: "Đang chấm điểm",
      recommend: "Đang tạo khuyến nghị",
    },
  },
  ja: {
    title: "アップロード",
    subtitle: "資料タイプを選択し、PDF/PPTX をアップロードして AI レビューを実行します。",
    steps: ["資料タイプ選択", "ファイルアップロード", "レビュー実行"],
    chooseType: "資料タイプを選択",
    chooseTypeHint: "選択した資料タイプに応じて評価基準とプロンプトを適用します。",
    uploadFile: "ファイルアップロード",
    options: "評価基準",
    recommendedVersion: "推奨バージョンを使用中",
    criteriaNote: "AI は選択した資料タイプの評価基準を適用します。",
    idleTitle: "ファイルをドラッグ＆ドロップ",
    idleLink: "またはクリックして選択",
    idleHint: "対応形式: PDF, PPTX（最大100MB）",
    dragTitle: "ファイルをドロップしてアップロード",
    uploading: "アップロード中",
    uploaded: "アップロード済み",
    replace: "差し替え",
    invalidType: "対応していないファイルです。PDF または PPTX を選択してください。",
    tooLarge: "ファイルが100MBを超えています。小さいファイルを選択してください。",
    uploadFailed: "アップロードに失敗しました。もう一度お試しください。",
    retry: "再試行",
    chooseOther: "別ファイルを選択",
    startReview: "レビュー開始",
    reviewing: "AI レビュー中...",
    disabledHelper: "資料タイプを選択し、ファイルをアップロードするとレビューを開始できます。",
    success: "レビューが完了しました",
    language: "言語",
    version: "Version",
    selectedType: "資料タイプ",
    processingSteps: {
      read: "資料を読み込み中",
      extract: "内容を抽出中",
      grade: "スコアリング中",
      recommend: "推奨事項を生成中",
    },
  },
} as const;

const DOCUMENT_CARD_COPY: Record<LanguageCode, Record<DocumentType, { title: string; description: string; example: string; tooltip: string }>> = {
  vi: {
    "project-review": {
      title: "Tài liệu nhìn nhận dự án",
      description: "Review tài liệu tổng kết, proposal, pitch deck hoặc báo cáo dự án.",
      example: "Ví dụ: slide retrospective, báo cáo tiến độ, proposal khách hàng.",
      tooltip: "AI đánh giá tổng thể, điểm tốt, điểm cần cải thiện và chính sách cải thiện.",
    },
    "bug-analysis": {
      title: "Tài liệu Phân tích bug",
      description: "Review bug report, phân tích nguyên nhân và đề xuất phòng ngừa.",
      example: "Ví dụ: issue report, RCA, defect analysis.",
      tooltip: "AI đánh giá khả năng tái hiện, phân tích nguyên nhân, ảnh hưởng và phòng ngừa.",
    },
    "qa-review": {
      title: "Tài liệu QA",
      description: "Review checklist, test case, test report hoặc tài liệu kiểm thử.",
      example: "Ví dụ: test plan, test result, QA checklist.",
      tooltip: "AI đánh giá độ phủ, độ rõ ràng, khả năng truy vết và tính thực thi.",
    },
    "explanation-review": {
      title: "Tài liệu giải thích",
      description: "Review tài liệu hướng dẫn, giải thích nghiệp vụ hoặc technical note.",
      example: "Ví dụ: user guide, design note, specification.",
      tooltip: "AI đánh giá tính dễ hiểu, logic, ví dụ minh họa và độ đầy đủ.",
    },
  },
  ja: {
    "project-review": {
      title: "プロジェクト振り返り資料",
      description: "総括、提案、ピッチデック、プロジェクトレポートをレビューします。",
      example: "例: retrospective slide, 進捗レポート, 顧客提案。",
      tooltip: "総合評価、良い点、改善点、改善方針を評価します。",
    },
    "bug-analysis": {
      title: "バグ分析資料",
      description: "バグレポート、原因分析、再発防止策をレビューします。",
      example: "例: issue report, RCA, defect analysis。",
      tooltip: "再現性、原因分析、影響、予防策を評価します。",
    },
    "qa-review": {
      title: "QA 資料",
      description: "チェックリスト、テストケース、テストレポートをレビューします。",
      example: "例: test plan, test result, QA checklist。",
      tooltip: "カバレッジ、明確性、追跡性、実行可能性を評価します。",
    },
    "explanation-review": {
      title: "説明資料",
      description: "業務説明、手順書、technical note をレビューします。",
      example: "例: user guide, design note, specification。",
      tooltip: "分かりやすさ、論理、例示、十分性を評価します。",
    },
  },
};

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

export default function FileUpload({ onReviewComplete }: FileUploadProps) {
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [selectedRubricVersion, setSelectedRubricVersion] = useState<string>("active");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedProjectId, setUploadedProjectId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("read");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { lang, t } = useTranslation();
  const copy = UPLOAD_COPY[lang] ?? UPLOAD_COPY.vi;
  const rubrics = useRubricList();
  const effectiveDocumentType = documentType ?? "project-review";
  const documentRubrics = useMemo(
    () => rubrics.filter((rubric) => rubric.document_type === effectiveDocumentType),
    [effectiveDocumentType, rubrics],
  );
  const activeRubric = documentRubrics.find((rubric) => rubric.active);
  const resolvedRubricVersion =
    selectedRubricVersion === "active" ? activeRubric?.version ?? null : selectedRubricVersion;
  const criteriaConfig = useMemo(
    () => getActiveRubricConfig(rubrics, effectiveDocumentType, lang),
    [effectiveDocumentType, lang, rubrics],
  );
  const selectedCriteriaPreview = useMemo(
    () =>
      criteriaConfig.order.map((criterionKey) => ({
        key: criterionKey,
        label: t(`upload.criteria.${criterionKey}`),
        maxScore: criteriaConfig.maxScores[criterionKey],
      })),
    [criteriaConfig, t],
  );
  const activeStep = getStepIndex(documentType, uploadState, reviewing);
  const canStartReview = Boolean(documentType && uploadedProjectId && uploadState === "uploaded" && !reviewing);

  useEffect(() => {
    if (
      selectedRubricVersion !== "active" &&
      !documentRubrics.some((rubric) => rubric.version === selectedRubricVersion)
    ) {
      setSelectedRubricVersion("active");
    }
  }, [documentRubrics, selectedRubricVersion]);

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

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const resetFile = () => {
    setSelectedFile(null);
    setUploadedProjectId(null);
    setUploadState("idle");
    setUploadProgress(0);
    setMessage(null);
    resetInput();
  };

  const openFilePicker = () => {
    if (!reviewing && uploadState !== "uploading") {
      inputRef.current?.click();
    }
  };

  const uploadSelectedFile = async (file: File) => {
    if (!documentType) {
      setMessage({ text: copy.disabledHelper, type: "error" });
      return;
    }

    if (!isAcceptedFile(file)) {
      setSelectedFile(file);
      setUploadState("error");
      setMessage({ text: copy.invalidType, type: "error" });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(file);
      setUploadState("error");
      setMessage({ text: copy.tooLarge, type: "error" });
      return;
    }

    setSelectedFile(file);
    setUploadedProjectId(null);
    setUploadState("uploading");
    setUploadProgress(8);
    setMessage(null);

    const timer = window.setInterval(() => {
      setUploadProgress((current) => Math.min(92, current + 14));
    }, 220);

    try {
      const formData = new FormData();
      const uploadMetadata = resolveUploadMetadata(file);
      formData.append("file", file);
      formData.append("language", lang);
      if (uploadMetadata.projectId) {
        formData.append("project_id", uploadMetadata.projectId);
      }
      formData.append("project_name", uploadMetadata.projectName);
      formData.append("document_type", documentType);
      formData.append("document_name", uploadMetadata.documentName);

      const result = await uploadMutation.mutateAsync(formData);
      setUploadProgress(100);
      setUploadedProjectId(result.project_id);
      setUploadState("uploaded");
      setMessage({ text: `${copy.uploaded}: ${result.project_name}`, type: "success" });
    } catch (err) {
      setUploadState("error");
      setMessage({ text: err instanceof Error ? err.message : copy.uploadFailed, type: "error" });
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

    try {
      const result = (await reviewMutation.mutateAsync({
        projectId: uploadedProjectId,
        force: true,
        rubricVersion: resolvedRubricVersion,
      })) as GradeResponse;
      setMessage({ text: `${copy.success}: ${result.score}/100`, type: "success" });
      onReviewComplete?.(result.project_id);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("submissions.gradingFailed"), type: "error" });
    } finally {
      setReviewing(false);
    }
  };

  const retryUpload = async () => {
    if (selectedFile) await uploadSelectedFile(selectedFile);
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
                        <span className="prod-doc-type-card__help" aria-label="Scoring hint">
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

              {uploadState === "error" ? (
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

              <div className="prod-upload-actions">
                <div>
                  {!canStartReview ? <p>{copy.disabledHelper}</p> : null}
                  {message && uploadState !== "error" ? (
                    message.type === "success" ? (
                      <SuccessState title={message.text} compact />
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
                <label className="prod-field">
                  <span>{copy.version}</span>
                  <select
                    value={selectedRubricVersion}
                    onChange={(event) => setSelectedRubricVersion(event.target.value)}
                    disabled={uploadState === "uploading" || reviewing}
                  >
                    <option value="active">
                      {copy.recommendedVersion} ({activeRubric?.version ?? "v1"})
                    </option>
                    {documentRubrics.filter((rubric) => !rubric.active).map((rubric) => (
                      <option key={`${rubric.document_type}-${rubric.version}`} value={rubric.version}>
                        {rubric.version}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="prod-option-summary">
                  <div>
                    <span>{copy.selectedType}</span>
                    <strong>{documentType ? DOCUMENT_CARD_COPY[lang][documentType].title : "—"}</strong>
                  </div>
                  <div>
                    <span>{copy.version}</span>
                    <strong>{resolvedRubricVersion ?? "v1"}</strong>
                  </div>
                  <div>
                    <span>{copy.language}</span>
                    <strong>{lang.toUpperCase()}</strong>
                  </div>
                </div>

                <div className="prod-criteria-list">
                  {selectedCriteriaPreview.map((criterion) => (
                    <article key={criterion.key}>
                      <ShieldCheckIcon size="sm" />
                      <span>{criterion.label}</span>
                      <strong>/{criterion.maxScore}</strong>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
