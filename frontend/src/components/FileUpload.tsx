import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { aiReviewAssets } from "../assets/aiReviewAssets";
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
import { PageHeader } from "./ui/PageHeader";

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
  const copy =
    lang === "ja"
      ? {
          title: "アップロード",
          subtitle: "ドキュメントをアップロードして AI による品質レビューを開始します",
          stepOne: "ファイル選択",
          stepTwo: "詳細情報入力",
          stepThree: "レビュー実行",
          typeSectionTitle: "1. レビューするドキュメントの種類を選択",
          typeSectionSubtitle: "ドキュメントの種類に応じて最適な評価基準を適用します",
          fileSectionTitle: "2. ファイルアップロード",
          documentKind: "資料タイプ",
          rubricVersion: "評価基準のバージョン",
          languageLabel: "言語",
          dropzoneTitle: "ファイルをドラッグ＆ドロップ",
          dropzoneLink: "またはクリックしてファイルを選択",
          dropzoneHint: "対応形式: PDF, PPTX（最大100MB）",
          selectFile: "ファイルを選択",
          cancel: "キャンセル",
          startReview: "レビュー開始",
          reviewing: "レビュー中...",
          optionsTitle: "処理オプション",
          applyActiveVersion: "適用中のバージョンを使用",
          noteTitle: "評価のポイント",
          noteBody: "選択した資料タイプに応じた評価基準で、AI がドキュメントを分析し、スコアと改善提案を提供します。",
          criteriaTitle: "評価項目",
          aiReviewTitle: "AIレビューについて",
          aiReviewBody:
            "AI がドキュメントの内容を分析し、選択した評価基準に基づいて客観的なフィードバックを提供します。レビュー結果はレポートとして出力・保存できます。",
        }
      : {
          title: "Tải tài liệu lên",
          subtitle: "Tải tài liệu lên để bắt đầu quá trình AI review chất lượng nội dung",
          stepOne: "Chọn file",
          stepTwo: "Nhập thông tin",
          stepThree: "Chạy review",
          typeSectionTitle: "1. Chọn loại tài liệu cần review",
          typeSectionSubtitle: "Hệ thống áp dụng bộ tiêu chí phù hợp theo từng loại tài liệu",
          fileSectionTitle: "2. Tải file lên",
          documentKind: "Loại tài liệu",
          rubricVersion: "Phiên bản tiêu chuẩn",
          languageLabel: "Ngôn ngữ",
          dropzoneTitle: "Kéo và thả file vào đây",
          dropzoneLink: "hoặc bấm để chọn file",
          dropzoneHint: "Định dạng hỗ trợ: PDF, PPTX (tối đa 100MB)",
          selectFile: "Chọn file",
          cancel: "Hủy",
          startReview: "Bắt đầu review",
          reviewing: "Đang review...",
          optionsTitle: "Tùy chọn xử lý",
          applyActiveVersion: "Dùng phiên bản đang kích hoạt",
          noteTitle: "Điểm cần lưu ý",
          noteBody:
            "AI sẽ phân tích tài liệu theo bộ tiêu chí tương ứng với loại tài liệu bạn chọn, sau đó trả về điểm số và gợi ý cải thiện.",
          criteriaTitle: "Tiêu chí đánh giá",
          aiReviewTitle: "Về AI review",
          aiReviewBody:
            "AI phân tích nội dung tài liệu và đưa ra phản hồi khách quan theo bộ tiêu chí đã chọn. Kết quả review có thể xuất ra và lưu dưới dạng báo cáo.",
        };
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
  const selectedCriteriaConfig = useMemo(
    () => getActiveRubricConfig(rubrics, documentType, lang),
    [documentType, lang, rubrics],
  );
  const selectedCriteriaPreview = useMemo(
    () =>
      selectedCriteriaConfig.order.map((criterionKey) => {
        const label = t(`upload.criteria.${criterionKey}`);
        const maxScore = selectedCriteriaConfig.maxScores[criterionKey];
        return maxScore ? `${label} /${maxScore}` : label;
      }),
    [selectedCriteriaConfig, t],
  );

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
    <section className="upload-reference">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <div className="upload-reference__panel">

        <div className="upload-progress upload-progress--reference">
          <div className="upload-progress__step is-active">
            <span className="upload-progress__dot">1</span>
            <span>{copy.stepOne}</span>
          </div>
          <span className="upload-progress__line" />
          <div className="upload-progress__step">
            <span className="upload-progress__dot">2</span>
            <span>{copy.stepTwo}</span>
          </div>
          <span className="upload-progress__line" />
          <div className="upload-progress__step">
            <span className="upload-progress__dot">3</span>
            <span>{copy.stepThree}</span>
          </div>
        </div>

        <div className="upload-reference__layout">
          <div className="upload-reference__main">
            <div className="upload-stage upload-stage--reference">
              <div className="upload-stage__header">
                <h3>{copy.typeSectionTitle}</h3>
                <p>{copy.typeSectionSubtitle}</p>
              </div>

              <div className="upload-type-grid upload-type-grid--reference">
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
                      className={`upload-type-card upload-type-card--reference ${isActive ? "is-active" : ""}`.trim()}
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

            <div className="upload-stage upload-stage--reference">
              <div className="upload-stage__header">
                <h3>{copy.fileSectionTitle}</h3>
              </div>

              <div className="upload-file-layout upload-file-layout--reference">
                <div className="upload-file-layout__main">
                  <div className="upload-file-layout__summary upload-file-layout__summary--reference">
                    <div className="upload-file-layout__summary-item">
                      <span>{copy.documentKind}</span>
                      <strong>{t(selectedDocumentOption.labelKey)}</strong>
                    </div>
                    <div className="upload-file-layout__summary-item">
                      <span>{copy.rubricVersion}</span>
                      <strong>{resolvedRubricVersion ?? "-"}</strong>
                    </div>
                    <div className="upload-file-layout__summary-item">
                      <span>{copy.languageLabel}</span>
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
                    className={`upload-dropzone upload-dropzone--reference ${uploading || reviewing ? "is-disabled" : ""} ${
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
                      <span className="upload-dropzone__title">{copy.dropzoneTitle}</span>
                      <span className="upload-dropzone__link">{copy.dropzoneLink}</span>
                      <span className="upload-dropzone__hint">{copy.dropzoneHint}</span>
                    </span>
                  </label>

                  {selectedFileName ? (
                    <div className="upload-file-row upload-file-row--reference">
                      <div className="upload-file-row__meta">
                        <strong>{selectedFileName}</strong>
                        <span>
                          {formatFileSize(selectedFileSize) ?? t(getDocumentTypeKey(documentType))}
                          {uploadedProjectId ? ` Â· ${uploadedProjectId}` : ""}
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

                  <div className="upload-footer upload-footer--reference">
                    <button
                      type="button"
                      className="upload-reference-button upload-reference-button--ghost"
                      onClick={openFilePicker}
                      disabled={uploading || reviewing}
                    >
                      <PlusIcon size="sm" />
                      {copy.selectFile}
                    </button>

                    <div className="upload-footer__actions">
                      <button
                        type="button"
                        className="upload-reference-button upload-reference-button--secondary"
                        onClick={resetLocalState}
                        disabled={uploading || reviewing}
                      >
                        {copy.cancel}
                      </button>
                      <button
                        type="button"
                        className="upload-reference-button upload-reference-button--primary"
                        onClick={() => {
                          void handleReviewUploadedFile();
                        }}
                        disabled={!uploadedProjectId || uploading || reviewing}
                      >
                        {reviewing ? copy.reviewing : copy.startReview}
                      </button>
                    </div>
                  </div>

                  {message ? <div className={`upload-message upload-message--${message.type}`}>{message.text}</div> : null}
                </div>
              </div>
            </div>
          </div>

          <aside className="upload-options-card upload-options-card--reference">
            <h4>{copy.optionsTitle}</h4>
            <div className="upload-options-card__fields">
              <label>
                <span>{copy.rubricVersion}</span>
                <select
                  className="upload-options-card__select"
                  value={selectedRubricVersion}
                  onChange={(event) => setSelectedRubricVersion(event.target.value)}
                  disabled={uploading || reviewing}
                >
                  <option value="active">
                    {copy.applyActiveVersion}
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

            <div className="upload-options-card__summary upload-options-card__summary--reference">
              <div>
                <span>{copy.documentKind}</span>
                <strong>{t(selectedDocumentOption.labelKey)}</strong>
              </div>
              <div>
                <span>{copy.rubricVersion}</span>
                <strong>{resolvedRubricVersion ?? "-"}</strong>
              </div>
              <div>
                <span>{copy.languageLabel}</span>
                <strong>{lang.toUpperCase()}</strong>
              </div>
            </div>

            <div className="upload-options-card__note upload-options-card__note--reference">
              <strong>{copy.noteTitle}</strong>
              <p>{copy.noteBody}</p>
            </div>

            <div className="upload-options-card__criteria">
              <strong>{copy.criteriaTitle}</strong>
              <ul>
                {selectedCriteriaPreview.map((criterion) => (
                  <li key={criterion}>
                    <ShieldCheckIcon size="sm" />
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <div className="upload-reference__tip">
          <img src={aiReviewAssets.aiRobotIllustration} alt="" aria-hidden="true" />
          <div>
            <strong>{copy.aiReviewTitle}</strong>
            <p>{copy.aiReviewBody}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

