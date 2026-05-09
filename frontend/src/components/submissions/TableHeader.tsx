import { useTranslation } from "../LanguageSelector";

interface TableHeaderProps {
  showCheckbox: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
}

export default function TableHeader({ showCheckbox, allSelected, onToggleSelectAll }: TableHeaderProps) {
  const { t } = useTranslation();

  return (
    <thead>
      <tr>
        {showCheckbox && (
          <th style={{ width: "40px" }}>
            <input
              type="checkbox"
              className="ds-checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
            />
          </th>
        )}
        <th>{t("submissions.projectId")} / {t("submissions.projectName")}</th>
        <th>{t("submissions.documents")}</th>
        <th>{t("submissions.status")}</th>
        <th>{t("submissions.score")}</th>
        <th>{t("submissions.lastUpdated")}</th>
        <th style={{ textAlign: "right" }}>{t("common.actions")}</th>
      </tr>
    </thead>
  );
}
