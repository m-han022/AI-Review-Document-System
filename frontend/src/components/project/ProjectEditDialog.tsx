import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProject } from "../../api/client";
import { projectsQueryKey } from "../../query";
import { useTranslation } from "../LanguageSelector";
import Dialog from "../ui/Dialog";

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
      title={titleText === "project.editTitle" ? "Chỉnh sửa dự án" : titleText}
      onConfirm={handleSave}
      onCancel={onClose}
      confirmLabel={saveText === "common.save" ? "Lưu" : saveText}
      cancelLabel={cancelText === "common.cancel" ? "Hủy" : cancelText}
      pending={loading}
    >
      <div className="prod-edit-form" style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
        {error && <div style={{ color: "#ef4444", fontSize: "14px" }}>{error}</div>}
        <div className="prod-field">
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>ID</label>
          <input className="prod-input" value={project.project_id} disabled style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", backgroundColor: "#f5f5f5" }} />
        </div>
        <div className="prod-field">
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>{nameText === "project.name" ? "Tên dự án" : nameText}</label>
          <input
            className="prod-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          />
        </div>
        <div className="prod-field">
          <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>{descText === "project.description" ? "Mô tả" : descText}</label>
          <textarea
            className="prod-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%", minHeight: "100px", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          />
        </div>
      </div>
    </Dialog>
  );
}
