import type { LanguageCode, Project } from "../../types";

export function filterProjects(
  projects: Project[],
  searchQuery: string,
  statusFilter: "all" | "completed" | "pending",
  languageFilter: LanguageCode | "all",
): Project[] {
  const query = searchQuery.trim().toLowerCase();
  return projects.filter((project) => {
    const matchesSearch =
      !query ||
      project.project_id.toLowerCase().includes(query) ||
      project.project_name.toLowerCase().includes(query);

    const isCompleted = project.latest_score !== null;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && isCompleted) ||
      (statusFilter === "pending" && !isCompleted);

    const matchesLanguage =
      languageFilter === "all" ||
      ((project as { language?: LanguageCode }).language ?? "all") === languageFilter;

    return matchesSearch && matchesStatus && matchesLanguage;
  });
}

