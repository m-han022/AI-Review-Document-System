import { useTranslation } from "../LanguageSelector";

interface TableHeaderProps {
  showCheckbox: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  variant?: "full" | "dashboard" | "reference";
}

export default function TableHeader({ showCheckbox, allSelected, onToggleSelectAll }: TableHeaderProps) {
  const { t, lang } = useTranslation();
  const isJa = lang === "ja";

  return (
    <thead>
      <tr>
        {showCheckbox ? (
          <th style={{ width: "40px" }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
          </th>
        ) : null}
        <th>{isJa ? "Project ID / Name" : "Mã / Tên Dự án"}</th>
        <th>{isJa ? "Total Documents" : "Tổng tài liệu"}</th>
        <th>{isJa ? "Latest Score" : "Điểm mới nhất"}</th>
        <th>{isJa ? "Last Updated" : "Cập nhật cuối"}</th>
        <th style={{ textAlign: "center" }}>{t("common.actions")}</th>
      </tr>
    </thead>
  );
}
