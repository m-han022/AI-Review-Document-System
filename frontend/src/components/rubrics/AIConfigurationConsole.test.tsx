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
    createEvaluationSet: vi.fn(),
    bootstrapEvaluationSet: vi.fn(),
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
      rules: ["IMPORTANT RULES:", "1. JSON ONLY", "2. NO MARKDOWN"],
      hash: "rules-hash",
      version: "system-rules-v1",
      required_rule_set_id: 1,
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
    expect(screen.getByText("Evaluation Set List")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare Sets" })).toBeInTheDocument();
  });

  it("keeps UI minimal without preview panel", async () => {
    renderWithQueryClient();
    await screen.findByText("AI Configuration Console");
    expect(screen.queryByRole("button", { name: "Preview Final Prompt" })).not.toBeInTheDocument();
  });

  it("creates new set from current", async () => {
    renderWithQueryClient();
    fireEvent.click(await screen.findByRole("button", { name: "Create New Set from Current" }));
    expect(await screen.findByText("Create New Evaluation Set")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and Activate" }));
    const activateButtons = await screen.findAllByRole("button", { name: "Save and Activate" });
    fireEvent.click(activateButtons[activateButtons.length - 1]);
    await waitFor(() => {
      expect(client.createEvaluationSet).toHaveBeenCalledTimes(1);
    });
  });

  it("renders diff highlight when selecting two sets", async () => {
    renderWithQueryClient();
    fireEvent.click(await screen.findByRole("button", { name: "Compare Sets" }));
    const selects = await screen.findAllByRole("combobox");
    const compareLeft = selects[selects.length - 2];
    const compareRight = selects[selects.length - 1];
    fireEvent.change(compareLeft, { target: { value: "100" } });
    fireEvent.change(compareRight, { target: { value: "101" } });
    expect(await screen.findByText("Diff Highlight")).toBeInTheDocument();
    expect(screen.getByText("changed")).toBeInTheDocument();
  });
});
