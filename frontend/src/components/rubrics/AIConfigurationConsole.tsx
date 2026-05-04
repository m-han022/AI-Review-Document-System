import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { diffLines } from "diff";

import {
  createEvaluationSet,
  getActiveEvaluationSet,
  getRequiredRules,
  listEvaluationSets,
  listMgmtPolicies,
  listMgmtPrompts,
  listMgmtRubrics,
  previewFinalPrompt,
} from "../../api/client";
import type { EvaluationSet, MgmtPolicy, MgmtPrompt, MgmtRubric } from "../../types";
import SectionBlock from "../ui/SectionBlock";
import { ErrorState, LoadingState } from "../ui/States";

const LEVELS = ["low", "medium", "high"] as const;

export default function AIConfigurationConsole() {
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState("project-review");
  const [level, setLevel] = useState("medium");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState<number | "">("");
  const [compareRightId, setCompareRightId] = useState<number | "">("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [changeRubric, setChangeRubric] = useState(false);
  const [changePrompt, setChangePrompt] = useState(true);
  const [changePolicy, setChangePolicy] = useState(false);
  const [setName, setSetName] = useState("");
  const [newRubricContent, setNewRubricContent] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [newPolicyContent, setNewPolicyContent] = useState("");

  const { data: rubrics = [], isLoading: loadingRubrics, error: rubricsError } = useQuery({
    queryKey: ["mgmt-rubrics"],
    queryFn: () => listMgmtRubrics(),
  });
  const { data: prompts = [], isLoading: loadingPrompts } = useQuery({
    queryKey: ["mgmt-prompts"],
    queryFn: () => listMgmtPrompts(),
  });
  const { data: policies = [], isLoading: loadingPolicies } = useQuery({
    queryKey: ["mgmt-policies"],
    queryFn: () => listMgmtPolicies(),
  });
  const { data: requiredRules } = useQuery({
    queryKey: ["mgmt-required-rules"],
    queryFn: getRequiredRules,
  });
  const { data: evaluationSets = [], isLoading: loadingSets } = useQuery({
    queryKey: ["mgmt-evaluation-sets", documentType, level],
    queryFn: () => listEvaluationSets(documentType, level),
  });
  const { data: activeSet } = useQuery({
    queryKey: ["mgmt-evaluation-set-active", documentType, level],
    queryFn: () => getActiveEvaluationSet(documentType, level),
    retry: false,
  });
  const { data: previewData, refetch: refetchPreview, isFetching: previewLoading, error: previewError } = useQuery({
    queryKey: ["mgmt-preview", documentType, level],
    queryFn: () => previewFinalPrompt(documentType, level),
    enabled: false,
  });

  const documentTypes = useMemo(() => {
    const fromRubrics = [...new Set(rubrics.map((item) => item.document_type))];
    return fromRubrics.length ? fromRubrics : ["project-review", "bug-analysis", "qa-review", "explanation-review"];
  }, [rubrics]);

  const rubricsById = useMemo(() => new Map(rubrics.map((item) => [item.id, item])), [rubrics]);
  const promptsById = useMemo(() => new Map(prompts.map((item) => [item.id, item])), [prompts]);
  const policiesById = useMemo(() => new Map(policies.map((item) => [item.id, item])), [policies]);

  const setWithDetails = (setItem: EvaluationSet | undefined | null) => {
    if (!setItem) return null;
    return {
      ...setItem,
      rubric: rubricsById.get(setItem.rubric_version_id),
      prompt: promptsById.get(setItem.prompt_version_id),
      policy: policiesById.get(setItem.policy_version_id),
    };
  };

  const activeDetails = setWithDetails(activeSet);
  const leftSet = setWithDetails(evaluationSets.find((item) => item.id === compareLeftId));
  const rightSet = setWithDetails(evaluationSets.find((item) => item.id === compareRightId));

  const createSetMutation = useMutation({
    mutationFn: () => {
      if (!activeSet) throw new Error("No active evaluation set in current scope");
      return createEvaluationSet({
        base_set_id: activeSet.id,
        name: setName.trim() || `${documentType}-${level}-${Date.now()}`,
        changes: {
          rubric_content: changeRubric ? newRubricContent : null,
          prompt_content: changePrompt ? newPromptContent : null,
          policy_content: changePolicy ? newPolicyContent : null,
        },
        activate: true,
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage({ type: "success", text: "New Evaluation Set created and activated." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-set-active", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-rubrics"] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-policies"] }),
      ]);
    },
    onError: (error) => {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Create set failed" });
    },
  });

  const openCreateFromCurrent = () => {
    setSetName(`${documentType} ${level} set ${new Date().toISOString().slice(0, 16)}`);
    setChangeRubric(false);
    setChangePrompt(true);
    setChangePolicy(false);
    setNewRubricContent(activeDetails?.rubric?.prompt?.vi || activeDetails?.rubric?.prompt?.ja || "");
    setNewPromptContent(activeDetails?.prompt?.content || "");
    setNewPolicyContent(activeDetails?.policy?.content || "");
    setCreateOpen(true);
  };

  if (loadingRubrics || loadingPrompts || loadingPolicies || loadingSets) {
    return <LoadingState title="Loading AI Configuration Console..." />;
  }
  if (rubricsError) {
    return <ErrorState title="Failed to load configuration data" description={rubricsError instanceof Error ? rubricsError.message : ""} />;
  }

  return (
    <div className="workspace-stack">
      <SectionBlock>
        <SectionBlock.Header title="AI Configuration Console" subtitle="Operate by Evaluation Set to reduce configuration complexity." />
        <SectionBlock.Body>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              {documentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={level} onChange={(event) => setLevel(event.target.value)}>
              {LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          {message ? (
            <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${message.type === "error" ? "#fecaca" : "#bbf7d0"}`, background: message.type === "error" ? "#fef2f2" : "#f0fdf4" }}>
              {message.text}
            </div>
          ) : null}

          <SectionBlock>
            <SectionBlock.Header title="Active Evaluation Set" subtitle="One active set per document type + level." />
            <SectionBlock.Body>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(160px,1fr))", gap: 8 }}>
                <div><strong>Set</strong>: {activeDetails?.name || "-"}</div>
                <div><strong>Rubric</strong>: {activeDetails?.rubric?.version || "-"}</div>
                <div><strong>Prompt</strong>: {activeDetails?.prompt?.version || "-"}</div>
                <div><strong>Policy</strong>: {activeDetails?.policy?.version || "-"}</div>
                <div><strong>Rules</strong>: {activeDetails?.required_rules_version || "system-rules-v1"}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn-secondary btn-secondary--compact" onClick={openCreateFromCurrent} disabled={!activeDetails}>
                  Create New Set from Current
                </button>
                <button className="btn-secondary btn-secondary--compact" onClick={async () => { setPreviewOpen(true); await refetchPreview(); }}>
                  Preview Final Prompt
                </button>
              </div>
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock>
            <SectionBlock.Header title="Evaluation Set History" subtitle="Track active/archived sets for this scope." />
            <SectionBlock.Body>
              <div style={{ display: "grid", gap: 8 }}>
                {evaluationSets.map((setItem) => {
                  const details = setWithDetails(setItem);
                  return (
                    <div key={setItem.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
                      <div><strong>{setItem.name}</strong> | <span>{setItem.status}</span></div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Rubric: {details?.rubric?.version || "#"+setItem.rubric_version_id} | Prompt: {details?.prompt?.version || "#"+setItem.prompt_version_id} | Policy: {details?.policy?.version || "#"+setItem.policy_version_id}
                      </div>
                    </div>
                  );
                })}
                {!evaluationSets.length ? <div style={{ color: "#64748b" }}>No evaluation set.</div> : null}
              </div>
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock>
            <SectionBlock.Header title="Compare Sets" subtitle="Side-by-side comparison for auditing." />
            <SectionBlock.Body>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <select value={compareLeftId} onChange={(event) => setCompareLeftId(event.target.value ? Number(event.target.value) : "")}>
                  <option value="">Left set</option>
                  {evaluationSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={compareRightId} onChange={(event) => setCompareRightId(event.target.value ? Number(event.target.value) : "")}>
                  <option value="">Right set</option>
                  {evaluationSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>{renderSet(leftSet)}</pre>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>{renderSet(rightSet)}</pre>
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Diff Highlight</strong>
                <div style={{ maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8, borderRadius: 8 }}>
                  {renderDiff(renderSet(leftSet), renderSet(rightSet))}
                </div>
              </div>
            </SectionBlock.Body>
          </SectionBlock>

          <SectionBlock>
            <SectionBlock.Header title="Required Rules (Read-only)" subtitle={`Hash: ${requiredRules?.hash || "-"}`} />
            <SectionBlock.Body>
              <div style={{ display: "grid", gap: 6 }}>
                {(requiredRules?.rules || []).map((rule) => <code key={rule}>{rule}</code>)}
              </div>
            </SectionBlock.Body>
          </SectionBlock>
        </SectionBlock.Body>
      </SectionBlock>

      {createOpen ? (
        <SectionBlock>
          <SectionBlock.Header title="Set Changes" subtitle="Select components to change in this new set." />
          <SectionBlock.Body>
            <input value={setName} onChange={(event) => setSetName(event.target.value)} placeholder="set name" style={{ width: "100%", marginBottom: 8 }} />
            <label style={{ display: "block" }}><input type="checkbox" checked={changeRubric} onChange={(event) => setChangeRubric(event.target.checked)} /> Change Rubric</label>
            {changeRubric ? <textarea value={newRubricContent} onChange={(event) => setNewRubricContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} /> : null}
            <label style={{ display: "block" }}><input type="checkbox" checked={changePrompt} onChange={(event) => setChangePrompt(event.target.checked)} /> Change Prompt</label>
            {changePrompt ? <textarea value={newPromptContent} onChange={(event) => setNewPromptContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} /> : null}
            <label style={{ display: "block" }}><input type="checkbox" checked={changePolicy} onChange={(event) => setChangePolicy(event.target.checked)} /> Change Policy</label>
            {changePolicy ? <textarea value={newPolicyContent} onChange={(event) => setNewPolicyContent(event.target.value)} rows={5} style={{ width: "100%" }} /> : null}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn-secondary btn-secondary--compact" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="btn-primary btn-primary--compact" disabled={createSetMutation.isPending} onClick={() => createSetMutation.mutate()}>
                {createSetMutation.isPending ? "Saving..." : "Save and Activate"}
              </button>
            </div>
          </SectionBlock.Body>
        </SectionBlock>
      ) : null}

      {previewOpen ? (
        <SectionBlock>
          <SectionBlock.Header title="Final Prompt Preview" subtitle="Read-only preview for the current active set scope." />
          <SectionBlock.Body>
            {previewLoading ? <LoadingState title="Loading preview..." /> : null}
            {previewError ? <ErrorState title="Failed to preview" description={previewError instanceof Error ? previewError.message : ""} /> : null}
            {previewData ? (
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", background: "#f8fafc", padding: 12 }}>
                {previewData.full_prompt_preview}
              </pre>
            ) : null}
            <button className="btn-secondary btn-secondary--compact" onClick={() => setPreviewOpen(false)}>Close</button>
          </SectionBlock.Body>
        </SectionBlock>
      ) : null}
    </div>
  );
}

function renderSet(setItem: {
  name: string;
  status: string;
  level: string;
  rubric?: MgmtRubric;
  prompt?: MgmtPrompt;
  policy?: MgmtPolicy;
  required_rule_hash: string;
} | null) {
  if (!setItem) return "No set selected";
  return [
    `name: ${setItem.name}`,
    `status: ${setItem.status}`,
    `level: ${setItem.level}`,
    `rubric: ${setItem.rubric?.version || "-"}`,
    `prompt: ${setItem.prompt?.version || "-"}`,
    `policy: ${setItem.policy?.version || "-"}`,
    `required_rule_hash: ${setItem.required_rule_hash}`,
    "",
    "prompt_content:",
    setItem.prompt?.content || "-",
  ].join("\n");
}

function renderDiff(left: string, right: string) {
  const parts = diffLines(left || "", right || "");
  return parts.map((part, idx) => {
    const style = part.added
      ? { background: "#ecfdf5", color: "#166534" }
      : part.removed
        ? { background: "#fef2f2", color: "#991b1b" }
        : { color: "#334155" };
    const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
    return (
      <div key={idx} style={{ ...style, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
        {prefix}{part.value}
      </div>
    );
  });
}


