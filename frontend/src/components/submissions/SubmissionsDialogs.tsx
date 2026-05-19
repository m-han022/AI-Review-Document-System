import type { Project } from "../../types";
import ConfirmDialog from "../ui/ConfirmDialog";
import ProjectCreateDialog from "../project/ProjectCreateDialog";
import ProjectEditDialog from "../project/ProjectEditDialog";

interface PendingDelete {
  description: string;
  details: string[];
}

interface Props {
  pendingDelete: PendingDelete | null;
  deletingId: string | null;
  editingProject: Project | null;
  showCreateDialog: boolean;
  t: (key: string) => string;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
}

export default function SubmissionsDialogs({
  pendingDelete,
  deletingId,
  editingProject,
  showCreateDialog,
  t,
  onConfirmDelete,
  onCancelDelete,
  onCloseCreate,
  onCloseEdit,
}: Props) {
  return (
    <>
      {pendingDelete && (
        <ConfirmDialog
          open={!!pendingDelete}
          title={t("submissions.deleteConfirmTitle")}
          description={pendingDelete.description}
          details={pendingDelete.details}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          isLoading={deletingId !== null}
        />
      )}

      <ProjectCreateDialog open={showCreateDialog} onClose={onCloseCreate} />

      <ProjectEditDialog open={!!editingProject} project={editingProject} onClose={onCloseEdit} />
    </>
  );
}

