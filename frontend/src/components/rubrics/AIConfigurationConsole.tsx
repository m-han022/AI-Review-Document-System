import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { diffLines } from "diff";

import {
  ApiClientError,
  bootstrapEvaluationSet,
  createMgmtPolicy,
  createMgmtPrompt,
  createMgmtRubric,
  createEvaluationSet,
  getActiveEvaluationSet,
  getRequiredRules,
  listEvaluationSets,
  listMgmtPolicies,
  listMgmtPrompts,
  listMgmtRubrics,
} from "../../api/client";
import { AI_CONFIG_COPY } from "../../constants/aiConfigCopy";
import { getDocumentTypeLabel, getLevelLabel } from "../../constants/uiLabels";
import { mapErrorCodeToI18nKey } from "../../locales/errorMapping";
import type { EvaluationSet, MgmtPolicy, MgmtPrompt, MgmtRubric } from "../../types";
import ConfirmDialog from "../ui/ConfirmDialog";
import SectionBlock from "../ui/SectionBlock";
import { ErrorState, LoadingState } from "../ui/States";
import { useTranslation } from "../LanguageSelector";

const LEVELS = ["low", "medium", "high"] as const;
type ConfigTab = "sets" | "create" | "compare";

export default function AIConfigurationConsole() {
  const { lang, t } = useTranslation();
  const ui = AI_CONFIG_COPY[lang] ?? AI_CONFIG_COPY.vi;

  const mapConfigErrorMessage = (error: unknown): string => {
    if (error instanceof ApiClientError) {
      return t(mapErrorCodeToI18nKey(error.code));
    }
    return t("api.unexpectedError");
  };
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = useState("project-review");
  const [level, setLevel] = useState("medium");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(50);
  const [historySearch, setHistorySearch] = useState("");
  const [compareLeftId, setCompareLeftId] = useState<number | "">("");
  const [compareRightId, setCompareRightId] = useState<number | "">("");
  const [selectedSetId, setSelectedSetId] = useState<number | "">("");
  const [showSelectedSetDetail, setShowSelectedSetDetail] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("sets");
  const [showGuide, setShowGuide] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const [changeRubric, setChangeRubric] = useState(false);
  const [changePrompt, setChangePrompt] = useState(true);
  const [changePolicy, setChangePolicy] = useState(false);
  const [changeRequiredRules, setChangeRequiredRules] = useState(false);
  const [setName, setSetName] = useState("");
  const [newRubricContent, setNewRubricContent] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [newPolicyContent, setNewPolicyContent] = useState("");
  const [newRequiredRulesContent, setNewRequiredRulesContent] = useState("");
  const [manualCriteria, setManualCriteria] = useState<Array<{ key: string; max_score: number; label_vi: string; label_ja: string }>>([
    { key: "review_tong_the", max_score: 25, label_vi: "Đánh giá tổng thể", label_ja: "Overall review" },
    { key: "diem_tot", max_score: 25, label_vi: "Điểm tốt", label_ja: "Strengths" },
    { key: "diem_xau", max_score: 30, label_vi: "Điểm cần cải thiện", label_ja: "Weak points" },
    { key: "chinh_sach", max_score: 20, label_vi: "Chính sách cải thiện", label_ja: "Improvement policy" },
  ]);

  const nextVersion = (versions: string[]) => {
    const nums = versions
      .map((v) => Number((v || "").replace(/^v/i, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return `v${max + 1}`;
  };

  const { data: rubrics = [], isLoading: loadingRubrics, error: rubricsError } = useQuery({
    queryKey: ["mgmt-rubrics"],
    queryFn: () => listMgmtRubrics(),
  });
  const { data: prompts = [], isLoading: loadingPrompts, error: promptsError } = useQuery({
    queryKey: ["mgmt-prompts"],
    queryFn: () => listMgmtPrompts(),
  });
  const { data: policies = [], isLoading: loadingPolicies, error: policiesError } = useQuery({
    queryKey: ["mgmt-policies"],
    queryFn: () => listMgmtPolicies(),
  });
  const { data: requiredRulesData } = useQuery({
    queryKey: ["mgmt-required-rules"],
    queryFn: () => getRequiredRules(),
  });
  const { data: evaluationSets = [], isLoading: loadingSets, error: setsError } = useQuery({
    queryKey: ["mgmt-evaluation-sets", documentType, level],
    queryFn: () => listEvaluationSets(documentType, level),
  });
  const { data: activeSet } = useQuery({
    queryKey: ["mgmt-evaluation-set-active", documentType, level],
    queryFn: () => getActiveEvaluationSet(documentType, level),
    retry: false,
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
  const hasCurrentSet = Boolean(activeDetails);
  const selectedSet = setWithDetails(evaluationSets.find((item) => item.id === selectedSetId));
  const leftSet = setWithDetails(evaluationSets.find((item) => item.id === compareLeftId));
  const rightSet = setWithDetails(evaluationSets.find((item) => item.id === compareRightId));
  const visibleHistory = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    return evaluationSets
      .filter((item) => showArchived || item.status === "active")
      .filter((item) => !keyword || item.name.toLowerCase().includes(keyword) || (item.version_label || "").toLowerCase().includes(keyword))
      .slice(0, historyLimit);
  }, [evaluationSets, showArchived, historySearch, historyLimit]);
  const filteredHistoryCount = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    return evaluationSets
      .filter((item) => showArchived || item.status === "active")
      .filter((item) => !keyword || item.name.toLowerCase().includes(keyword) || (item.version_label || "").toLowerCase().includes(keyword))
      .length;
  }, [evaluationSets, showArchived, historySearch]);
  const compareSummary = useMemo(() => {
    if (!leftSet || !rightSet) return null;
    return {
      rubric: leftSet.rubric?.id === rightSet.rubric?.id ? "unchanged" : "changed",
      prompt: leftSet.prompt?.id === rightSet.prompt?.id ? "unchanged" : "changed",
      policy: leftSet.policy?.id === rightSet.policy?.id ? "unchanged" : "changed",
      rules: leftSet.required_rule_hash === rightSet.required_rule_hash ? "unchanged" : "changed",
    };
  }, [leftSet, rightSet]);

  const baseRubricContent = (activeDetails?.rubric?.prompt?.vi || activeDetails?.rubric?.prompt?.ja || "").trim();
  const basePromptContent = (activeDetails?.prompt?.content || "").trim();
  const basePolicyContent = (activeDetails?.policy?.content || "").trim();
  const baseRequiredRulesContent = useMemo(
    () => (requiredRulesData?.rules || []).join("\n").trim(),
    [requiredRulesData],
  );

  const effectiveRubricChange = changeRubric && newRubricContent.trim() !== baseRubricContent;
  const effectivePromptChange = changePrompt && newPromptContent.trim() !== basePromptContent;
  const effectivePolicyChange = changePolicy && newPolicyContent.trim() !== basePolicyContent;
  const effectiveRequiredRulesChange =
    changeRequiredRules && newRequiredRulesContent.trim() !== baseRequiredRulesContent;
  const hasEffectiveChange =
    effectiveRubricChange || effectivePromptChange || effectivePolicyChange || effectiveRequiredRulesChange;
  const helpDot = (text: string) => (
    <span
      title={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        marginLeft: 6,
        borderRadius: "50%",
        border: "1px solid #cbd5e1",
        color: "#475569",
        fontSize: 11,
        cursor: "help",
        userSelect: "none",
      }}
    >
      ?
    </span>
  );
  const guide = {
    partTitle: t("biz.evaluationGuide.partTitle"),
    partItems: [
      t("biz.evaluationGuide.partItem1"),
      t("biz.evaluationGuide.partItem2"),
      t("biz.evaluationGuide.partItem3"),
      t("biz.evaluationGuide.partItem4"),
      t("biz.evaluationGuide.partItem5"),
    ],
    factorsTitle: t("biz.evaluationGuide.factorsTitle"),
    factorsItems: [
      t("biz.evaluationGuide.factorsItem1"),
      t("biz.evaluationGuide.factorsItem2"),
      t("biz.evaluationGuide.factorsItem3"),
      t("biz.evaluationGuide.factorsItem4"),
      t("biz.evaluationGuide.factorsItem5"),
    ],
    whenNewTitle: t("biz.evaluationGuide.whenNewTitle"),
    whenNewItems: [
      t("biz.evaluationGuide.whenNewItem1"),
      t("biz.evaluationGuide.whenNewItem2"),
      t("biz.evaluationGuide.whenNewItem3"),
    ],
    whenNotNewTitle: t("biz.evaluationGuide.whenNotNewTitle"),
    whenNotNewItems: [
      t("biz.evaluationGuide.whenNotNewItem1"),
      t("biz.evaluationGuide.whenNotNewItem2"),
    ],
    impactTitle: t("biz.evaluationGuide.impactTitle"),
    impactItems: [
      t("biz.evaluationGuide.impactItem1"),
      t("biz.evaluationGuide.impactItem2"),
    ],
    checklistTitle: t("biz.evaluationGuide.checklistTitle"),
    checklistItems: [
      t("biz.evaluationGuide.checklistItem1"),
      t("biz.evaluationGuide.checklistItem2"),
      t("biz.evaluationGuide.checklistItem3"),
      t("biz.evaluationGuide.checklistItem4"),
    ],
    definitionTitle: t("biz.evaluationGuide.definitionTitle"),
    definitionItems: [
      t("biz.evaluationGuide.definitionItem1"),
      t("biz.evaluationGuide.definitionItem2"),
      t("biz.evaluationGuide.definitionItem3"),
      t("biz.evaluationGuide.definitionItem4"),
      t("biz.evaluationGuide.definitionItem5"),
    ],
    examplesTitle: t("biz.evaluationGuide.examplesTitle"),
    examplesItems: [
      t("biz.evaluationGuide.examplesItem1"),
      t("biz.evaluationGuide.examplesItem2"),
      t("biz.evaluationGuide.examplesItem3"),
      t("biz.evaluationGuide.examplesItem4"),
      t("biz.evaluationGuide.examplesItem5"),
    ],
  };

  const createSetMutation = useMutation({
    mutationFn: (activate: boolean) => {
      if (!activeSet) throw new Error(ui.noActiveSet);
      return createEvaluationSet({
        base_set_id: activeSet.id,
        name: setName.trim() || `${documentType}-${level}-${Date.now()}`,
        changes: {
          rubric_content: changeRubric ? newRubricContent : null,
          prompt_content: changePrompt ? newPromptContent : null,
          policy_content: changePolicy ? newPolicyContent : null,
          required_rules_content: changeRequiredRules ? newRequiredRulesContent : null,
        },
        activate,
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage({ type: "success", text: ui.createSuccess });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-set-active", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-rubrics"] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-policies"] }),
      ]);
    },
    onError: (error) => {
      setMessage({ type: "error", text: mapConfigErrorMessage(error) });
    },
  });
  const createFirstSetMutation = useMutation({
    mutationFn: async () => {
      const scopeRubrics = rubrics.filter((r) => r.document_type === documentType);
      const activeRubric = scopeRubrics.find((r) => r.status === "active") || scopeRubrics[0];
      if (!activeRubric) throw new Error(ui.rubricNotFound);
      if (!newPromptContent.trim()) throw new Error(ui.promptRequired);
      if (!newPolicyContent.trim()) throw new Error(ui.policyRequired);

      if (changeRubric && newRubricContent.trim()) {
        const fallbackManual = manualCriteria
          .filter((item) => item.key.trim())
          .map((item) => ({
            key: item.key.trim(),
            max_score: Number(item.max_score) || 0,
            labels: {
              vi: item.label_vi?.trim() || item.key.trim(),
              ja: item.label_ja?.trim() || item.key.trim(),
            },
          }));
        const criteriaRows = (((activeRubric as any).criteria || []) as Array<{ key: string; max_score: number; labels?: Record<string, string> }>)
          .filter((row) => row && row.key)
          .length
          ? ((activeRubric as any).criteria || []) as Array<{ key: string; max_score: number; labels?: Record<string, string> }>
          : fallbackManual;
        if (!criteriaRows.length) {
          throw new Error(ui.criteriaRequired);
        }
        const rubricVersions = scopeRubrics.map((r) => r.version);
        const rubricVersion = nextVersion(rubricVersions);
        await createMgmtRubric({
          document_type: documentType,
          version: rubricVersion,
          prompt: { vi: newRubricContent.trim() },
          criteria: criteriaRows.map((c) => ({
            key: c.key,
            max_score: c.max_score,
            labels: c.labels || { vi: c.key, ja: c.key },
          })),
          activate: true,
        });
      }

      const promptVersions = prompts
        .filter((p) => p.document_type === documentType && p.level === level)
        .map((p) => p.version);
      const policyVersions = policies.filter((p) => p.level === level).map((p) => p.version);

      await createMgmtPrompt({
        document_type: documentType,
        level,
        version: nextVersion(promptVersions),
        content: newPromptContent.trim(),
        activate: true,
      });
      await createMgmtPolicy({
        level,
        version: nextVersion(policyVersions),
        content: newPolicyContent.trim(),
        activate: true,
      });

      return bootstrapEvaluationSet({
        document_type: documentType,
        level,
        name: setName.trim() || `${documentType}-${level}-set-v1`,
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setMessage({ type: "success", text: ui.bootstrapSuccess });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-set-active", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-rubrics"] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-policies"] }),
      ]);
      setActiveTab("sets");
    },
    onError: (error) => {
      setMessage({ type: "error", text: mapConfigErrorMessage(error) });
    },
  });

  const openCreateFromCurrent = () => {
    if (!activeDetails) return;
    setSetName(`${documentType} ${level} set ${new Date().toISOString().slice(0, 16)}`);
    setChangeRubric(false);
    setChangePrompt(false);
    setChangePolicy(false);
    setChangeRequiredRules(false);
    setNewRubricContent(activeDetails?.rubric?.prompt?.vi || activeDetails?.rubric?.prompt?.ja || "");
    setNewPromptContent(activeDetails?.prompt?.content || "");
    setNewPolicyContent(activeDetails?.policy?.content || "");
    setNewRequiredRulesContent((requiredRulesData?.rules || []).join("\n"));
    setCreateStep(1);
    setCreateOpen(true);
    setActiveTab("create");
  };

  const openCreateFromScratch = () => {
    setActiveTab("create");
    setCreateOpen(true);
    setSetName(`${documentType} ${level} set v1`);
    setCreateStep(1);
    setChangeRubric(false);
    setChangePrompt(true);
    setChangePolicy(true);
    setChangeRequiredRules(false);
    const activeRubric = rubrics.find((r) => r.document_type === documentType && r.status === "active") || rubrics.find((r) => r.document_type === documentType);
    setNewRubricContent(activeRubric?.prompt?.vi || activeRubric?.prompt?.ja || "");
    setNewPromptContent("");
    setNewPolicyContent("");
    setNewRequiredRulesContent((requiredRulesData?.rules || []).join("\n"));
  };

  useEffect(() => {
    if (!evaluationSets.length) {
      setSelectedSetId("");
      return;
    }
    if (!selectedSetId || !evaluationSets.some((item) => item.id === selectedSetId)) {
      setSelectedSetId(evaluationSets[0].id);
    }
  }, [evaluationSets, selectedSetId]);

  useEffect(() => {
    if (!selectedSetId || activeTab !== "sets") return;
    if (typeof window === "undefined") return;
    // Small-screen UX: focus the detail panel after selecting an item from list.
    if (window.innerWidth <= 1024 && detailPanelRef.current && typeof detailPanelRef.current.scrollIntoView === "function") {
      detailPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedSetId, activeTab]);

  if (loadingRubrics || loadingPrompts || loadingPolicies || loadingSets) {
    return <LoadingState title={ui.loading} />;
  }
  const firstLoadError = rubricsError || promptsError || policiesError || setsError;
  if (firstLoadError) {
    return (
      <ErrorState
        title={ui.loadFailed}
        description={firstLoadError instanceof Error ? firstLoadError.message : String(firstLoadError || "")}
      />
    );
  }

  return (
    <div className="workspace-stack">
      <SectionBlock>
        <SectionBlock.Header title={ui.title} subtitle={ui.subtitle} />
        <SectionBlock.Body>
          <div className="ai-config-scope-grid">
            <div className="ai-config-scope-item">
              <label className="ai-config-scope-label">{ui.scopeDocumentType || t("sm.aiConfig.scopeDocumentType")}</label>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                {documentTypes.map((item) => {
                  const local = getDocumentTypeLabel(item, lang);
                  return <option key={item} value={item}>{`${local} (${item})`}</option>;
                })}
              </select>
            </div>
            <div className="ai-config-scope-item">
              <label className="ai-config-scope-label">{ui.scopeLevel || "Level"}</label>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                {LEVELS.map((item) => {
                  return <option key={item} value={item}>{getLevelLabel(item, lang)}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="ai-config-mode-note">
            {ui.modeNote}
          </div>
          <div ref={guideRef} className="ai-config-guide">
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className="btn-secondary btn-secondary--compact ai-config-guide__toggle"
            >
              {showGuide ? ui.quickGuideHide : ui.quickGuideShow}
            </button>
            {showGuide ? (
              <div className="ai-config-guide__content">
                <div>
                  <strong>{guide.partTitle}</strong>
                  {guide.partItems.map((item) => <div key={item}>{item}</div>)}
                </div>
                <div>
                  <strong>{guide.factorsTitle}</strong>
                  {guide.factorsItems.map((item) => <div key={item}>{item}</div>)}
                </div>
                <div>
                  <strong>{guide.whenNewTitle}</strong>
                  {guide.whenNewItems.map((item) => <div key={item}>{item}</div>)}
                </div>
                <div>
                  <strong>{guide.whenNotNewTitle}</strong>
                  {guide.whenNotNewItems.map((item) => <div key={item}>{item}</div>)}
                </div>
                <div>
                  <strong>{guide.impactTitle}</strong>
                  {guide.impactItems.map((item) => <div key={item}>{item}</div>)}
                </div>
                <div>
                  <strong>{guide.checklistTitle}</strong>
                  {guide.checklistItems.map((item) => <div key={item}>{item}</div>)}
                </div>
                <div>
                  <strong>{guide.definitionTitle}</strong>
                  {guide.definitionItems.map((item) => <div key={item}>{item}</div>)}
                </div>
                <div>
                  <strong>{guide.examplesTitle}</strong>
                  {guide.examplesItems.map((item) => <div key={item}>{item}</div>)}
                </div>
              </div>
            ) : null}
          </div>
          <div className="ai-config-tabs">
            <button className={activeTab === "sets" ? "btn-primary btn-primary--compact" : "btn-secondary btn-secondary--compact"} onClick={() => setActiveTab("sets")}>
              {ui.tabSets}
            </button>
            <button
              className={activeTab === "create" ? "btn-primary btn-primary--compact" : "btn-secondary btn-secondary--compact"}
              onClick={() => {
                if (hasCurrentSet) {
                  setActiveTab("create");
                  setCreateOpen(true);
                  openCreateFromCurrent();
                } else {
                  openCreateFromScratch();
                }
              }}
            >
              {ui.tabCreate}
            </button>
            <button
              className={activeTab === "compare" ? "btn-primary btn-primary--compact" : "btn-secondary btn-secondary--compact"}
              onClick={() => setActiveTab("compare")}
              disabled={!hasCurrentSet}
              title={!hasCurrentSet ? ui.noActiveSetTooltip : undefined}
            >
              {ui.tabCompare}
            </button>
          </div>

          {message ? (
            <div className={`rubric-message ${message.type === "error" ? "rubric-message--error" : "rubric-message--success"}`}>
              {message.text}
            </div>
          ) : null}

          {activeTab === "sets" ? <SectionBlock>
            <SectionBlock.Header title={ui.sectionSetList} subtitle={ui.sectionSetListSub} />
            <SectionBlock.Body>
              {!activeDetails ? (
                <div style={{ marginTop: 10, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 8, fontSize: 13 }}>
                  {ui.noActiveSet}
                  <div style={{ marginTop: 6, color: "#78350f" }}>
                    {ui.noActiveSetHelp}
                  </div>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn-secondary btn-secondary--compact" onClick={openCreateFromCurrent} disabled={!activeDetails}>
                  {ui.createFromCurrent}
                </button>
                {!activeDetails ? (
                  <button
                    className="btn-primary btn-primary--compact"
                    onClick={openCreateFromScratch}
                  >
                    {ui.bootstrapScope}
                  </button>
                ) : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, marginBottom: 8 }}>
                <input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder={ui.searchPlaceholder}
                />
                <button className="btn-secondary btn-secondary--compact" onClick={() => setShowArchived((prev) => !prev)}>
                  {showArchived ? ui.showActiveOnly : ui.showAllStatuses}
                </button>
                <select value={historyLimit} onChange={(event) => setHistoryLimit(Number(event.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
                  <div style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
                    {ui.historyShowing
                      .replace("{shown}", String(visibleHistory.length))
                      .replace("{total}", String(filteredHistoryCount))}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {visibleHistory.map((setItem) => {
                      const selected = selectedSetId === setItem.id;
                      return (
                        <button
                          key={setItem.id}
                          onClick={() => setSelectedSetId(setItem.id)}
                          style={{
                            border: selected ? "1px solid #2563eb" : "1px solid #e2e8f0",
                            background: selected ? "#eff6ff" : "#fff",
                            borderRadius: 8,
                            padding: 10,
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <div>
                            <strong>{setItem.name}</strong> | <span>{setItem.status}</span>
                            {selected ? (
                              <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8" }}>
                                {ui.selected}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            <strong>{ui.documentTypeLabel}:</strong> {setItem.document_type} |{" "}
                            <strong>{ui.promptLevel}:</strong> {setItem.level} |{" "}
                            <strong>{ui.createdAt}:</strong> {setItem.created_at}
                          </div>
                        </button>
                      );
                    })}
                    {!visibleHistory.length ? <div style={{ color: "#64748b" }}>{ui.noSet}</div> : null}
                  </div>
                </div>
                <div ref={detailPanelRef} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" }}>
                  <div style={{ marginBottom: 8 }}><strong>{ui.setDetail}</strong></div>
                  {selectedSet ? (
                    <>
                      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ color: "#334155", fontSize: 12 }}>
                          <strong>{selectedSet.name}</strong> | {selectedSet.status}
                        </div>
                        <button
                          type="button"
                          className="btn-secondary btn-secondary--compact"
                          onClick={() => setShowSelectedSetDetail((prev) => !prev)}
                        >
                          {showSelectedSetDetail ? ui.hideDetail : ui.showDetail}
                        </button>
                      </div>
                      {showSelectedSetDetail ? (
                        <>
                          <div style={{ marginBottom: 10, color: "#334155", fontSize: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 8 }}>
                            {ui.readOnlyNotice}
                          </div>
                          <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 10 }}>
                            <div><strong>{ui.setNameLabel}:</strong> {selectedSet.name}</div>
                            <div><strong>{ui.statusLabel}:</strong> {selectedSet.status}</div>
                            <div><strong>{ui.documentTypeLabel}:</strong> {selectedSet.document_type}</div>
                            <div><strong>{ui.levelLabel}:</strong> {selectedSet.level}</div>
                            <div><strong>{ui.rubricLabel}:</strong> {selectedSet.rubric?.version || t("common.noValue")}</div>
                            <div><strong>{ui.promptLabel}:</strong> {selectedSet.prompt?.version || t("common.noValue")}</div>
                            <div><strong>{ui.policyLabel}:</strong> {selectedSet.policy?.version || t("common.noValue")}</div>
                            <div><strong>{ui.requiredRulesVersionLabel}:</strong> {selectedSet.required_rules_version}</div>
                            <div><strong>{ui.requiredRulesHashLabel}:</strong> {(selectedSet.required_rule_hash || t("common.noValue")).slice(0, 16)}...</div>
                          </div>
                          <div style={{ display: "grid", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{ui.rubricReadonly}</div>
                              <textarea value={selectedSet.rubric?.prompt?.vi || selectedSet.rubric?.prompt?.ja || ""} rows={4} readOnly style={{ width: "100%", opacity: 0.9 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{ui.promptReadonly}</div>
                              <textarea value={selectedSet.prompt?.content || ""} rows={4} readOnly style={{ width: "100%", opacity: 0.9 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{ui.policyReadonly}</div>
                              <textarea value={selectedSet.policy?.content || ""} rows={4} readOnly style={{ width: "100%", opacity: 0.9 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{ui.rulesReadonly}</div>
                              <textarea value={(requiredRulesData?.rules || []).join("\n")} rows={4} readOnly style={{ width: "100%", opacity: 0.9 }} />
                            </div>
                          </div>
                        </>
                      ) : null}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn-secondary btn-secondary--compact"
                          onClick={() => {
                            openCreateFromCurrent();
                            setActiveTab("create");
                          }}
                        >
                          {ui.createFromThisSet}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-secondary--compact"
                          onClick={() => {
                            setCompareLeftId(selectedSet.id);
                            setCompareRightId(activeSet?.id && activeSet.id !== selectedSet.id ? activeSet.id : "");
                            setActiveTab("compare");
                          }}
                        >
                          {ui.compareWithOtherSet}
                        </button>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <strong>{ui.history}</strong>
                        <div style={{ marginTop: 6, display: "grid", gap: 6, maxHeight: 180, overflow: "auto" }}>
                          {evaluationSets.map((item) => (
                            <div key={`hist-${item.id}`} style={{ fontSize: 12, color: "#475569", borderLeft: "2px solid #cbd5e1", paddingLeft: 8 }}>
                              <div><strong>{item.name}</strong> ({item.status})</div>
                              <div>{item.created_at}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#64748b", fontSize: 13 }}>{ui.selectFromList}</div>
                  )}
                </div>
              </div>
            </SectionBlock.Body>
          </SectionBlock> : null}

          {activeTab === "compare" ? <SectionBlock>
            <SectionBlock.Header title={ui.compareTitle} subtitle={ui.compareSub} />
            <SectionBlock.Body>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <select value={compareLeftId} onChange={(event) => setCompareLeftId(event.target.value ? Number(event.target.value) : "")}>
                  <option value="">{ui.leftSet}</option>
                  {evaluationSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={compareRightId} onChange={(event) => setCompareRightId(event.target.value ? Number(event.target.value) : "")}>
                  <option value="">{ui.rightSet}</option>
                  {evaluationSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>{renderSet(leftSet, t)}</pre>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>{renderSet(rightSet, t)}</pre>
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>{ui.diff}</strong>
                <div style={{ maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8, borderRadius: 8 }}>
                  {renderDiff(renderSet(leftSet, t), renderSet(rightSet, t))}
                </div>
              </div>
              {compareSummary ? (
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(4,minmax(100px,1fr))", gap: 8, fontSize: 12 }}>
                  <div><strong>{ui.rubricCompareLabel}:</strong> {compareSummary.rubric === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>{ui.promptCompareLabel}:</strong> {compareSummary.prompt === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>{ui.policyCompareLabel}:</strong> {compareSummary.policy === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>{ui.rulesCompareLabel}:</strong> {compareSummary.rules === "changed" ? ui.changed : ui.unchanged}</div>
                </div>
              ) : null}
            </SectionBlock.Body>
          </SectionBlock> : null}

        </SectionBlock.Body>
      </SectionBlock>

      {createOpen && activeTab === "create" ? (
        <SectionBlock>
          <SectionBlock.Header title={ui.createTitle} subtitle={`${ui.step} ${createStep}/2`} />
          <SectionBlock.Body>
            {createStep === 1 ? (
              <>
                <input value={setName} onChange={(event) => setSetName(event.target.value)} placeholder={ui.setName} style={{ width: "100%", marginBottom: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, color: "#475569", fontSize: 13 }}>
                  <div>{ui.docType}: <strong>{documentType}</strong></div>
                  <div>
                    {ui.promptLevel}: <strong>{level}</strong>
                    {helpDot(
                      ui.levelHelp
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--compact"
                    onClick={() => {
                      setShowGuide(true);
                      if (guideRef.current && typeof guideRef.current.scrollIntoView === "function") {
                        guideRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                  >
                    {ui.openGuide}
                  </button>
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changeRubric} onChange={(event) => setChangeRubric(event.target.checked)} /> {ui.changeRubric}
                    {helpDot(
                      ui.rubricHelp
                    )}
                  </label>
                  {changeRubric ? (
                    <>
                      <textarea value={newRubricContent} onChange={(event) => setNewRubricContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} />
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, background: "#f8fafc", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                          {ui.rubricCriteriaLabel}
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {manualCriteria.map((row, idx) => (
                            <div key={`criterion-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 1fr auto", gap: 6, alignItems: "center" }}>
                              <input
                                value={row.key}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, key: event.target.value } : it))}
                                placeholder={ui.criterionKeyPlaceholder}
                              />
                              <input
                                type="number"
                                value={row.max_score}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, max_score: Number(event.target.value) || 0 } : it))}
                                placeholder={ui.criterionMaxPlaceholder}
                              />
                              <input
                                value={row.label_vi}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, label_vi: event.target.value } : it))}
                                placeholder={ui.criterionLabelViPlaceholder}
                              />
                              <input
                                value={row.label_ja}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, label_ja: event.target.value } : it))}
                                placeholder={ui.criterionLabelJaPlaceholder}
                              />
                              <button
                                type="button"
                                className="btn-secondary btn-secondary--compact"
                                onClick={() => setManualCriteria((prev) => prev.filter((_, i) => i !== idx))}
                                disabled={manualCriteria.length <= 1}
                              >
                                -
                              </button>
                            </div>
                          ))}
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                            <span>
                              {ui.totalScorePrefix + manualCriteria.reduce((sum, item) => sum + (Number(item.max_score) || 0), 0)}
                            </span>
                            <button
                              type="button"
                              className="btn-secondary btn-secondary--compact"
                              onClick={() => setManualCriteria((prev) => [...prev, { key: "", max_score: 0, label_vi: "", label_ja: "" }])}
                            >
                              {ui.addCriterion}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changePrompt} onChange={(event) => setChangePrompt(event.target.checked)} /> {ui.changePrompt}
                    {helpDot(
                      ui.promptHelp
                    )}
                  </label>
                  {changePrompt ? <textarea value={newPromptContent} onChange={(event) => setNewPromptContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} /> : null}
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changePolicy} onChange={(event) => setChangePolicy(event.target.checked)} /> {ui.changePolicy}
                    {helpDot(
                      ui.policyHelp
                    )}
                  </label>
                  {changePolicy ? <textarea value={newPolicyContent} onChange={(event) => setNewPolicyContent(event.target.value)} rows={5} style={{ width: "100%" }} /> : null}
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changeRequiredRules} onChange={(event) => setChangeRequiredRules(event.target.checked)} /> {ui.changeRules}
                    {helpDot(
                      ui.rulesHelp
                    )}
                  </label>
                  {changeRequiredRules ? <textarea value={newRequiredRulesContent} onChange={(event) => setNewRequiredRulesContent(event.target.value)} rows={6} style={{ width: "100%" }} /> : null}
                </div>
                {!hasEffectiveChange ? (
                  <div style={{ marginTop: 8, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 8 }}>
                    {ui.noEffectiveChange}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn-secondary btn-secondary--compact" onClick={() => { setCreateOpen(false); setActiveTab("sets"); }}>{ui.cancel}</button>
                  <button className="btn-primary btn-primary--compact" disabled={!setName.trim() || (!hasCurrentSet && (!newPromptContent.trim() || !newPolicyContent.trim()))} onClick={() => setCreateStep(2)}>{ui.review}</button>
                </div>
              </>
            ) : null}

            {createStep === 2 ? (
              <>
                <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  <div><strong>{ui.rubricLabel}:</strong> {effectiveRubricChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.rubric?.version || "-"}`}</div>
                  <div><strong>{ui.promptLabel}:</strong> {effectivePromptChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.prompt?.version || "-"}`}</div>
                  <div><strong>{ui.policyLabel}:</strong> {effectivePolicyChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.policy?.version || "-"}`}</div>
                  <div><strong>{ui.requiredRulesVersionLabel}:</strong> {effectiveRequiredRulesChange ? ui.newVersion : `${activeDetails?.required_rules_version || "system-rules-v1"} (${(activeDetails?.required_rule_hash || "-").slice(0, 16)}...)`}</div>
                  <div><strong>{ui.setNameSummary}:</strong> {setName}</div>
                </div>
                <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
                  {ui.reviewHint}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn-secondary btn-secondary--compact" onClick={() => setCreateStep(1)}>{ui.back}</button>
                  <button
                    className="btn-secondary btn-secondary--compact"
                    disabled={createSetMutation.isPending || createFirstSetMutation.isPending || !hasCurrentSet}
                    onClick={() => createSetMutation.mutate(false)}
                  >
                    {(createSetMutation.isPending || createFirstSetMutation.isPending) ? ui.saving : ui.saveArchived}
                  </button>
                  <button
                    className="btn-primary btn-primary--compact"
                    disabled={createSetMutation.isPending || createFirstSetMutation.isPending}
                    onClick={() => {
                      if (hasCurrentSet) {
                        setActivateConfirmOpen(true);
                      } else {
                        createFirstSetMutation.mutate();
                      }
                    }}
                  >
                    {ui.saveAndActivate}
                  </button>
                </div>
              </>
            ) : null}
          </SectionBlock.Body>
        </SectionBlock>
      ) : null}

      <ConfirmDialog
        open={activateConfirmOpen}
        title={ui.activationTitle}
        description={ui.activationDesc}
        confirmLabel={ui.saveAndActivate}
        cancelLabel={ui.cancel}
        pending={createSetMutation.isPending}
        onCancel={() => setActivateConfirmOpen(false)}
        onConfirm={() => {
          setActivateConfirmOpen(false);
          createSetMutation.mutate(true);
        }}
      />
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
} | null, t: (key: string) => string) {
  if (!setItem) return t("sm.aiConfig.noSetSelected");
  return [
    `${t("sm.aiConfig.dumpName")}: ${setItem.name}`,
    `${t("sm.aiConfig.dumpStatus")}: ${setItem.status}`,
    `${t("sm.aiConfig.dumpLevel")}: ${setItem.level}`,
    `${t("sm.aiConfig.dumpRubric")}: ${setItem.rubric?.version || t("common.noValue")}`,
    `${t("sm.aiConfig.dumpPrompt")}: ${setItem.prompt?.version || t("common.noValue")}`,
    `${t("sm.aiConfig.dumpPolicy")}: ${setItem.policy?.version || t("common.noValue")}`,
    `${t("sm.aiConfig.dumpRulesHash")}: ${setItem.required_rule_hash}`,
    "",
    `${t("sm.aiConfig.dumpPromptContent")}:`,
    setItem.prompt?.content || t("common.noValue"),
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


