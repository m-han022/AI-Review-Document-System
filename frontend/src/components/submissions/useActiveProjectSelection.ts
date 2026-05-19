import { useEffect, useMemo, useState } from "react";
import type { Project } from "../../types";

interface Params {
  projects: Project[];
  controlledActiveProjectId?: string | null;
}

export function useActiveProjectSelection({ projects, controlledActiveProjectId }: Params) {
  const [internalActiveProjectId, setInternalActiveProjectId] = useState<string | null>(
    projects[0]?.project_id ?? null,
  );

  const activeProjectId = useMemo(
    () => controlledActiveProjectId ?? internalActiveProjectId,
    [controlledActiveProjectId, internalActiveProjectId],
  );

  useEffect(() => {
    if (!projects.length) {
      setInternalActiveProjectId(null);
      return;
    }
    if (!activeProjectId || !projects.some((item) => item.project_id === activeProjectId)) {
      setInternalActiveProjectId(projects[0].project_id);
    }
  }, [activeProjectId, projects]);

  return {
    activeProjectId,
    setInternalActiveProjectId,
  };
}

