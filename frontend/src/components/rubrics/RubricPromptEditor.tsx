import { Button, Card, StatusBadge } from "../ui";

interface RubricPromptEditorProps {
  title: string;
  subtitle: string;
  promptValue: string;
  placeholder: string;
  onPromptChange: (value: string) => void;
  onSave: () => void;
  saveLabel: string;
  saveDisabled: boolean;
  saveLoading: boolean;
  message: { type: "success" | "error"; text: string } | null;
}

const TEXTAREA_STYLE = {
  width: "100%",
  padding: "12px",
  borderRadius: "var(--ds-radius-md)",
  border: "1px solid var(--ds-color-border)",
  fontFamily: "var(--ds-font-mono)",
  fontSize: "13px",
  lineHeight: "1.5",
  backgroundColor: "var(--ds-color-bg-main)",
  color: "var(--ds-color-text-main)",
} as const;

export default function RubricPromptEditor({
  title,
  subtitle,
  promptValue,
  placeholder,
  onPromptChange,
  onSave,
  saveLabel,
  saveDisabled,
  saveLoading,
  message,
}: RubricPromptEditorProps) {
  return (
    <Card title={title} subtitle={subtitle}>
      <textarea
        value={promptValue}
        onChange={(e) => onPromptChange(e.target.value)}
        rows={15}
        style={TEXTAREA_STYLE}
        placeholder={placeholder}
      />
      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={onSave} disabled={saveDisabled} isLoading={saveLoading}>
          {saveLabel}
        </Button>
      </div>
      {message && (
        <div style={{ marginTop: "12px" }}>
          <StatusBadge tone={message.type === "success" ? "success" : "danger"}>{message.text}</StatusBadge>
        </div>
      )}
    </Card>
  );
}
