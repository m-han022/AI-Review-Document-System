import { useTranslation } from "../LanguageSelector";

interface TableHeaderProps {
  showCheckbox: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
}

export default function TableHeader({
  showCheckbox,
  allSelected,
  onToggleSelectAll,
}: TableHeaderProps) {
  const { t } = useTranslation();

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
        <th>{t("upload.documentType")}</th>
        <th>{t("common.language")}</th>
        <th>{t("common.status")}</th>
        <th>{t("submissions.score")}</th>
        <th>{t("common.uploadedAt")}</th>
        <th>{t("common.actions")}</th>
      </tr>
    </thead>
  );
}
