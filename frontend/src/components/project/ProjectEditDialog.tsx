import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProject } from "../../api/client";
import { projectsQueryKey } from "../../query";
import { useTranslation } from "../LanguageSelector";
import Dialog from "../ui/Dialog";
import { Input } from "../ui/Input";

interface ProjectEditDialogProps {
  open: boolean;
  onClose: () => void;
  project: {
    project_id: string;
    project_name: string;
    project_description?: string | null;
  } | null;
}

export default function ProjectEditDialog({ open, onClose, project }: ProjectEditDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(project?.project_name ?? "");
  const [description, setDescription] = useState(project?.project_description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(project?.project_name ?? "");
    setDescription(project?.project_description ?? "");
    setError(null);
  }, [project, open]);

  const titleText = t("project.editTitle");
  const nameText = t("project.name");
  const descText = t("project.description");
  const saveText = t("common.save");
  const cancelText = t("common.cancel");

  const updateMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      if (!project?.project_id) throw new Error("Project not found");
      return updateProject(project.project_id, {
        project_name: payload.name,
        project_description: payload.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      setError(null);
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to update project");
    },
  });

  const handleSave = async () => {
    if (!name) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    try {
      await updateMutation.mutateAsync({ name, description });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog
      open={open}
      title={titleText}
      onConfirm={handleSave}
      onCancel={onClose}
      confirmLabel={saveText}
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
          label="ID"
          value={project.project_id}
          disabled
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
