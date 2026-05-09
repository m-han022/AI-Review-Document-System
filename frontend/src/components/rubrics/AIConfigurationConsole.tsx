import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";


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
import type { EvaluationSet } from "../../types";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Button, Card, Input, Select, StatusBadge } from "../ui";
import { EmptyState, ErrorState, LoadingState } from "../ui/States";
import { useTranslation } from "../LanguageSelector";
import { toHumanErrorMessage } from "../../utils/humanizeError";

const LEVELS = ["low", "medium", "high"] as const;
type ConfigTab = "sets" | "create" | "compare";

function renderSet(setItem: any, t: any) {
  if (!setItem) return t("common.noData");
  return JSON.stringify({
    name: setItem.name,
    version: setItem.version_label,
    rubric: setItem.rubric?.version,
    prompt: setItem.prompt?.version,
    policy: setItem.policy?.version
  }, null, 2);
}

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
  const [createStep, setCreateStep] = useState(1);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [showArchived] = useState(true);
  const [historyLimit] = useState(50);
  const [historySearch, setHistorySearch] = useState("");
  const [compareLeftId, setCompareLeftId] = useState<number | "">("");
  const [compareRightId, setCompareRightId] = useState<number | "">("");
  const [selectedSetId, setSelectedSetId] = useState<number | "">("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("sets");
  const [showGuide, setShowGuide] = useState(false);

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
  const [manualCriteria] = useState<Array<{ key: string; max_score: number; label_vi: string; label_ja: string }>>([
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

  const compareSummary = useMemo(() => {
    if (!leftSet || !rightSet) return null;
    return {
      rubric: leftSet.rubric?.id === rightSet.rubric?.id ? "unchanged" : "changed",
      prompt: leftSet.prompt?.id === rightSet.prompt?.id ? "unchanged" : "changed",
      policy: leftSet.policy?.id === rightSet.policy?.id ? "unchanged" : "changed",
      rules: leftSet.required_rule_hash === rightSet.required_rule_hash ? "unchanged" : "changed",
    };
  }, [leftSet, rightSet]);



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
      setMessage({ type: "success", text: ui.createSuccess });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-set-active", documentType, level] }),
      ]);
      setActiveTab("sets");
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

      if (changeRubric && newRubricContent.trim()) {
         const fallbackManual = manualCriteria.map(item => ({
            key: item.key.trim(),
            max_score: item.max_score,
            labels: { vi: item.label_vi, ja: item.label_ja }
         }));
         await createMgmtRubric({
          document_type: documentType,
          version: nextVersion(scopeRubrics.map(r => r.version)),
          prompt: { vi: newRubricContent.trim() },
          criteria: fallbackManual,
          activate: true,
        });
      }

      await createMgmtPrompt({
        document_type: documentType,
        level,
        version: nextVersion(prompts.filter(p => p.document_type === documentType && p.level === level).map(p => p.version)),
        content: newPromptContent.trim(),
        activate: true,
      });

      await createMgmtPolicy({
        level,
        version: nextVersion(policies.filter(p => p.level === level).map(p => p.version)),
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
      setMessage({ type: "success", text: ui.bootstrapSuccess });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-set-active", documentType, level] }),
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
    setActiveTab("create");
  };

  const openCreateFromScratch = () => {
    setActiveTab("create");
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

  if (loadingRubrics || loadingPrompts || loadingPolicies || loadingSets) {
    return <LoadingState title={ui.loading} />;
  }

  const firstLoadError = rubricsError || promptsError || policiesError || setsError;
  if (firstLoadError) {
    return (
      <ErrorState
        title={ui.loadFailed}
        description={toHumanErrorMessage(firstLoadError, ui.loadFailed)}
      />
    );
  }

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
    ]
  };

  return (
    <div className="workspace-stack">
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 'var(--ds-space-5)',
        marginBottom: 'var(--ds-space-5)' 
      }}>
        <Card 
          title={ui.scopeDocumentType || t("sm.aiConfig.scopeDocumentType")}
          className="ds-card--interactive"
          padding="var(--ds-space-3) var(--ds-space-5)"
          headerAction={
            <div style={{ width: '280px' }}>
              <Select 
                value={documentType} 
                onChange={(e) => setDocumentType(e.target.value)}
                options={documentTypes.map(item => ({
                  value: item,
                  label: `${getDocumentTypeLabel(item, lang)} (${item})`
                }))}
              />
            </div>
          }
        >
          <div style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)' }}>
            {"Xác định loại tài liệu và mục tiêu kiểm soát để AI áp dụng đúng bối cảnh đánh giá."}
          </div>
        </Card>

        <Card 
          title={ui.scopeLevel || "Level"}
          className="ds-card--interactive"
          padding="var(--ds-space-3) var(--ds-space-5)"
          headerAction={
            <div style={{ width: '180px' }}>
              <Select 
                value={level} 
                onChange={(e) => setLevel(e.target.value)}
                options={LEVELS.map(item => ({
                  value: item,
                  label: getLevelLabel(item, lang)
                }))}
              />
            </div>
          }
        >
          <div style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)' }}>
            {"Điều chỉnh độ nghiêm ngặt và chiều sâu của các nhận xét AI (Thấp: hỗ trợ, Vừa: tiêu chuẩn, Cao: khắt khe)."}
          </div>
        </Card>
      </div>

      <div ref={guideRef} className="ai-config-guide" style={{ marginBottom: 'var(--ds-space-5)' }}>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowGuide((prev) => !prev)}
        >
          {showGuide ? ui.quickGuideHide : ui.quickGuideShow}
        </Button>
        {showGuide && (
          <div style={{ marginTop: 'var(--ds-space-3)' }}>
            <Card>
            <div className="governance-grid">
              <div className="detail-section">
                <span className="detail-section__title">{guide.partTitle}</span>
                {guide.partItems.map((item) => (
                  <div key={item} style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', marginTop: '4px' }}>• {item}</div>
                ))}
              </div>
              <div className="detail-section">
                <span className="detail-section__title">{guide.factorsTitle}</span>
                {guide.factorsItems.map((item) => (
                  <div key={item} style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', marginTop: '4px' }}>• {item}</div>
                ))}
              </div>
            </div>
            </Card>
          </div>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 'var(--ds-space-5)', display: 'flex', gap: '8px' }}>
        <Button 
          variant={activeTab === "sets" ? "primary" : "outline"} 
          onClick={() => setActiveTab("sets")}
        >
          {ui.tabSets}
        </Button>
        <Button 
          variant={activeTab === "create" ? "primary" : "outline"} 
          onClick={() => {
            if (hasCurrentSet) {
              setActiveTab("create");
              openCreateFromCurrent();
            } else {
              openCreateFromScratch();
            }
          }}
        >
          {ui.tabCreate}
        </Button>
        <Button 
          variant={activeTab === "compare" ? "primary" : "outline"} 
          onClick={() => setActiveTab("compare")}
          disabled={!hasCurrentSet}
        >
          {ui.tabCompare}
        </Button>
      </div>

      {message && (
        <div style={{ marginBottom: 'var(--ds-space-4)' }}>
          <StatusBadge tone={message.type === "success" ? "success" : "danger"}>
            {message.text}
          </StatusBadge>
        </div>
      )}

      <main>
        {activeTab === "sets" && (
          <div className="governance-explorer">
            <aside className="governance-explorer__sidebar" style={{ width: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="detail-section__title">{ui.sectionSetList}</h3>
                <Button variant="primary" size="sm" onClick={openCreateFromCurrent} disabled={!activeDetails}>
                  {t("common.new")}
                </Button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <Input 
                    value={historySearch} 
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder={ui.searchPlaceholder}
                  />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {visibleHistory.map((setItem) => (
                  <button
                    key={setItem.id}
                    className={`submission-card__button ${selectedSetId === setItem.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedSetId(setItem.id)}
                    style={{ textAlign: 'left', width: '100%' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>{setItem.name}</div>
                      <StatusBadge tone={setItem.status === "active" ? "success" : "muted"}>
                        {setItem.status}
                      </StatusBadge>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ds-color-text-muted)', marginTop: '4px' }}>
                      {setItem.created_at} • {setItem.version_label || "v1"}
                    </div>
                  </button>
                ))}
                {visibleHistory.length === 0 && <EmptyState title={ui.noSet} compact />}
              </div>
            </aside>

            <div className="governance-explorer__content">
              {selectedSet ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <Card title={ui.setDetail}>
                    <div className="governance-grid">
                      <div className="detail-section">
                        <span className="detail-section__title">{ui.setNameLabel}</span>
                        <div>{selectedSet.name}</div>
                      </div>
                      <div className="detail-section">
                        <span className="detail-section__title">{ui.statusLabel}</span>
                        <StatusBadge tone={selectedSet.status === "active" ? "success" : "muted"}>
                          {selectedSet.status}
                        </StatusBadge>
                      </div>
                      <div className="detail-section">
                        <span className="detail-section__title">{ui.rubricLabel}</span>
                        <div>{selectedSet.rubric?.version || "—"}</div>
                      </div>
                      <div className="detail-section">
                        <span className="detail-section__title">{ui.promptLabel}</span>
                        <div>{selectedSet.prompt?.version || "—"}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                      <Button variant="primary" size="sm" onClick={openCreateFromCurrent}>
                        {ui.createFromThisSet}
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => {
                        setCompareLeftId(selectedSet.id);
                        setCompareRightId(activeSet?.id && activeSet.id !== selectedSet.id ? activeSet.id : "");
                        setActiveTab("compare");
                      }}>
                        {ui.compareWithOtherSet}
                      </Button>
                    </div>
                  </Card>

                  <Card title={ui.rubricReadonly}>
                    <pre style={{ 
                      padding: '16px', borderRadius: 'var(--ds-radius-md)', 
                      backgroundColor: 'var(--ds-color-bg-muted)', fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                      color: 'var(--ds-color-text-main)'
                    }}>
                      {selectedSet.rubric?.prompt?.vi || selectedSet.rubric?.prompt?.ja || ""}
                    </pre>
                  </Card>

                  <Card title={ui.promptReadonly}>
                    <pre style={{ 
                      padding: '16px', borderRadius: 'var(--ds-radius-md)', 
                      backgroundColor: 'var(--ds-color-bg-muted)', fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                      color: 'var(--ds-color-text-main)'
                    }}>
                      {selectedSet.prompt?.content || ""}
                    </pre>
                  </Card>
                </div>
              ) : (
                <EmptyState title={ui.selectFromList} />
              )}
            </div>
          </div>
        )}

        {activeTab === "compare" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title={ui.compareTitle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <Select 
                  label={ui.leftSet}
                  value={String(compareLeftId)} 
                  onChange={(e) => setCompareLeftId(e.target.value ? Number(e.target.value) : "")}
                  options={[
                    { value: "", label: t("common.select") },
                    ...evaluationSets.map(item => ({ value: String(item.id), label: item.name }))
                  ]}
                />
                <Select 
                  label={ui.rightSet}
                  value={String(compareRightId)} 
                  onChange={(e) => setCompareRightId(e.target.value ? Number(e.target.value) : "")}
                  options={[
                    { value: "", label: t("common.select") },
                    ...evaluationSets.map(item => ({ value: String(item.id), label: item.name }))
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ 
                  padding: '16px', backgroundColor: 'var(--ds-color-bg-muted)', 
                  borderRadius: 'var(--ds-radius-md)'
                }}>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--ds-color-text-main)' }}>
                    {renderSet(leftSet, t)}
                  </pre>
                </div>
                <div style={{ 
                  padding: '16px', backgroundColor: 'var(--ds-color-bg-muted)', 
                  borderRadius: 'var(--ds-radius-md)'
                }}>
                  <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--ds-color-text-main)' }}>
                    {renderSet(rightSet, t)}
                  </pre>
                </div>
              </div>
            </Card>

            {compareSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <Card title={ui.rubricCompareLabel}>
                  <StatusBadge tone={compareSummary.rubric === "changed" ? "warning" : "success"}>
                    {compareSummary.rubric === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </Card>
                <Card title={ui.promptCompareLabel}>
                  <StatusBadge tone={compareSummary.prompt === "changed" ? "warning" : "success"}>
                    {compareSummary.prompt === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </Card>
                <Card title={ui.policyCompareLabel}>
                  <StatusBadge tone={compareSummary.policy === "changed" ? "warning" : "success"}>
                    {compareSummary.policy === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </Card>
                <Card title={ui.rulesCompareLabel}>
                  <StatusBadge tone={compareSummary.rules === "changed" ? "warning" : "success"}>
                    {compareSummary.rules === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <Card title={`${ui.createTitle} — ${ui.step} ${createStep}/2`}>
              {createStep === 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <Input 
                    label={ui.setName} 
                    value={setName} 
                    onChange={(e) => setSetName(e.target.value)}
                    placeholder="e.g. Q2-2026 Updated Standards"
                  />
                  
                  <div className="governance-grid">
                    <div className="detail-section">
                      <span className="detail-section__title">{ui.docType}</span>
                      <strong>{documentType}</strong>
                    </div>
                    <div className="detail-section">
                      <span className="detail-section__title">{ui.promptLevel}</span>
                      <strong>{level}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="detail-section">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '8px' }}>
                        <input type="checkbox" checked={changeRubric} onChange={(e) => setChangeRubric(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontWeight: 600 }}>{ui.changeRubric}</span>
                      </label>
                      {changeRubric && (
                        <textarea 
                          className="ds-input ds-input--textarea" 
                          value={newRubricContent} 
                          onChange={(e) => setNewRubricContent(e.target.value)} 
                          rows={4} 
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--ds-color-border)', fontFamily: 'inherit' }}
                        />
                      )}
                    </div>

                    <div className="detail-section">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '8px' }}>
                        <input type="checkbox" checked={changePrompt} onChange={(e) => setChangePrompt(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontWeight: 600 }}>{ui.changePrompt}</span>
                      </label>
                      {changePrompt && (
                        <textarea 
                          className="ds-input ds-input--textarea" 
                          value={newPromptContent} 
                          onChange={(e) => setNewPromptContent(e.target.value)} 
                          rows={6} 
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--ds-color-border)', fontFamily: 'inherit' }}
                        />
                      )}
                    </div>

                    <div className="detail-section">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '8px' }}>
                        <input type="checkbox" checked={changePolicy} onChange={(e) => setChangePolicy(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontWeight: 600 }}>{ui.changePolicy}</span>
                      </label>
                      {changePolicy && (
                        <textarea 
                          className="ds-input ds-input--textarea" 
                          value={newPolicyContent} 
                          onChange={(e) => setNewPolicyContent(e.target.value)} 
                          rows={4} 
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--ds-color-border)', fontFamily: 'inherit' }}
                        />
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <Button variant="primary" onClick={() => setCreateStep(2)} disabled={!setName.trim() || (!hasCurrentSet && (!newPromptContent.trim() || !newPolicyContent.trim()))}>
                      {ui.review}
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ 
                    padding: '16px', borderRadius: 'var(--ds-radius-md)', 
                    backgroundColor: 'var(--ds-color-primary-soft)', 
                    color: 'var(--ds-color-primary)', fontSize: '14px',
                    border: '1px solid var(--ds-color-primary)'
                  }}>
                    <strong>{t("common.confirm")}</strong>
                    <p style={{ marginTop: '4px' }}>{ui.reviewHint}</p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <Button variant="outline" onClick={() => setCreateStep(1)}>{t("common.back")}</Button>
                    <Button 
                      variant="primary" 
                      onClick={() => {
                        if (hasCurrentSet) setActivateConfirmOpen(true);
                        else createFirstSetMutation.mutate();
                      }} 
                      isLoading={createSetMutation.isPending || createFirstSetMutation.isPending}
                    >
                      {ui.saveAndActivate}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={activateConfirmOpen}
        title={ui.activationTitle}
        description={ui.activationDesc}
        confirmLabel={ui.saveAndActivate}
        cancelLabel={ui.cancel}
        isLoading={createSetMutation.isPending}
        onCancel={() => setActivateConfirmOpen(false)}
        onConfirm={() => {
          setActivateConfirmOpen(false);
          createSetMutation.mutate(true);
        }}
      />
    </div>
  );
}
