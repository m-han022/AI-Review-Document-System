import type { DocumentType } from "../../constants/documentTypes";
import { DOCUMENT_TYPE_OPTIONS } from "../../constants/documentTypes";
import type { RubricVersion } from "../../types";
import { Button, Card, Select, StatusBadge } from "../ui";
import { PlusIcon } from "../ui/Icon";

interface RubricSidebarProps {
  t: (key: string) => string;
  documentType: DocumentType;
  onDocumentTypeChange: (value: DocumentType) => void;
  activeVersion: string;
  criteriaCount: number;
  totalScore: number;
  documentRubrics: RubricVersion[];
  selectedVersion: string;
  onSelectVersion: (version: string) => void;
  onCreateNewVersion: () => void;
  onActivate: () => void;
  canActivate: boolean;
  activating: boolean;
}

export default function RubricSidebar({
  t,
  documentType,
  onDocumentTypeChange,
  activeVersion,
  criteriaCount,
  totalScore,
  documentRubrics,
  selectedVersion,
  onSelectVersion,
  onCreateNewVersion,
  onActivate,
  canActivate,
  activating,
}: RubricSidebarProps) {
  return (
    <aside className="governance-explorer__sidebar">
      <div style={{ marginBottom: "16px" }}>
        <Card title={t("upload.documentType")}>
          <Select
            value={documentType}
            onChange={(e) => onDocumentTypeChange(e.target.value as DocumentType)}
            options={DOCUMENT_TYPE_OPTIONS.map((opt) => ({ value: opt.id, label: t(opt.labelKey) }))}
          />
        </Card>
      </div>

      <Card title={t("rubric.activeSummary")}>
        <div className="detail-section">
          <span className="detail-section__title">{t("rubric.activeVersion")}</span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "18px" }}>{activeVersion}</strong>
            <StatusBadge tone="success">{t("rubric.active")}</StatusBadge>
          </div>
        </div>
        <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className="detail-section">
            <span className="detail-section__title">{t("rubric.criteria")}</span>
            <strong>{criteriaCount}</strong>
          </div>
          <div className="detail-section">
            <span className="detail-section__title">{t("upload.overallScore")}</span>
            <strong>{totalScore}</strong>
          </div>
        </div>
      </Card>

      <Card title={t("rubric.versionList")}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
          {documentRubrics.map((rubric) => (
            <button
              key={`${rubric.document_type}-${rubric.version}`}
              type="button"
              className={`submission-card__button ${rubric.version === selectedVersion ? "is-active" : ""}`}
              style={{ textAlign: "left", width: "100%" }}
              onClick={() => onSelectVersion(rubric.version)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600 }}>{rubric.version}</div>
                {rubric.active && <StatusBadge tone="success">{t("rubric.active")}</StatusBadge>}
              </div>
              <div style={{ fontSize: "11px", color: "var(--ds-color-text-muted)" }}>
                {rubric.criteria.length} {t("rubric.criteria")}
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <Button variant="outline" size="sm" onClick={onCreateNewVersion} fullWidth>
            <PlusIcon size="sm" />
            {t("rubric.createVersion")}
          </Button>
          <Button variant="primary" size="sm" onClick={onActivate} disabled={!canActivate} isLoading={activating} fullWidth>
            {t("rubric.activate")}
          </Button>
        </div>
      </Card>
    </aside>
  );
}
