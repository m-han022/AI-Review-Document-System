import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsQueryKey } from "../../query";
import { useTranslation } from "../LanguageSelector";
import Dialog from "../ui/Dialog";

interface ProjectCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ProjectCreateDialog({ open, onClose }: ProjectCreateDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; description: string }) => {
      const res = await fetch(`/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: payload.id,
          project_name: payload.name,
          project_description: payload.description,
        }),
      });
      if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      onClose();
      setId("");
      setName("");
      setDescription("");
      setError(null);
    },
    onError: (err: any) => {
        setError(err.message);
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
      title={t("project.createTitle") || "Tạo dự án mới"}
      onConfirm={handleSave}
      onCancel={onClose}
      confirmLabel={t("common.create") || "Tạo"}
      cancelLabel={t("common.cancel") || "Hủy"}
      pending={loading}
    >
      <div className="prod-edit-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
        {error && <div style={{ color: '#ef4444', fontSize: '14px' }}>{error}</div>}
        <div className="prod-field">
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>ID (e.g. P123)</label>
          <input 
            className="prod-input" 
            value={id} 
            onChange={(e) => setId(e.target.value.toUpperCase())} 
            placeholder="P001"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
        </div>
        <div className="prod-field">
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>{t("project.name") || "Tên dự án"}</label>
          <input 
            className="prod-input" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Tên dự án..."
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
        </div>
        <div className="prod-field">
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>{t("project.description") || "Mô tả"}</label>
          <textarea 
            className="prod-textarea" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Mô tả chi tiết dự án..."
            style={{ width: '100%', minHeight: '100px', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} 
          />
        </div>
      </div>
    </Dialog>
  );
}
