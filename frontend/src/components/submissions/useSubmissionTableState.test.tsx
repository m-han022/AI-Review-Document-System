import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSubmissionTableState } from "./useSubmissionTableState";

describe("useSubmissionTableState", () => {
  it("toggles selection and clears/selects ids", () => {
    const { result } = renderHook(() => useSubmissionTableState());

    act(() => {
      result.current.toggleSelect("P001");
    });
    expect(Array.from(result.current.selectedIds)).toEqual(["P001"]);

    act(() => {
      result.current.toggleSelect("P001");
    });
    expect(result.current.selectedIds.size).toBe(0);

    act(() => {
      result.current.selectIds(["P001", "P002"]);
    });
    expect(Array.from(result.current.selectedIds)).toEqual(["P001", "P002"]);

    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("navigates pages with boundaries", () => {
    const { result } = renderHook(() => useSubmissionTableState());
    expect(result.current.currentPage).toBe(1);

    act(() => {
      result.current.goPreviousPage();
    });
    expect(result.current.currentPage).toBe(1);

    act(() => {
      result.current.goNextPage(3);
      result.current.goNextPage(3);
      result.current.goNextPage(3);
    });
    expect(result.current.currentPage).toBe(3);

    act(() => {
      result.current.goPreviousPage();
    });
    expect(result.current.currentPage).toBe(2);
  });
});

