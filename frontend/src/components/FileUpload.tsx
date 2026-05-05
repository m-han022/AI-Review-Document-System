import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  gradeSubmission,
  uploadFile,
  listProjects,
  listEvaluationSets,
  getEvaluationSetDetail,
  listProjectDocuments,
  listDocumentVersions,
} from "../api/client";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../constants/documentTypes";
import { projectsQueryKey } from "../query";
import type { EvaluationSet, GradeResponse, LanguageCode } from "../types";
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

const UPLOAD_COPY = {
  vi: {
    title: "Tải tài liệu lên",
    subtitle: "Chọn đúng loại tài liệu, tải file PDF/PPTX và chạy AI review theo bộ tiêu chí đang kích hoạt.",
    steps: ["Chọn loại tài liệu", "Tải file", "Chạy review"],
    chooseType: "Chọn loại tài liệu",
    chooseTypeHint: "AI sẽ áp dụng rubric, tiêu chí và prompt theo loại tài liệu bạn chọn.",
    uploadFile: "Tải file",
    options: "Bộ cấu hình đánh giá",
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
    rerunWithoutCache: "Chấm lại không dùng cache",
    rerunWithoutCacheHint: "Bật khi cần chạy lại hoàn toàn để lấy kết quả mới.",
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
    options: "評価設定セット",
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
    rerunWithoutCache: "キャッシュを使わず再評価",
    rerunWithoutCacheHint: "完全に再実行して最新結果を取得したい場合に有効にします。",
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

function isConfigurationError(message: string): boolean {
  const raw = (message || "").toLowerCase();
  return (
    raw.includes("evaluation set") ||
    raw.includes("bộ cấu hình đánh giá") ||
    raw.includes("評価セット") ||
    raw.includes("evaluation_set_id")
  );
}

function classifyReviewError(message: string, lang: LanguageCode): string {
  if (isConfigurationError(message)) {
    return lang === "ja" ? `設定エラー: ${message}` : `Lỗi cấu hình: ${message}`;
  }
  return lang === "ja" ? `レビューエラー: ${message}` : `Lỗi review: ${message}`;
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
      label: lang === "ja" ? item.label_ja || item.key : item.label_vi || item.key,
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
      const rawMessage = err instanceof Error ? err.message : t("submissions.gradingFailed");
      setReviewErrorKind(isConfigurationError(rawMessage) ? "config" : "runtime");
      setMessage({ text: classifyReviewError(rawMessage, lang), type: "error" });
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
                <div style={{ marginBottom: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--compact"
                    onClick={() => setShowCreateProjectDialog(true)}
                    disabled={uploadState === "uploading" || reviewing}
                  >
                    {lang === "ja" ? "+ Create Project" : "+ Tạo dự án mới"}
                  </button>
                </div>
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
                {projects.length === 0 ? (
                  <div style={{ marginTop: "12px" }}>
                    <EmptyState
                      title={lang === "ja" ? "No available project" : "Chưa có dự án khả dụng"}
                      description={lang === "ja" ? "Create a project before upload." : "Vui lòng tạo dự án trước khi upload."}
                      tone="warning"
                      compact
                      action={
                        <button
                          type="button"
                          className="prod-button"
                          onClick={() => setShowCreateProjectDialog(true)}
                          disabled={uploadState === "uploading" || reviewing}
                        >
                          {lang === "ja" ? "Create Project" : "Tạo dự án"}
                        </button>
                      }
                    />
                  </div>
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
                  {!canStartReview ? <p>{copy.disabledHelper}</p> : null}
                  {documentType && !selectedEvaluationSetId ? (
                    <ErrorState
                      title={lang === "ja" ? "Evaluation Set が未設定です" : "Chưa có bộ đánh giá khả dụng"}
                      description={
                        lang === "ja"
                          ? "先に「Bộ cấu hình đánh giá AI」で最初のセットを作成してください。"
                          : "Vui lòng vào \"Bộ cấu hình đánh giá AI\" và bấm \"Tạo bộ đầu tiên\"."
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
                    <span>{lang === "ja" ? "使用中の評価セット" : "Bộ đánh giá đang dùng"}</span>
                    <strong>
                      {selectedEvaluationSet
                        ? `[Auto] ${selectedEvaluationSet.name}`
                        : (lang === "ja" ? "[Auto] 未設定" : "[Auto] Chưa thiết lập")}
                    </strong>
                  </div>
                </div>
                <div className="prod-field">
                  <small style={{ color: "#64748b" }}>
                    {lang === "ja"
                      ? "システムが最新の active 設定を自動選択します。"
                      : "Hệ thống tự động áp dụng cấu hình active mới nhất."}
                  </small>
                </div>
                {!selectedEvaluationSet ? (
                  <ErrorState
                    title={lang === "ja" ? "評価セットが未設定です" : "Chưa có bộ đánh giá"}
                    description={
                      lang === "ja"
                        ? "「Bộ cấu hình đánh giá AI」で「最初のセットを作成」を実行してください。"
                        : "Vui lòng vào \"Bộ cấu hình đánh giá AI\" và bấm \"Tạo bộ đầu tiên\"."
                    }
                    compact
                  />
                ) : null}

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
                      <span>{lang === "ja" ? "選択した Evaluation Set の基準がありません" : "Evaluation Set được chọn chưa có danh sách tiêu chí"}</span>
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
                      ? (lang === "ja" ? "詳細を隠す" : "Ẩn thông tin chi tiết")
                      : (lang === "ja" ? "情報詳細" : "Thông tin chi tiết")}
                  </button>
                </div>

                {showAdvancedOptions ? (
                  <div className="prod-option-summary">
                    <div>
                      <span>{copy.selectedType}</span>
                      <strong>{documentType ? DOCUMENT_CARD_COPY[lang][documentType].title : "—"}</strong>
                    </div>
                    <div>
                      <span>Level</span>
                      <strong>{selectedEvaluationSet?.level ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Rubric</span>
                      <strong>{selectedEvaluationSetDetail?.rubric_version ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Prompt</span>
                      <strong>{selectedEvaluationSetDetail?.prompt_version ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Policy</span>
                      <strong>{selectedEvaluationSetDetail?.policy_version ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Required Rules</span>
                      <strong>{selectedEvaluationSet?.required_rules_version ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Rules Hash</span>
                      <strong>{selectedEvaluationSet?.required_rule_hash?.slice(0, 10) ?? "—"}</strong>
                    </div>
                    <div>
                      <span>{lang === "ja" ? "Status" : "Trạng thái set"}</span>
                      <strong>{selectedEvaluationSet?.status ?? "—"}</strong>
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
        title={lang === "ja" ? "同一内容の確認" : "Xác nhận nội dung trùng"}
        description={
          lang === "ja"
            ? "前回のバージョンと同じ内容です。新しいバージョンを作成しますか？"
            : "Nội dung giống version trước. Bạn vẫn muốn tạo version mới không?"
        }
        details={
          pendingDuplicateFile
            ? [pendingDuplicateFile.name, documentType ? DOCUMENT_CARD_COPY[lang][documentType].title : ""].filter(Boolean)
            : undefined
        }
        confirmLabel={lang === "ja" ? "新バージョンを作成" : "Tạo version mới"}
        cancelLabel={lang === "ja" ? "キャンセル" : "Hủy"}
        onConfirm={() => {
          void handleConfirmDuplicateUpload();
        }}
        onCancel={handleCancelDuplicateUpload}
      />
    </section>
  );
}
