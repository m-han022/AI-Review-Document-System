import { describe, expect, it } from "vitest";
import type { Project } from "../../types";
import { paginateProjects, resolvePageSize } from "./tablePagination";

const sample: Project[] = [
  { project_id: "P001", project_name: "Alpha", total_documents: 1, latest_score: 90 } as Project,
  { project_id: "P002", project_name: "Beta", total_documents: 2, latest_score: null } as Project,
  { project_id: "P003", project_name: "Gamma", total_documents: 3, latest_score: 70 } as Project,
];

describe("tablePagination helpers", () => {
  it("resolves page size by variant", () => {
    expect(resolvePageSize("dashboard")).toBe(5);
    expect(resolvePageSize("full")).toBe(10);
    expect(resolvePageSize("reference")).toBe(20);
  });

  it("paginates by page and page size", () => {
    expect(paginateProjects(sample, 1, 2).map((p) => p.project_id)).toEqual(["P001", "P002"]);
    expect(paginateProjects(sample, 2, 2).map((p) => p.project_id)).toEqual(["P003"]);
  });
});

