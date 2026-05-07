import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "../../api/client";
import { projectsQueryKey } from "../../query";
import { useTranslation } from "../LanguageSelector";
import Dialog from "../ui/Dialog";
import { Input } from "../ui/Input";

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
      title={titleText}
      onConfirm={handleSave}
      onCancel={onClose}
      confirmLabel={createText}
      cancelLabel={cancelText}
      isLoading={loading}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {error && (
          <div style={{ 
            padding: '12px', borderRadius: 'var(--ds-radius-md)', 
            backgroundColor: 'var(--ds-color-danger-light)', 
            color: 'var(--ds-color-danger)', fontSize: '13px' 
          }}>
            {error}
          </div>
        )}
        
        <Input
          label="ID (e.g. P123)"
          value={id}
          onChange={(e) => setId(e.target.value.toUpperCase())}
          placeholder="P001"
          required
        />

        <Input
          label={nameText}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("project.namePlaceholder") || "Tên dự án..."}
          required
        />

        <div className="ds-input-group">
          <label className="ds-input-label">{descText}</label>
          <textarea
            className="ds-input ds-input--textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("project.descPlaceholder") || "Mô tả chi tiết dự án..."}
            rows={4}
          />
        </div>
      </div>
    </Dialog>
  );
}
