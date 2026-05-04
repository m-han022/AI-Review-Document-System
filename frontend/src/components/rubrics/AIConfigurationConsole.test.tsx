import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AIConfigurationConsole from "./AIConfigurationConsole";
import * as client from "../../api/client";

vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof client>("../../api/client");
  return {
    ...actual,
    listMgmtRubrics: vi.fn(),
    listMgmtPrompts: vi.fn(),
    listMgmtPolicies: vi.fn(),
    getRequiredRules: vi.fn(),
    listEvaluationSets: vi.fn(),
    getActiveEvaluationSet: vi.fn(),
    previewFinalPrompt: vi.fn(),
    createEvaluationSet: vi.fn(),
  };
});

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AIConfigurationConsole />
    </QueryClientProvider>,
  );
}

describe("AIConfigurationConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(client.listMgmtRubrics).mockResolvedValue([
      {
        id: 1,
        document_type: "project-review",
        version: "v1",
        status: "active",
        active: true,
        prompt: { vi: "rubric_v1" },
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        hash: "rh1",
        summary: "1 criteria",
      },
    ]);
    vi.mocked(client.listMgmtPrompts).mockResolvedValue([
      {
        id: 10,
        document_type: "project-review",
        level: "medium",
        version: "v1",
        content: "prompt_v1",
        status: "active",
        created_at: "2026-01-01",
        hash: "ph1",
      },
      {
        id: 11,
        document_type: "project-review",
        level: "medium",
        version: "v2",
        content: "prompt_v2",
        status: "archived",
        created_at: "2026-01-02",
        hash: "ph2",
      },
    ]);
    vi.mocked(client.listMgmtPolicies).mockResolvedValue([
      {
        id: 20,
        level: "medium",
        version: "v1",
        content: "policy_v1",
        status: "active",
        created_at: "2026-01-01",
        hash: "poh1",
      },
    ]);
    vi.mocked(client.getRequiredRules).mockResolvedValue({
      rules: ["JSON only", "No markdown"],
      hash: "rules-hash",
    });
    vi.mocked(client.listEvaluationSets).mockResolvedValue([
      {
        id: 100,
        name: "project-review-medium-set-v1",
        document_type: "project-review",
        level: "medium",
        rubric_version_id: 1,
        prompt_version_id: 10,
        policy_version_id: 20,
        required_rules_version: "system-rules-v1",
        required_rule_hash: "rules-hash",
        version_label: "project-review-medium-set-v1",
        status: "active",
        created_at: "2026-01-01",
      },
      {
        id: 101,
        name: "project-review-medium-set-v2",
        document_type: "project-review",
        level: "medium",
        rubric_version_id: 1,
        prompt_version_id: 11,
        policy_version_id: 20,
        required_rules_version: "system-rules-v1",
        required_rule_hash: "rules-hash",
        version_label: "project-review-medium-set-v2",
        status: "archived",
        created_at: "2026-01-02",
      },
    ]);
    vi.mocked(client.getActiveEvaluationSet).mockResolvedValue({
      id: 100,
      name: "project-review-medium-set-v1",
      document_type: "project-review",
      level: "medium",
      rubric_version_id: 1,
      prompt_version_id: 10,
      policy_version_id: 20,
      required_rules_version: "system-rules-v1",
      required_rule_hash: "rules-hash",
      version_label: "project-review-medium-set-v1",
      status: "active",
      created_at: "2026-01-01",
    });
    vi.mocked(client.previewFinalPrompt).mockResolvedValue({
      document_type: "project-review",
      level: "medium",
      rubric_version: "v1",
      rubric_hash: "rh1",
      prompt_version: "v1",
      prompt_hash: "ph1",
      policy_version: "v1",
      policy_hash: "poh1",
      required_rule_hash: "rules-hash",
      full_prompt_preview: "PREVIEW_CONTENT",
    });
    vi.mocked(client.createEvaluationSet).mockResolvedValue({
      id: 102,
      name: "new-set",
      document_type: "project-review",
      level: "medium",
      rubric_version_id: 1,
      prompt_version_id: 11,
      policy_version_id: 20,
      required_rules_version: "system-rules-v1",
      required_rule_hash: "rules-hash",
      version_label: "project-review-medium-set-v3",
      status: "active",
      created_at: "2026-01-03",
    });
  });

  it("renders console and loads core sections", async () => {
    renderWithQueryClient();
    expect(await screen.findByText("AI Configuration Console")).toBeInTheDocument();
    expect(screen.getByText("Active Evaluation Set")).toBeInTheDocument();
    expect(screen.getByText("Compare Sets")).toBeInTheDocument();
  });

  it("previews final prompt", async () => {
    renderWithQueryClient();
    const previewBtn = await screen.findByRole("button", { name: "Preview Final Prompt" });
    fireEvent.click(previewBtn);
    expect(await screen.findByText("Final Prompt Preview")).toBeInTheDocument();
    expect(await screen.findByText("PREVIEW_CONTENT")).toBeInTheDocument();
  });

  it("creates new set from current", async () => {
    renderWithQueryClient();
    fireEvent.click(await screen.findByRole("button", { name: "Create New Set from Current" }));
    expect(await screen.findByText("Set Changes")).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: "Save and Activate" });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(client.createEvaluationSet).toHaveBeenCalledTimes(1);
    });
  });

  it("renders diff highlight when selecting two sets", async () => {
    renderWithQueryClient();
    const selects = await screen.findAllByRole("combobox");
    fireEvent.change(selects[2], { target: { value: "100" } });
    fireEvent.change(selects[3], { target: { value: "101" } });
    expect(await screen.findByText("Diff Highlight")).toBeInTheDocument();
    expect(screen.getByText(/\+ prompt_v2/)).toBeInTheDocument();
  });
});
