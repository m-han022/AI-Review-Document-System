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
  const { t, lang } = useTranslation();
  const isJa = lang === "ja";
  const isReferenceVariant = variant === "reference";

  if (!isReferenceVariant) {
    // Standard header remains for other variants
  }

  return (
    <thead>
      <tr>
        {showCheckbox ? (
          <th style={{ width: '40px' }}>
            <input 
              type="checkbox" 
              checked={allSelected} 
              onChange={onToggleSelectAll} 
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </th>
        ) : null}
        <th>{t("submissions.filename")}</th>
        <th>{isJa ? "資料種別" : "Loại tài liệu"}</th>
        <th>{isJa ? "言語" : "Ngôn ngữ"}</th>
        <th>{isJa ? "状態" : "Trạng thái"}</th>
        <th>{isJa ? "スコア" : "Điểm số"}</th>
        <th>{isJa ? "アップロード日時" : "Ngày tải lên"}</th>
        <th style={{ textAlign: 'center' }}>{t("common.actions")}</th>
      </tr>
    </thead>
  );
}
