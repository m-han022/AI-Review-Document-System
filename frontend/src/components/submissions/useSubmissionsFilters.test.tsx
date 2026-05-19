import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSubmissionsFilters } from "./useSubmissionsFilters";

describe("useSubmissionsFilters", () => {
  it("initializes with default filters", () => {
    const { result } = renderHook(() => useSubmissionsFilters());
    expect(result.current.searchQuery).toBe("");
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.languageFilter).toBe("all");
  });

  it("updates filter values", () => {
    const { result } = renderHook(() => useSubmissionsFilters());
    act(() => {
      result.current.setSearchQuery("alpha");
      result.current.setStatusFilter("completed");
      result.current.setLanguageFilter("vi");
    });
    expect(result.current.searchQuery).toBe("alpha");
    expect(result.current.statusFilter).toBe("completed");
    expect(result.current.languageFilter).toBe("vi");
  });
});

