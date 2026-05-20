import { Card, Select, StatusBadge } from "../ui";

interface CriteriaDiffItem {
  key: string;
  type: "added" | "removed" | "changed" | "unchanged";
  currentMax: number | null;
  compareMax: number | null;
  currentLabel: string;
  compareLabel: string;
}

interface RubricComparePanelProps {
  title: string;
  compareVersionHint: string;
  compareVersionNone: string;
  compareVersion: string;
  compareCandidates: Array<{ value: string; label: string }>;
  onCompareVersionChange: (value: string) => void;
  compareRubricVersion: string | null;
  diffAddedLabel: string;
  diffChangedLabel: string;
  promptChangedLabel: string;
  yesLabel: string;
  noLabel: string;
  diffSummary: { added: number; changed: number };
  promptChanged: boolean;
  criteriaDiff: CriteriaDiffItem[];
  currentVersion: string;
  currentPrompt: string;
  comparePrompt: string;
  diffTypeLabel: (type: CriteriaDiffItem["type"]) => string;
}

const PROMPT_PRE_STYLE = {
  padding: "12px",
  backgroundColor: "var(--ds-color-bg-muted)",
  borderRadius: "var(--ds-radius-md)",
  fontSize: "11px",
  whiteSpace: "pre-wrap" as const,
  maxHeight: "300px",
  overflowY: "auto" as const,
} as const;

export default function RubricComparePanel({
  title,
  compareVersionHint,
  compareVersionNone,
  compareVersion,
  compareCandidates,
  onCompareVersionChange,
  compareRubricVersion,
  diffAddedLabel,
  diffChangedLabel,
  promptChangedLabel,
  yesLabel,
  noLabel,
  diffSummary,
  promptChanged,
  criteriaDiff,
  currentVersion,
  currentPrompt,
  comparePrompt,
  diffTypeLabel,
}: RubricComparePanelProps) {
  return (
    <Card title={title}>
      <div style={{ marginBottom: "16px" }}>
        <Select
          label={compareVersionHint}
          value={compareVersion}
          onChange={(e) => onCompareVersionChange(e.target.value)}
          options={[{ value: "", label: compareVersionNone }, ...compareCandidates]}
        />
      </div>

      {compareRubricVersion && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="governance-grid">
            <div className="detail-section">
              <span className="detail-section__title">{diffAddedLabel}</span>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{diffSummary.added}</div>
            </div>
            <div className="detail-section">
              <span className="detail-section__title">{diffChangedLabel}</span>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{diffSummary.changed}</div>
            </div>
            <div className="detail-section">
              <span className="detail-section__title">{promptChangedLabel}</span>
              <StatusBadge tone={promptChanged ? "warning" : "success"}>
                {promptChanged ? yesLabel : noLabel}
              </StatusBadge>
            </div>
          </div>

          <div className="rubric-diff-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {criteriaDiff.map((item) => (
              <div
                key={item.key}
                style={{
                  padding: "16px",
                  borderRadius: "var(--ds-radius-md)",
                  border: "1px solid var(--ds-color-border)",
                  backgroundColor: "var(--ds-color-bg-muted)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <strong style={{ fontSize: "14px" }}>{item.key}</strong>
                  <StatusBadge tone={item.type === "added" ? "success" : item.type === "removed" ? "danger" : item.type === "changed" ? "warning" : "muted"}>
                    {diffTypeLabel(item.type)}
                  </StatusBadge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                  <div>
                    <div style={{ color: "var(--ds-color-text-muted)" }}>{currentVersion}</div>
                    <div style={{ fontWeight: 600 }}>{item.currentLabel}</div>
                    <div>{item.currentMax ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--ds-color-text-muted)" }}>{compareRubricVersion}</div>
                    <div style={{ fontWeight: 600 }}>{item.compareLabel}</div>
                    <div>{item.compareMax ?? "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="detail-section">
              <span className="detail-section__title">{currentVersion} Prompt</span>
              <pre style={PROMPT_PRE_STYLE}>{currentPrompt || "—"}</pre>
            </div>
            <div className="detail-section">
              <span className="detail-section__title">{compareRubricVersion} Prompt</span>
              <pre style={PROMPT_PRE_STYLE}>{comparePrompt || "—"}</pre>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
