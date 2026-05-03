import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

  const updateMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      const res = await fetch(`/api/projects/${project?.project_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: payload.name,
          project_description: payload.description,
        }),
      });
      if (!res.ok) throw new Error("Failed to update project");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      onClose();
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
      title={t("project.editTitle") || "Chỉnh sửa dự án"}
      onConfirm={handleSave}
      onCancel={onClose}
      confirmLabel={t("common.save") || "Lưu"}
      cancelLabel={t("common.cancel") || "Hủy"}
      pending={loading}
    >
      <div className="prod-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
        <div className="prod-field">
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>ID</label>
          <input className="prod-input" value={project.project_id} disabled style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#f5f5f5' }} />
        </div>
        <div className="prod-field">
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>{t("project.name") || "Tên dự án"}</label>
          <input 
            className="prod-input" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
        </div>
        <div className="prod-field">
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>{t("project.description") || "Mô tả"}</label>
          <textarea 
            className="prod-textarea" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            style={{ width: '100%', minHeight: '100px', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
        </div>
      </div>
    </Dialog>
  );
}
