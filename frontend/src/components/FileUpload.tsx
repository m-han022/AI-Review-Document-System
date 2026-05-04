import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gradeSubmission, uploadFile, listProjects } from "../api/client";
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
    projectRequired: "Vui lòng chọn project trước khi upload.",
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
    projectDescription: "Mô tả dự án (ngữ cảnh bổ sung)",
    projectDescriptionHint: "Nhập thêm thông tin về dự án để AI review chính xác hơn (ngữ cảnh, yêu cầu đặc biệt...).",
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
    projectRequired: "アップロード前にプロジェクトを選択してください。",
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
    projectDescription: "プロジェクトの説明 (追加のコンテキスト)",
    projectDescriptionHint: "AI レビューの精度を高めるために、プロジェクトの背景や要件などの追加情報を入力してください。",
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
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedExistingProjectId, setSelectedExistingProjectId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("read");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    project?: string;
    file?: string;
    rubric?: string;
  }>({});
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
  const hasActiveCriteria = criteriaConfig.order.length > 0;
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
  const canStartReview = Boolean(documentType && uploadedProjectId && uploadState === "uploaded" && !reviewing && hasActiveCriteria);
  const rubricStatusLabel = hasActiveCriteria
    ? (lang === "ja" ? "レビュー準備完了" : "Sẵn sàng review")
    : (lang === "ja" ? "Rubric 設定が必要" : "Cần cấu hình rubric");

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
    setFieldErrors({});
    resetInput();
  };

  const openFilePicker = () => {
    if (!reviewing && uploadState !== "uploading") {
      inputRef.current?.click();
    }
  };

  const uploadSelectedFile = async (file: File) => {
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
      
      if (!selectedExistingProjectId) {
        setUploadState("error");
        setFieldErrors({ project: copy.projectRequired });
        window.clearInterval(timer);
        return;
      }
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
    if (!hasActiveCriteria) {
      setFieldErrors({
        rubric:
          lang === "ja"
            ? "Rubric active version を設定してください。"
            : "Vui lòng bật rubric active trước khi review.",
      });
      return;
    }
    setReviewing(true);
    setProcessingStep("read");
    setMessage(null);
    setFieldErrors({});

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

              <div className="prod-field" style={{ marginBottom: '20px', padding: '0 24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>{lang === 'ja' ? 'プロジェクト選択' : 'Chọn dự án'}</label>
                <select 
                  className="prod-select" 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
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
                  <option value="">{lang === 'ja' ? '-- 既存プロジェクトを選択 --' : '-- Chọn project có sẵn --'}</option>
                  {projects.map(p => (
                    <option key={p.project_id} value={p.project_id}>{p.project_id} - {p.project_name}</option>
                  ))}
                </select>
                {fieldErrors.project ? (
                  <p style={{ marginTop: "8px", color: "#dc2626", fontSize: "12px" }}>{fieldErrors.project}</p>
                ) : null}
                {selectedExistingProject && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>{selectedExistingProject.project_name}</strong>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      {selectedExistingProject.project_description || (lang === 'ja' ? '説明なし' : 'Không có mô tả')}
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
              
              <div className="prod-field" style={{ marginTop: '24px' }}>
                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>{(copy as any).projectDescription}</span>
                <textarea
                  className="prod-textarea"
                  style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
                  placeholder={(copy as any).projectDescriptionHint}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  disabled={uploadState === "uploading" || reviewing}
                />
              </div>

              <div className="prod-upload-actions">
                <div>
                  {!canStartReview ? <p>{copy.disabledHelper}</p> : null}
                  {documentType && !hasActiveCriteria ? (
                    <ErrorState
                      title={lang === "ja" ? "有効な評価基準が見つかりません" : "Không tìm thấy tiêu chuẩn đánh giá đang active"}
                      description={lang === "ja" ? "Rubric management で active version を設定してください。" : "Vui lòng vào Rubric Management để bật một version active cho loại tài liệu này."}
                      compact
                    />
                  ) : null}
                  {fieldErrors.rubric ? (
                    <ErrorState title={lang === "ja" ? "Rubric 設定エラー" : "Lỗi cấu hình rubric"} description={fieldErrors.rubric} compact />
                  ) : null}
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
                  <div>
                    <span>{lang === "ja" ? "Rubric" : "Trạng thái rubric"}</span>
                    <strong>{rubricStatusLabel}</strong>
                  </div>
                </div>

                <div className="prod-criteria-list">
                  {hasActiveCriteria ? (
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
                      <span>{lang === "ja" ? "Rubric active version が未設定です" : "Chưa có rubric active cho loại tài liệu này"}</span>
                    </article>
                  )}
                </div>
                <div className="prod-field" style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--compact"
                    onClick={() => setShowAdvancedOptions((prev) => !prev)}
                    disabled={uploadState === "uploading" || reviewing}
                  >
                    {showAdvancedOptions
                      ? (lang === "ja" ? "詳細オプションを隠す" : "Ẩn tùy chọn nâng cao")
                      : (lang === "ja" ? "詳細オプションを表示" : "Hiện tùy chọn nâng cao")}
                  </button>
                </div>

                {showAdvancedOptions ? (
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
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
