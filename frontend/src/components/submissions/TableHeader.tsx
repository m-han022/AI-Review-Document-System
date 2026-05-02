import { useTranslation } from "../LanguageSelector";

interface TableHeaderProps {
  showCheckbox: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  variant?: "full" | "dashboard" | "reference";
}

export default function TableHeader({
  showCheckbox,
  allSelected,
  onToggleSelectAll,
  variant = "full",
}: TableHeaderProps) {
  const { t } = useTranslation();
  const isReferenceVariant = variant === "reference";

  return (
    <thead>
      <tr>
        {showCheckbox ? (
          <th className="review-table__checkbox">
            <span className="review-table__checkbox-inner">
              <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
            </span>
          </th>
        ) : null}
        <th>{t("submissions.filename")}</th>
        <th>{isReferenceVariant ? "ファイルタイプ" : t("upload.documentType")}</th>
        <th>{isReferenceVariant ? "言語" : t("common.language")}</th>
        <th>{isReferenceVariant ? "ステータス" : t("common.status")}</th>
        <th>{isReferenceVariant ? "総合スコア" : t("submissions.score")}</th>
        <th>{isReferenceVariant ? "アップロード日時" : t("common.uploadedAt")}</th>
        <th>{t("common.actions")}</th>
      </tr>
    </thead>
  );
}
