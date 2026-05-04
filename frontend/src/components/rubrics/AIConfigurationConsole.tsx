import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  activateMgmtPolicy,
  activateMgmtPrompt,
  activateMgmtRubric,
  createMgmtPolicy,
  createMgmtPrompt,
  createMgmtRubric,
  getRequiredRules,
  listMgmtPolicies,
  listMgmtPrompts,
  listMgmtRubrics,
  previewFinalPrompt,
} from "../../api/client";
import type { MgmtPolicy, MgmtPrompt, MgmtRubric } from "../../types";
import ConfirmDialog from "../ui/ConfirmDialog";
import SectionBlock from "../ui/SectionBlock";
import { ErrorState, LoadingState } from "../ui/States";

const LEVELS = ["low", "medium", "high"] as const;

const qk = {
  rubrics: ["mgmt-rubrics"] as const,
  prompts: ["mgmt-prompts"] as const,
  policies: ["mgmt-policies"] as const,
  rules: ["mgmt-required-rules"] as const,
};

function nextVersion(items: Array<{ version: string }>) {
  const values = items
    .map((item) => /^v(\d+)$/i.exec(item.version)?.[1])
    .filter(Boolean)
    .map((value) => Number(value));
  const next = values.length ? Math.max(...values) + 1 : 1;
  return `v${next}`;
}

export default function AIConfigurationConsole() {
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState("project-review");
  const [level, setLevel] = useState("medium");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<"rubric" | "prompt" | "policy">("rubric");
  const [leftId, setLeftId] = useState<number | "">("");
  const [rightId, setRightId] = useState<number | "">("");
  const [activateTarget, setActivateTarget] = useState<null | { type: "rubric" | "prompt" | "policy"; id: number; label: string }>(null);

  const { data: rubrics = [], isLoading: loadingRubrics, error: rubricsError } = useQuery({
    queryKey: qk.rubrics,
    queryFn: () => listMgmtRubrics(),
  });
  const { data: prompts = [], isLoading: loadingPrompts } = useQuery({
    queryKey: qk.prompts,
    queryFn: () => listMgmtPrompts(),
  });
  const { data: policies = [], isLoading: loadingPolicies } = useQuery({
    queryKey: qk.policies,
    queryFn: () => listMgmtPolicies(),
  });
  const { data: rules } = useQuery({ queryKey: qk.rules, queryFn: getRequiredRules });
  const { data: previewData, refetch: refetchPreview, isFetching: previewLoading, error: previewError } = useQuery({
    queryKey: ["mgmt-preview", documentType, level],
    queryFn: () => previewFinalPrompt(documentType, level),
    enabled: false,
  });

  const documentTypes = useMemo(() => {
    const fromRubrics = [...new Set(rubrics.map((r) => r.document_type))];
    return fromRubrics.length ? fromRubrics : ["project-review", "bug-analysis", "qa-review", "explanation-review"];
  }, [rubrics]);

  const scopedRubrics = rubrics.filter((r) => r.document_type === documentType);
  const scopedPrompts = prompts.filter((p) => p.document_type === documentType && p.level === level);
  const scopedPolicies = policies.filter((p) => p.level === level);
  const activeRubric = scopedRubrics.find((r) => r.status === "active");
  const activePrompt = scopedPrompts.find((p) => p.status === "active");
  const activePolicy = scopedPolicies.find((p) => p.status === "active");
  const comparePool = compareMode === "rubric" ? scopedRubrics : compareMode === "prompt" ? scopedPrompts : scopedPolicies;
  const leftItem = comparePool.find((item) => item.id === leftId);
  const rightItem = comparePool.find((item) => item.id === rightId);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.rubrics }),
      queryClient.invalidateQueries({ queryKey: qk.prompts }),
      queryClient.invalidateQueries({ queryKey: qk.policies }),
    ]);
  };

  const createRubricMutation = useMutation({
    mutationFn: () =>
      createMgmtRubric({
        document_type: documentType,
        version: nextVersion(scopedRubrics),
        prompt: { vi: "New rubric prompt" },
        criteria: [{ key: "review_tong_the", max_score: 100, labels: { vi: "Tổng thể", ja: "総合" } }],
        activate: true,
      }),
    onSuccess: refreshAll,
  });
  const createPromptMutation = useMutation({
    mutationFn: () =>
      createMgmtPrompt({
        document_type: documentType,
        level,
        version: nextVersion(scopedPrompts),
        content: "This creates a new immutable version.",
        activate: true,
      }),
    onSuccess: refreshAll,
  });
  const createPolicyMutation = useMutation({
    mutationFn: () =>
      createMgmtPolicy({
        level,
        version: nextVersion(scopedPolicies),
        content: "This creates a new immutable version.",
        activate: true,
      }),
    onSuccess: refreshAll,
  });
  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!activateTarget) return;
      if (activateTarget.type === "rubric") return activateMgmtRubric(activateTarget.id);
      if (activateTarget.type === "prompt") return activateMgmtPrompt(activateTarget.id);
      return activateMgmtPolicy(activateTarget.id);
    },
    onSuccess: async () => {
      setActivateTarget(null);
      await refreshAll();
    },
  });

  if (loadingRubrics || loadingPrompts || loadingPolicies) {
    return <LoadingState title="Loading AI Configuration Console..." />;
  }
  if (rubricsError) {
    return <ErrorState title="Failed to load configuration data" description={rubricsError instanceof Error ? rubricsError.message : ""} />;
  }

  return (
    <div className="workspace-stack">
      <SectionBlock>
        <SectionBlock.Header title="AI Configuration Console" subtitle="Manage versioned and immutable Rubric / Prompt / Policy components." />
        <SectionBlock.Body>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {documentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            <div><strong>Rubric:</strong> {activeRubric?.version || "—"}</div>
            <div><strong>Prompt:</strong> {activePrompt?.version || "—"}</div>
            <div><strong>Policy:</strong> {activePolicy?.version || "—"}</div>
            <div><strong>Required Rules:</strong> {rules?.hash?.slice(0, 12) || "—"}</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            <button className="btn-secondary btn-secondary--compact" onClick={async () => { setPreviewOpen(true); await refetchPreview(); }}>Preview Final Prompt</button>
            <button className="btn-secondary btn-secondary--compact" onClick={() => setCompareMode(compareMode === "rubric" ? "prompt" : compareMode === "prompt" ? "policy" : "rubric")}>Compare Versions</button>
            <button className="btn-secondary btn-secondary--compact" onClick={() => createRubricMutation.mutate()} disabled={createRubricMutation.isPending}>Create New Rubric</button>
            <button className="btn-secondary btn-secondary--compact" onClick={() => createPromptMutation.mutate()} disabled={createPromptMutation.isPending}>Create New Prompt</button>
            <button className="btn-secondary btn-secondary--compact" onClick={() => createPolicyMutation.mutate()} disabled={createPolicyMutation.isPending}>Create New Policy</button>
          </div>

          <ConfigList
            title="Rubric Versions"
            items={scopedRubrics}
            onActivate={(item) => setActivateTarget({ type: "rubric", id: item.id, label: `Rubric ${item.version} for ${documentType}` })}
          />
          <ConfigList
            title="Prompt Versions"
            items={scopedPrompts}
            onActivate={(item) => setActivateTarget({ type: "prompt", id: item.id, label: `Prompt ${item.version} for ${documentType}/${level}` })}
          />
          <ConfigList
            title="Policy Versions"
            items={scopedPolicies}
            onActivate={(item) => setActivateTarget({ type: "policy", id: item.id, label: `Policy ${item.version} for ${level}` })}
          />

          <SectionBlock>
            <SectionBlock.Header title={`Compare ${compareMode} versions`} />
            <SectionBlock.Body>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <select value={leftId} onChange={(e) => setLeftId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Left version</option>
                  {comparePool.map((item) => <option key={item.id} value={item.id}>{item.version}</option>)}
                </select>
                <select value={rightId} onChange={(e) => setRightId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Right version</option>
                  {comparePool.map((item) => <option key={item.id} value={item.id}>{item.version}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>
                  {renderCompareContent(leftItem)}
                </pre>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>
                  {renderCompareContent(rightItem)}
                </pre>
              </div>
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock>
            <SectionBlock.Header title="Required Rules" subtitle={`Hash: ${rules?.hash || "—"}`} />
            <SectionBlock.Body>
              <div style={{ display: "grid", gap: 6 }}>
                {(rules?.rules || []).map((rule) => <code key={rule}>{rule}</code>)}
              </div>
            </SectionBlock.Body>
          </SectionBlock>
        </SectionBlock.Body>
      </SectionBlock>

      {previewOpen ? (
        <SectionBlock>
          <SectionBlock.Header title="Final Prompt Preview" subtitle="Read-only inspection for audit." />
          <SectionBlock.Body>
            {previewLoading ? <LoadingState title="Loading preview..." /> : null}
            {previewError ? <ErrorState title="Failed to preview" description={previewError instanceof Error ? previewError.message : ""} /> : null}
            {previewData ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr))", gap: 8, marginBottom: 10 }}>
                  <div>document_type: {previewData.document_type}</div>
                  <div>level: {previewData.level}</div>
                  <div>required_rule_hash: {previewData.required_rule_hash.slice(0, 16)}...</div>
                  <div>rubric: {previewData.rubric_version}</div>
                  <div>prompt: {previewData.prompt_version}</div>
                  <div>policy: {previewData.policy_version}</div>
                </div>
                <button className="btn-secondary btn-secondary--compact" onClick={() => navigator.clipboard.writeText(previewData.full_prompt_preview)}>Copy</button>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto", background: "#f8fafc", padding: 12, marginTop: 8 }}>
                  {previewData.full_prompt_preview}
                </pre>
              </>
            ) : null}
            <button className="btn-secondary btn-secondary--compact" onClick={() => setPreviewOpen(false)}>Close</button>
          </SectionBlock.Body>
        </SectionBlock>
      ) : null}

      <ConfirmDialog
        open={Boolean(activateTarget)}
        title="Xác nhận kích hoạt version"
        description={activateTarget ? `Bạn đang kích hoạt ${activateTarget.label}. Các lần chấm mới sẽ dùng version này. Kết quả cũ không bị thay đổi.` : ""}
        confirmLabel="Kích hoạt"
        cancelLabel="Hủy"
        pending={activateMutation.isPending}
        onConfirm={() => activateMutation.mutate()}
        onCancel={() => setActivateTarget(null)}
      />
    </div>
  );
}

function renderCompareContent(item: MgmtRubric | MgmtPrompt | MgmtPolicy | undefined) {
  if (!item) return "No version selected";
  if ("document_type" in item && "prompt" in item) return JSON.stringify(item.prompt, null, 2);
  return "content" in item ? item.content : "";
}

function ConfigList({
  title,
  items,
  onActivate,
}: {
  title: string;
  items: Array<MgmtRubric | MgmtPrompt | MgmtPolicy>;
  onActivate: (item: MgmtRubric | MgmtPrompt | MgmtPolicy) => void;
}) {
  return (
    <SectionBlock>
      <SectionBlock.Header title={title} />
      <SectionBlock.Body>
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
              <div>
                <strong>{item.version}</strong> · <span>{item.status}</span> · <span>{item.hash.slice(0, 12)}...</span>
                <div style={{ fontSize: 12, color: "#64748b" }}>{item.created_at}</div>
              </div>
              {item.status !== "active" ? (
                <button className="btn-secondary btn-secondary--compact" onClick={() => onActivate(item)}>Activate</button>
              ) : (
                <span style={{ fontSize: 12, color: "#16a34a", alignSelf: "center" }}>Active</span>
              )}
            </div>
          ))}
          {!items.length ? <div style={{ color: "#64748b" }}>No versions</div> : null}
        </div>
      </SectionBlock.Body>
    </SectionBlock>
  );
}
