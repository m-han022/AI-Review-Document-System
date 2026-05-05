import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "../../api/client";
import { projectsQueryKey } from "../../query";
import { useTranslation } from "../LanguageSelector";
import Dialog from "../ui/Dialog";

interface ProjectCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (project: { project_id: string; project_name: string; project_description?: string | null }) => void;
}

export default function ProjectCreateDialog({ open, onClose, onCreated }: ProjectCreateDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleText = t("project.createTitle");
  const nameText = t("project.name");
  const descText = t("project.description");
  const createText = t("common.create");
  const cancelText = t("common.cancel");

  const createMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; description: string }) => {
      return createProject({
        project_id: payload.id,
        project_name: payload.name,
        project_description: payload.description,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      onCreated?.(created);
      onClose();
      setId("");
      setName("");
      setDescription("");
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to create project");
    }
  });

  const handleSave = async () => {
    if (!id || !name) {
      setError("ID and Name are required");
      return;
    }
    setLoading(true);
    try {
      await createMutation.mutateAsync({ id, name, description });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={titleText === "project.createTitle" ? "Tạo dự án mới" : titleText}
      onConfirm={handleSave}
      onCancel={onClose}
      confirmLabel={createText === "common.create" ? "Tạo" : createText}
      cancelLabel={cancelText === "common.cancel" ? "Hủy" : cancelText}
      pending={loading}
    >
      <div className="prod-edit-form" style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
        {error && <div style={{ color: "#ef4444", fontSize: "14px" }}>{error}</div>}
        <div className="prod-field">
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>ID (e.g. P123)</label>
          <input
            className="prod-input"
            value={id}
            onChange={(e) => setId(e.target.value.toUpperCase())}
            placeholder="P001"
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          />
        </div>
        <div className="prod-field">
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>{nameText === "project.name" ? "Tên dự án" : nameText}</label>
          <input
            className="prod-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên dự án..."
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          />
        </div>
        <div className="prod-field">
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>{descText === "project.description" ? "Mô tả" : descText}</label>
          <textarea
            className="prod-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả chi tiết dự án..."
            style={{ width: "100%", minHeight: "100px", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          />
        </div>
      </div>
    </Dialog>
  );
}
