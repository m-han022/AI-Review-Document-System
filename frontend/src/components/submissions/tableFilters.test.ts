import { describe, expect, it } from "vitest";

import type { Project } from "../../types";
import { filterProjects } from "./tableFilters";
import { paginateProjects, resolvePageSize } from "./tablePagination";

const sample: Project[] = [
  { project_id: "P001", project_name: "Alpha", total_documents: 2, latest_score: 90 } as Project,
  { project_id: "P002", project_name: "Beta", total_documents: 1, latest_score: null } as Project,
  { project_id: "P003", project_name: "Gamma", total_documents: 3, latest_score: 70 } as Project,
];

describe("submissions table helpers", () => {
  it("filters by search and status", () => {
    const bySearch = filterProjects(sample, "alp", "all", "all");
    expect(bySearch).toHaveLength(1);
    expect(bySearch[0].project_id).toBe("P001");

    const completed = filterProjects(sample, "", "completed", "all");
    expect(completed.map((p) => p.project_id)).toEqual(["P001", "P003"]);
  });

  it("resolves page size and paginates safely", () => {
    expect(resolvePageSize("dashboard")).toBe(5);
    expect(resolvePageSize("full")).toBe(10);
    expect(resolvePageSize("reference")).toBe(20);

    const paged = paginateProjects(sample, 1, 2);
    expect(paged.map((p) => p.project_id)).toEqual(["P001", "P002"]);
  });
});

