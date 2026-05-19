import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AIConfigurationConsole from "./AIConfigurationConsole";
import * as client from "../../api/client";
import { LanguageProvider } from "../LanguageSelector";

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
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <AIConfigurationConsole />
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

describe("AIConfigurationConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(client.listMgmtRubrics).mockResolvedValue([
      { id: 1, document_type: "project-review", version: "v1", status: "active", active: true, prompt: { vi: "rubric_v1" }, created_at: "2026-01-01", updated_at: "2026-01-01", hash: "rh1", summary: "1 criteria" },
    ]);
    vi.mocked(client.listMgmtPrompts).mockResolvedValue([
      { id: 10, document_type: "project-review", level: "medium", version: "v1", content: "prompt_v1", status: "active", created_at: "2026-01-01", hash: "ph1" },
      { id: 11, document_type: "project-review", level: "medium", version: "v2", content: "prompt_v2", status: "archived", created_at: "2026-01-02", hash: "ph2" },
    ]);
    vi.mocked(client.listMgmtPolicies).mockResolvedValue([
      { id: 20, level: "medium", version: "v1", content: "policy_v1", status: "active", created_at: "2026-01-01", hash: "poh1" },
    ]);
    vi.mocked(client.getRequiredRules).mockResolvedValue({
      rules: ["IMPORTANT RULES:", "1. JSON ONLY", "2. NO MARKDOWN"],
      hash: "rules-hash",
      version: "system-rules-v1",
      required_rule_set_id: 1,
    });
    vi.mocked(client.listEvaluationSets).mockResolvedValue([
      { id: 100, name: "project-review-medium-set-v1", document_type: "project-review", level: "medium", rubric_version_id: 1, prompt_version_id: 10, policy_version_id: 20, required_rules_version: "system-rules-v1", required_rule_hash: "rules-hash", version_label: "project-review-medium-set-v1", status: "active", created_at: "2026-01-01" },
      { id: 101, name: "project-review-medium-set-v2", document_type: "project-review", level: "medium", rubric_version_id: 1, prompt_version_id: 11, policy_version_id: 20, required_rules_version: "system-rules-v1", required_rule_hash: "rules-hash", version_label: "project-review-medium-set-v2", status: "archived", created_at: "2026-01-02" },
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
    expect((await screen.findAllByRole("combobox")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /quick guide|クイックガイド/i })).toBeInTheDocument();
  });

  it("keeps UI minimal without preview panel", async () => {
    renderWithQueryClient();
    await screen.findAllByRole("combobox");
    expect(screen.queryByRole("button", { name: /preview final prompt/i })).not.toBeInTheDocument();
  });

  it("opens bootstrap dialog for new document type", async () => {
    renderWithQueryClient();
    fireEvent.click(await screen.findByRole("button", { name: /\+.*thêm mới|\+.*追加/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /今すぐ初期化|initialize now/i })).toBeInTheDocument();
    expect(client.createEvaluationSet).toHaveBeenCalledTimes(0);
  });

  it("renders diff highlight when selecting two sets", async () => {
    renderWithQueryClient();
    fireEvent.click(await screen.findByRole("button", { name: /compare sets|セット比較/i }));
    const selects = await screen.findAllByRole("combobox");
    fireEvent.change(selects[selects.length - 2], { target: { value: "100" } });
    fireEvent.change(selects[selects.length - 1], { target: { value: "101" } });
    expect((await screen.findAllByText(/quick diff|差分表示|diff/i)).length).toBeGreaterThan(0);
    expect((screen.getAllByText(/no content difference|変更あり|changed/i)).length).toBeGreaterThan(0);
  });
});
