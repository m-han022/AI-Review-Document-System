import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, listProjects } from "../../api/client";
import { projectsQueryKey } from "../../query";
import { useTranslation } from "../LanguageSelector";
import BaseModal from "../ui/BaseModal";
import { Button } from "../ui";
import { Input } from "../ui/Input";
import { FieldError } from "../ui/States";

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

  // Fetch existing projects to suggest next ID
  const { data: existingProjects } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => listProjects(1000, 0),
    enabled: open,
  });

  useEffect(() => {
    if (open && existingProjects && !id) {
      // Suggest next ID based on pattern Pxxx
      const pIds = existingProjects
        .map(p => p.project_id)
        .filter(pid => /^P\d+$/.test(pid))
        .map(pid => {
          const m = pid.match(/\d+/);
          return m ? parseInt(m[0]) : 0;
        });
      
      const maxId = pIds.length > 0 ? Math.max(...pIds) : 0;
      const nextId = `P${String(maxId + 1).padStart(3, '0')}`;
      setId(nextId);
    }
  }, [open, existingProjects, id]);

  useEffect(() => {
    if (!open) {
      setId("");
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

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
      const msg = err?.message || "";
      if (msg.includes("already exists")) {
        setError(t("project.errorAlreadyExists") || `Project ID ${id} đã tồn tại. Vui lòng chọn ID khác.`);
      } else {
        setError(msg || "Failed to create project");
      }
    }
  });

  const handleSave = async () => {
    setError(null);
    if (!id || !name) {
      setError("ID and Name are required");
      return;
    }
    setLoading(true);
    try {
      await createMutation.mutateAsync({ id, name, description });
    } catch (err) {
      // Error handled by useMutation onError
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={titleText}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading} size="md">
            {cancelText}
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={loading} size="md">
            {createText}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <FieldError message={error} />
        
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
            style={{ minHeight: '120px' }}
          />
        </div>
      </div>
    </BaseModal>
  );
}
