import type { Project } from "../../types";
import TableFooter from "./TableFooter";
import TableHeader from "./TableHeader";
import TableRow from "./TableRow";
import SubmissionsEmptyRow from "./SubmissionsEmptyRow";

interface Props {
  variant: "full" | "dashboard" | "reference";
  pagedProjects: Project[];
  selectedIds: Set<string>;
  activeProjectId: string | null;
  gradingId: string | null;
  deletingId: string | null;
  isActionPending: boolean;
  currentPage: number;
  totalPages: number;
  totalFilteredCount: number;
  countLabel: string;
  noSubmissionsLabel: string;
  noSubmissionsDesc: string;
  createProjectLabel: string;
  onCreateProject: () => void;
  onToggleSelectAll: () => void;
  onSelectProject: (projectId: string) => void;
  onToggleSelect: (projectId: string) => void;
  onGrade: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onEdit: (project: Project) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export default function SubmissionsTableSection({
  variant,
  pagedProjects,
  selectedIds,
  activeProjectId,
  gradingId,
  deletingId,
  isActionPending,
  currentPage,
  totalPages,
  totalFilteredCount,
  countLabel,
  noSubmissionsLabel,
  noSubmissionsDesc,
  createProjectLabel,
  onCreateProject,
  onToggleSelectAll,
  onSelectProject,
  onToggleSelect,
  onGrade,
  onDelete,
  onEdit,
  onPreviousPage,
  onNextPage,
}: Props) {
  const isDashboardVariant = variant === "dashboard";
  const isReferenceVariant = variant === "reference";

  return (
    <div className="ds-table-container">
      <table className={`ds-table ${isDashboardVariant || isReferenceVariant ? "ds-table--compact" : ""}`}>
        <TableHeader
          allSelected={pagedProjects.length > 0 && selectedIds.size === pagedProjects.length}
          onToggleSelectAll={onToggleSelectAll}
          showCheckbox={!isDashboardVariant}
        />
        <tbody>
          {pagedProjects.length ? (
            pagedProjects.map((project) => (
              <TableRow
                key={project.project_id}
                project={project}
                isActive={project.project_id === activeProjectId}
                isSelected={selectedIds.has(project.project_id)}
                showCheckbox={!isDashboardVariant}
                gradingId={gradingId}
                deletingId={deletingId}
                isActionPending={isActionPending}
                onSelect={onSelectProject}
                onToggleSelect={onToggleSelect}
                onGrade={onGrade}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))
          ) : (
            <SubmissionsEmptyRow
              title={noSubmissionsLabel}
              description={noSubmissionsDesc}
              createLabel={createProjectLabel}
              onCreate={onCreateProject}
            />
          )}
        </tbody>
      </table>

      {!isDashboardVariant && (
        <TableFooter
          totalCount={totalFilteredCount}
          resultSummary={countLabel}
          currentPage={currentPage}
          canGoPrevious={currentPage > 1}
          canGoNext={currentPage < totalPages}
          onPrevious={onPreviousPage}
          onNext={onNextPage}
          variant={isReferenceVariant ? "reference" : "default"}
        />
      )}
    </div>
  );
}

