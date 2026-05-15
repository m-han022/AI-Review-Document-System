import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";


import {
  activateEvaluationSet,
  approveEvaluationSet,
  archiveEvaluationSet,
  ApiClientError,
  bootstrapEvaluationSet,
  createMgmtPolicy,
  createMgmtPrompt,
  createMgmtRubric,
  createEvaluationSet,
  getActiveEvaluationSet,
  validateEvaluationSet,
  getRequiredRules,
  listEvaluationSets,
  listMgmtPolicies,
  listMgmtPrompts,
  listMgmtRubrics,
  getGlobalDefaults,
  getEvaluationSetRuntimeHealth,
  previewFinalPrompt,
  } from "../../api/client";
import { AI_CONFIG_COPY } from "../../constants/aiConfigCopy";
import { getDocumentTypeLabel, getLevelLabel } from "../../constants/uiLabels";
import { getLocalizedText } from "../../locales/utils";
import { mapErrorCodeToI18nKey } from "../../locales/errorMapping";
import type { EvaluationSet } from "../../types";
import ConfirmDialog from "../ui/ConfirmDialog";
import BaseModal from "../ui/BaseModal";
import { Button, Input, Select, StatusBadge } from "../ui";
import { EmptyState, ErrorState, LoadingState } from "../ui/States";
import { useTranslation } from "../LanguageSelector";
import { toHumanErrorMessage } from "../../utils/humanizeError";

const LEVELS = ["low", "medium", "high"] as const;
type ConfigTab = "sets" | "create" | "compare";

import { Tooltip } from "../ui/States";
import { HelpIcon, InfoIcon } from "../ui/Icon";

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
  const formatPreviewPromptForUi = (text: string): string => {
    if (!text) return text;
    const lines = text.split("\n");
    const sectionOrder = [
      "---- Rubric ----",
      "---- Prompt Version ----",
      "---- Evaluation Policy ----",
      "---- Required Rules ----",
      "---- Output Schema ----",
    ];
    const sectionMap = new Map<string, string[]>();
    let currentHeader = "";
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("---- ") && line.endsWith(" ----")) {
        currentHeader = line;
        if (!sectionMap.has(currentHeader)) sectionMap.set(currentHeader, [raw]);
        continue;
      }
      if (!currentHeader) continue;
      sectionMap.get(currentHeader)!.push(raw);
    }
    const normalizedLines = sectionOrder.flatMap((header) => sectionMap.get(header) || []);
    let inRequiredRules = false;
    const out: string[] = [];
    let inOutputSchema = false;
    for (const raw of normalizedLines) {
      const line = raw.trim();
      if (line === "---- Required Rules ----") {
        inRequiredRules = true;
        inOutputSchema = false;
        out.push(raw);
        continue;
      }
      if (line === "---- Output Schema ----") {
        inRequiredRules = false;
        inOutputSchema = true;
        out.push(raw);
        out.push(
          "YÃªu cáº§u Ä‘á»‹nh dáº¡ng Ä‘áº§u ra: AI pháº£i tráº£ vá» JSON há»£p lá»‡ theo schema Ä‘Ã£ cáº¥u hÃ¬nh (score, criteria_scores, criteria_suggestions, draft_feedback, page_reviews)."
        );
        out.push("LÆ°u Ã½ ká»¹ thuáº­t chi tiáº¿t Ä‘Ã£ Ä‘Æ°á»£c rÃºt gá»n trong mÃ n hÃ¬nh xem láº¡i.");
        continue;
      }
      if (line.startsWith("---- ") && line.endsWith(" ----") && line !== "---- Required Rules ----") {
        inRequiredRules = false;
        inOutputSchema = false;
        out.push(raw);
        continue;
      }
      if (inOutputSchema) {
        continue;
      }
      if (inRequiredRules && line.startsWith("{") && line.endsWith("}")) {
        try {
          const obj = JSON.parse(line) as { id?: number; vi?: string; en?: string; ja?: string };
          const id = typeof obj.id === "number" ? `${obj.id}. ` : "- ";
          const textVi = (obj.vi || obj.en || obj.ja || "").trim();
          if (textVi) {
            out.push(`${id}${textVi}`);
            continue;
          }
        } catch {
          // keep original line when parse fails
        }
      }
      out.push(raw);
    }
    return out.join("\n");
  };
  const { lang, t } = useTranslation();
  const ui = AI_CONFIG_COPY[lang] ?? AI_CONFIG_COPY.vi;

  const mapConfigErrorMessage = (error: unknown): string => {
    if (error instanceof ApiClientError) {
      const base = t(mapErrorCodeToI18nKey(error.code));
      return error.detail ? `${base} (${error.detail})` : base;
    }
    if (error instanceof Error && error.message) return error.message;
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
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "active" | "validated" | "approved" | "draft" | "archived">("all");
  const [compareLeftId, setCompareLeftId] = useState<number | "">("");
  const [compareRightId, setCompareRightId] = useState<number | "">("");
  const [selectedSetId, setSelectedSetId] = useState<number | "">("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("sets");
  const [showGuide, setShowGuide] = useState(false);
  const [isNewTypeModalOpen, setIsNewTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

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
  const [finalPromptPreviewText, setFinalPromptPreviewText] = useState("");
  const [finalPromptPreviewError, setFinalPromptPreviewError] = useState("");
  const [manualCriteria, setManualCriteria] = useState<Array<{ key: string; max_score: number; label_vi: string; label_ja: string }>>([
    { key: "review_tong_the", max_score: 25, label_vi: "ÄÃ¡nh giÃ¡ tá»•ng thá»ƒ", label_ja: "Overall review" },
    { key: "diem_tot", max_score: 25, label_vi: "Äiá»ƒm tá»‘t", label_ja: "Strengths" },
    { key: "diem_xau", max_score: 30, label_vi: "Äiá»ƒm cáº§n cáº£i thiá»‡n", label_ja: "Weak points" },
    { key: "chinh_sach", max_score: 20, label_vi: "ChÃ­nh sÃ¡ch cáº£i thiá»‡n", label_ja: "Improvement policy" },
  ]);
  const criteriaTotalScore = useMemo(
    () => manualCriteria.reduce((sum, item) => sum + (Number(item.max_score) || 0), 0),
    [manualCriteria],
  );
  const criteriaHasDuplicateKey = useMemo(() => {
    const keys = manualCriteria.map((item) => item.key.trim()).filter(Boolean);
    return new Set(keys).size !== keys.length;
  }, [manualCriteria]);
  const criteriaHasEmptyField = useMemo(
    () =>
      manualCriteria.some(
        (item) => !item.key.trim() || !item.label_vi.trim() || !item.label_ja.trim(),
      ),
    [manualCriteria],
  );
  const canProceedSchemaCheck =
    !changeRubric || (!criteriaHasDuplicateKey && criteriaTotalScore === 100 && !criteriaHasEmptyField);
  const isPlaceholderPrompt = (value?: string | null) => {
    const normalized = (value || "").trim().toLowerCase();
    return !normalized || normalized === "updated prompt content";
  };
  const isTestPolicy = (value?: string | null) => {
    const normalized = (value || "").trim().toLowerCase();
    return normalized === "perf policy";
  };
  const getDefaultPromptFromTemplate = (docType: string) => {
    const template = globalDefaults?.rubric_templates?.[docType];
    if (!template) return "";
    const instruction = template.instruction || {};
    return instruction[lang] || instruction.vi || instruction.en || instruction.ja || "";
  };
  const getDefaultPolicyFromGlobal = (scopeLevel: string) => {
    const policy = globalDefaults?.policies?.[scopeLevel];
    if (!policy) return "";
    if (typeof policy === "string") return policy;
    return policy[lang] || policy.vi || policy.en || policy.ja || "";
  };

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
  const { data: globalDefaults } = useQuery({
    queryKey: ["global-defaults", "v2"], // Force refetch after backend fix
    queryFn: getGlobalDefaults,
    staleTime: 0,
  });
  const { data: activeSet } = useQuery({
    queryKey: ["mgmt-evaluation-set-active", documentType, level],
    queryFn: () => getActiveEvaluationSet(documentType, level),
    retry: false,
  });
  const { data: runtimeHealthData } = useQuery({
    queryKey: ["runtime-health", documentType, level],
    queryFn: () => getEvaluationSetRuntimeHealth(),
    refetchInterval: 10000,
  });
  const runtimeHealth = runtimeHealthData?.items ?? [];
  const runtimeThresholds = runtimeHealthData?.thresholds ?? { fail_rate: 0.2, p95_latency_seconds: 120 };
  const resolutionReasonTotals = runtimeHealthData?.resolution_reason_totals ?? {};

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
      .filter((item) => historyStatusFilter === "all" || (item.status || "").toLowerCase() === historyStatusFilter)
      .filter((item) => !keyword || item.name.toLowerCase().includes(keyword) || (item.version_label || "").toLowerCase().includes(keyword))
      .slice(0, historyLimit);
  }, [evaluationSets, showArchived, historySearch, historyLimit, historyStatusFilter]);

  const draftImpact = useMemo(() => {
    if (!activeDetails) return { rubric: "new", prompt: "new", policy: "new", rules: "new" };
    return {
      rubric: changeRubric ? "changed" : "unchanged",
      prompt: changePrompt ? "changed" : "unchanged",
      policy: changePolicy ? "changed" : "unchanged",
      rules: changeRequiredRules ? "changed" : "unchanged",
    };
  }, [activeDetails, changeRubric, changePrompt, changePolicy, changeRequiredRules]);

  const compareSummary = useMemo(() => {
    if (!leftSet || !rightSet) return null;
    return {
      rubric: leftSet.rubric?.id === rightSet.rubric?.id ? "unchanged" : "changed",
      prompt: leftSet.prompt?.id === rightSet.prompt?.id ? "unchanged" : "changed",
      policy: leftSet.policy?.id === rightSet.policy?.id ? "unchanged" : "changed",
      rules: leftSet.required_rule_hash === rightSet.required_rule_hash ? "unchanged" : "changed",
    };
  }, [leftSet, rightSet]);
  const scopedRuntimeHealth = useMemo(
    () =>
      runtimeHealth
        .filter((item) => item.document_type === documentType && item.prompt_level === level)
        .sort((a, b) => b.run_count - a.run_count),
    [runtimeHealth, documentType, level],
  );
  const lifecycleOrder = ["draft", "validated", "approved", "active", "archived"];
  const currentLifecycleIndex = lifecycleOrder.indexOf((selectedSet?.status || "").toLowerCase());
  const canValidate = selectedSet && ["draft"].includes((selectedSet.status || "").toLowerCase());
  const canApprove = selectedSet && ["validated"].includes((selectedSet.status || "").toLowerCase());
  const canActivate = selectedSet && ["approved", "validated", "archived"].includes((selectedSet.status || "").toLowerCase());
  const canArchive = selectedSet && ["draft", "validated", "approved", "active"].includes((selectedSet.status || "").toLowerCase());



  const createSetMutation = useMutation({
    mutationFn: (activate: boolean) => {
      if (!activeSet) throw new Error(ui.noActiveSet);
      return createEvaluationSet({
        base_set_id: activeSet.id,
        name: setName.trim() || `${documentType}-${level}-${Date.now()}`,
        changes: {
          rubric_content: changeRubric ? newRubricContent : null,
          rubric_criteria: changeRubric ? JSON.stringify(manualCriteria) : null,
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

  const mutateBundleState = useMutation({
    mutationFn: async (vars: { id: number; action: "validate" | "approve" | "activate" | "archive" }) => {
      if (vars.action === "validate") return validateEvaluationSet(vars.id);
      if (vars.action === "approve") return approveEvaluationSet(vars.id);
      if (vars.action === "archive") return archiveEvaluationSet(vars.id);
      return activateEvaluationSet(vars.id);
    },
    onSuccess: async () => {
      setMessage({ type: "success", text: "Bundle status updated." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-set-active", documentType, level] }),
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

      if (changeRubric && newRubricContent.trim()) {
         if (criteriaTotalScore !== 100) {
          throw new Error("Tá»•ng trá»ng sá»‘ tiÃªu chÃ­ pháº£i báº±ng 100.");
         }
         if (criteriaHasDuplicateKey) {
          throw new Error("TiÃªu chÃ­ bá»‹ trÃ¹ng key. Vui lÃ²ng sá»­a trÆ°á»›c khi lÆ°u.");
         }
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
    const currentPrompt = activeDetails?.prompt?.content || "";
    const currentPolicy = activeDetails?.policy?.content || "";
    setNewPromptContent(
      isPlaceholderPrompt(currentPrompt) ? getDefaultPromptFromTemplate(documentType) : currentPrompt,
    );
    setNewPolicyContent(
      isTestPolicy(currentPolicy) ? getDefaultPolicyFromGlobal(level) : currentPolicy,
    );
    setNewRequiredRulesContent((requiredRulesData?.rules || []).map((r: any) => 
      typeof r === 'string' ? r : (r[lang] || r.vi || r.en || "")
    ).join("\n"));
    const activeCriteria = (activeDetails?.rubric as any)?.criteria ?? [];
    if (activeCriteria.length) {
      setManualCriteria(
        activeCriteria.map((c: any) => ({
          key: c.key || "",
          max_score: Number(c.max_score) || 0,
          label_vi: c.labels?.vi || c.label_vi || c.key || "",
          label_ja: c.labels?.ja || c.label_ja || c.key || "",
        })),
      );
    }
    setCreateStep(1);
    setFinalPromptPreviewText("");
    setFinalPromptPreviewError("");
    setActiveTab("create");
  };

  const openCreateFromScratch = () => {
    setActiveTab("create");
    setSetName(`${documentType} ${level} set v1`);
    setCreateStep(1);
    setFinalPromptPreviewText("");
    setFinalPromptPreviewError("");
    setChangeRubric(false);
    setChangePrompt(true);
    setChangePolicy(true);
    setChangeRequiredRules(false);
    const activeRubric = rubrics.find((r) => r.document_type === documentType && r.status === "active") || rubrics.find((r) => r.document_type === documentType);
    setNewRubricContent(activeRubric?.prompt?.vi || activeRubric?.prompt?.ja || "");
    const activePromptForScope =
      prompts.find((p) => p.document_type === documentType && p.level === level && p.status === "active")
      || prompts.find((p) => p.document_type === documentType && p.level === level);
    const activePolicyForLevel =
      policies.find((p) => p.level === level && p.status === "active")
      || policies.find((p) => p.level === level);
    const promptValue = activePromptForScope?.content || "";
    const policyValue = activePolicyForLevel?.content || "";
    setNewPromptContent(
      isPlaceholderPrompt(promptValue) ? getDefaultPromptFromTemplate(documentType) : promptValue,
    );
    setNewPolicyContent(
      isTestPolicy(policyValue) ? getDefaultPolicyFromGlobal(level) : policyValue,
    );
    setNewRequiredRulesContent((requiredRulesData?.rules || []).map((r: any) => 
      typeof r === 'string' ? r : (r[lang] || r.vi || r.en || "")
    ).join("\n"));
    const criteriaFromTemplate = globalDefaults?.rubric_templates?.[documentType]?.criteria || [];
    if (criteriaFromTemplate.length) {
      setManualCriteria(
        criteriaFromTemplate.map((c: any) => ({
          key: c.key || "",
          max_score: Number(c.max_score) || 0,
          label_vi: c.label?.vi || c.key || "",
          label_ja: c.label?.ja || c.key || "",
        })),
      );
    }
  };

  useEffect(() => {
    const runPreview = async () => {
      if (createStep !== 2) return;
      setFinalPromptPreviewError("");
      if (!canProceedSchemaCheck) {
        setFinalPromptPreviewText("");
        setFinalPromptPreviewError("Schema tiÃªu chÃ­ chÆ°a há»£p lá»‡. Vui lÃ²ng sá»­a trÆ°á»›c khi lÆ°u.");
        return;
      }
      try {
        const res = await previewFinalPrompt(documentType, level);
        setFinalPromptPreviewText(formatPreviewPromptForUi(res.full_prompt_preview || ""));
      } catch (e) {
        setFinalPromptPreviewText("");
        setFinalPromptPreviewError(e instanceof Error ? e.message : "KhÃ´ng thá»ƒ preview final prompt.");
      }
    };
    runPreview();
  }, [createStep, canProceedSchemaCheck, documentType, level]);

  const bootstrapMutation = useMutation({
    mutationFn: (vars: { type: string; level: string }) => bootstrapEvaluationSet({
      document_type: vars.type,
      level: vars.level,
      name: `${vars.type}-${vars.level}-auto-v1`
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mgmt-rubrics"] });
      queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets"] });
      setDocumentType(data.document_type);
      setLevel(data.level);
      setIsNewTypeModalOpen(false);
      setNewTypeName("");
      setSelectedTemplate("");
      setMessage({ type: "success", text: ui.newTypeSuccess });
    },
    onError: (error) => {
      setMessage({ type: "error", text: ui.newTypeErrorPrefix + mapConfigErrorMessage(error) });
    }
  });

  const handleCreateNewType = () => {
    const typeToCreate = newTypeName || selectedTemplate;
    if (!typeToCreate) return;
    bootstrapMutation.mutate({ type: typeToCreate, level: level });
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
      <div className="analytical-header-v4__selectors" style={{ padding: 'var(--ds-space-3) var(--ds-space-4)', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: 'var(--ds-space-6)'
        }}>
          {/* Left: Document Type Scope */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-4)', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="ds-caption" style={{ fontWeight: 700, color: 'var(--ds-color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                {ui.scopeDocumentType || "Document Type"}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '420px' }}>
                <div style={{ flex: 1 }}>
                  <Select 
                    value={documentType} 
                    onChange={(e) => setDocumentType(e.target.value)}
                    options={documentTypes.map(item => ({
                      value: item,
                      label: `${getDocumentTypeLabel(item, lang)} (${item})`
                    }))}
                  />
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setIsNewTypeModalOpen(true)}
                  title={ui.newTypeBtnTooltip}
                  style={{ height: 'var(--ds-control-height)' }}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Middle: Level Scope */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="ds-caption" style={{ fontWeight: 700, color: 'var(--ds-color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                {ui.scopeLevel || "Evaluation Level"}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '220px' }}>
                <div style={{ flex: 1 }}>
                  <Select 
                    value={level} 
                    onChange={(e) => setLevel(e.target.value)}
                    options={LEVELS.map(item => ({
                      value: item,
                      label: getLevelLabel(item, lang)
                    }))}
                  />
                </div>
                <Tooltip content={globalDefaults?.policies[level]?.[lang] || "..."}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    borderRadius: 'var(--ds-radius-full)',
                    backgroundColor: 'var(--ds-color-bg-app)',
                    color: 'var(--ds-color-primary)',
                    cursor: 'help'
                  }}>
                    <InfoIcon size="sm" />
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Right: Quick Guide Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-end', height: 'var(--ds-control-height)' }}>
            <Button 
              variant={showGuide ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowGuide((prev) => !prev)}
              style={{ gap: '8px' }}
            >
              <HelpIcon size="sm" />
              {showGuide ? ui.quickGuideHide : ui.quickGuideShow}
            </Button>
          </div>
        </div>
      </div>

      <div ref={guideRef} className="ai-config-guide" style={{ marginBottom: showGuide ? 'var(--ds-space-5)' : 0 }}>
        {showGuide && (
          <div style={{ marginTop: 'var(--ds-space-3)' }}>
            <div style={{ padding: '16px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
            <div className="governance-grid">
              <div className="detail-section">
                <span className="detail-section__title">{guide.partTitle}</span>
                {guide.partItems.map((item) => (
                  <div key={item} style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', marginTop: '4px' }}>â€¢ {item}</div>
                ))}
              </div>
              <div className="detail-section">
                <span className="detail-section__title">{guide.factorsTitle}</span>
                {guide.factorsItems.map((item) => (
                  <div key={item} style={{ fontSize: '13px', color: 'var(--ds-color-text-muted)', marginTop: '4px' }}>â€¢ {item}</div>
                ))}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "16px", background: "var(--ds-color-surface)", border: "1px solid var(--ds-color-border)", borderRadius: "var(--ds-radius-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong>Runtime Health</strong>
          <span style={{ color: "var(--ds-color-text-muted)", fontSize: 12 }}>
            {documentType} / {level} â€¢ fail&gt;={(runtimeThresholds.fail_rate * 100).toFixed(0)}% â€¢ p95&gt;={runtimeThresholds.p95_latency_seconds}s
          </span>
        </div>
        {scopedRuntimeHealth.length === 0 ? (
          <div style={{ color: "var(--ds-color-text-muted)", fontSize: 13 }}>No runtime metric yet for this scope.</div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {Object.entries(resolutionReasonTotals).map(([reason, count]) => (
                <StatusBadge key={reason} tone="muted">{reason}: {count}</StatusBadge>
              ))}
            </div>
            <div className="ds-table-container">
            <table className="ds-table ds-table--compact">
              <thead>
                <tr>
                  <th>Evaluation Set</th>
                  <th>Status</th>
                  <th>Runs</th>
                  <th>Avg Latency (s)</th>
                  <th>P95 Latency (s)</th>
                  <th>Failed Rate (scope)</th>
                  <th>Trend</th>
                  <th>Alert</th>
                </tr>
              </thead>
              <tbody>
                {scopedRuntimeHealth.map((item, idx) => (
                  <tr key={`${item.evaluation_set_id}-${item.status}-${idx}`} className="ds-table-row-v4">
                    <td>{item.evaluation_set_id ?? "none"}</td>
                    <td>{item.status}</td>
                    <td>{item.run_count}</td>
                    <td>{item.avg_latency_seconds.toFixed(2)}</td>
                    <td>{(item.p95_latency_seconds ?? 0).toFixed(2)}</td>
                    <td>{(item.failed_rate_scope * 100).toFixed(1)}%</td>
                    <td style={{ fontSize: 12, color: "var(--ds-color-text-muted)" }}>
                      {(item.recent_counts || []).slice(-5).join(" â†’ ") || "â€”"}
                    </td>
                    <td>
                      {item.failed_rate_scope >= runtimeThresholds.fail_rate ? (
                        <StatusBadge tone="danger">High fail rate</StatusBadge>
                      ) : (item.p95_latency_seconds ?? item.avg_latency_seconds) >= runtimeThresholds.p95_latency_seconds ? (
                        <StatusBadge tone="warning">High p95 latency</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">Healthy</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
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
            <aside className="governance-explorer__sidebar" style={{ width: '300px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 className="detail-section__title">{ui.sectionSetList}</h3>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <Input 
                    value={historySearch} 
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder={ui.searchPlaceholder}
                  />
                  <Select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                    options={[
                      { value: "all", label: "All status" },
                      { value: "active", label: "active" },
                      { value: "validated", label: "validated" },
                      { value: "approved", label: "approved" },
                      { value: "draft", label: "draft" },
                      { value: "archived", label: "archived" },
                    ]}
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
                      {setItem.created_at} â€¢ {setItem.version_label || "v1"}
                    </div>
                  </button>
                ))}
                {visibleHistory.length === 0 && <EmptyState title={ui.noSet} compact />}
              </div>
            </aside>

            <div className="governance-explorer__content">
              {selectedSet ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>


                  <div style={{ padding: '24px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ds-color-text-title)' }}>Bundle Lifecycle</h3>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button size="sm" variant="outline" disabled={!canValidate} onClick={() => mutateBundleState.mutate({ id: selectedSet.id, action: "validate" })} isLoading={mutateBundleState.isPending}>Validate</Button>
                        <Button size="sm" variant="outline" disabled={!canApprove} onClick={() => mutateBundleState.mutate({ id: selectedSet.id, action: "approve" })} isLoading={mutateBundleState.isPending}>Approve</Button>
                        <Button size="sm" variant="primary" disabled={!canActivate} onClick={() => mutateBundleState.mutate({ id: selectedSet.id, action: "activate" })} isLoading={mutateBundleState.isPending}>Activate</Button>
                        <Button size="sm" variant="ghost" disabled={!canArchive} onClick={() => mutateBundleState.mutate({ id: selectedSet.id, action: "archive" })} isLoading={mutateBundleState.isPending}>Archive</Button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
                      {lifecycleOrder.map((step, idx) => (
                        <div
                          key={step}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            textAlign: "center",
                            fontSize: 12,
                            fontWeight: 600,
                            border: "1px solid var(--ds-color-border)",
                            background: idx <= currentLifecycleIndex ? "var(--ds-color-primary-soft)" : "var(--ds-color-bg-muted)",
                            color: idx <= currentLifecycleIndex ? "var(--ds-color-primary)" : "var(--ds-color-text-muted)",
                          }}
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ds-color-text-title)', marginBottom: '12px' }}>{ui.rubricReadonly}</h3>
                    <pre style={{ 
                      padding: '16px', borderRadius: 'var(--ds-radius-md)', 
                      backgroundColor: 'var(--ds-color-bg-muted)', fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                      color: 'var(--ds-color-text-main)'
                    }}>
                      {selectedSet.rubric?.prompt ? getLocalizedText(selectedSet.rubric.prompt, lang) : ""}
                    </pre>
                  </div>

                  <div style={{ padding: '24px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ds-color-text-title)', marginBottom: '12px' }}>{ui.promptReadonly}</h3>
                    <pre style={{ 
                      padding: '16px', borderRadius: 'var(--ds-radius-md)', 
                      backgroundColor: 'var(--ds-color-bg-muted)', fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                      color: 'var(--ds-color-text-main)'
                    }}>
                      {selectedSet.prompt?.content ? getLocalizedText(selectedSet.prompt.content, lang) : ""}
                    </pre>
                  </div>
                </div>
              ) : (
                <EmptyState title={ui.selectFromList} />
              )}
            </div>
          </div>
        )}

        {activeTab === "compare" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ padding: '24px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ds-color-text-title)', marginBottom: '20px' }}>{ui.compareTitle}</h3>
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
            </div>

            {compareSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-color-text-muted)', marginBottom: '8px' }}>{ui.rubricCompareLabel}</div>
                  <StatusBadge tone={compareSummary.rubric === "changed" ? "warning" : "success"}>
                    {compareSummary.rubric === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </div>
                <div style={{ padding: '16px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-color-text-muted)', marginBottom: '8px' }}>{ui.promptCompareLabel}</div>
                  <StatusBadge tone={compareSummary.prompt === "changed" ? "warning" : "success"}>
                    {compareSummary.prompt === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </div>
                <div style={{ padding: '16px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-color-text-muted)', marginBottom: '8px' }}>{ui.policyCompareLabel}</div>
                  <StatusBadge tone={compareSummary.policy === "changed" ? "warning" : "success"}>
                    {compareSummary.policy === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </div>
                <div style={{ padding: '16px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-color-text-muted)', marginBottom: '8px' }}>{ui.rulesCompareLabel}</div>
                  <StatusBadge tone={compareSummary.rules === "changed" ? "warning" : "success"}>
                    {compareSummary.rules === "changed" ? ui.changed : ui.unchanged}
                  </StatusBadge>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <div style={{ padding: '32px', background: 'var(--ds-color-surface)', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ds-color-text-title)', marginBottom: '24px', borderBottom: '1px solid var(--ds-color-border)', paddingBottom: '12px' }}>
                {`${ui.createTitle} â€” ${ui.step} ${createStep}/2`}
              </h3>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <textarea 
                            className="ds-input ds-input--textarea" 
                            value={newRubricContent} 
                            onChange={(e) => setNewRubricContent(e.target.value)} 
                            rows={4} 
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--ds-color-border)', fontFamily: 'inherit' }}
                          />
                          <div style={{ fontSize: 12, color: "var(--ds-color-text-muted)" }}>
                            Cáº¥u trÃºc tiÃªu chÃ­ (criteria): tá»•ng Ä‘iá»ƒm hiá»‡n táº¡i <strong>{criteriaTotalScore}</strong>/100
                            {criteriaTotalScore !== 100 ? " - cáº§n báº±ng 100." : ""}
                            {criteriaHasDuplicateKey ? " - Ä‘ang cÃ³ key trÃ¹ng." : ""}
                          </div>
                          {manualCriteria.map((item, idx) => (
                            <div key={`criteria-${idx}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 2fr auto", gap: 8 }}>
                              <Input
                                value={item.key}
                                onChange={(e) => setManualCriteria((prev) => prev.map((r, i) => i === idx ? { ...r, key: e.target.value } : r))}
                                placeholder="criterion_key"
                              />
                              <Input
                                type="number"
                                value={String(item.max_score)}
                                onChange={(e) => setManualCriteria((prev) => prev.map((r, i) => i === idx ? { ...r, max_score: Number(e.target.value || 0) } : r))}
                                placeholder="max_score"
                              />
                              <Input
                                value={item.label_vi}
                                onChange={(e) => setManualCriteria((prev) => prev.map((r, i) => i === idx ? { ...r, label_vi: e.target.value } : r))}
                                placeholder="label_vi"
                              />
                              <Input
                                value={item.label_ja}
                                onChange={(e) => setManualCriteria((prev) => prev.map((r, i) => i === idx ? { ...r, label_ja: e.target.value } : r))}
                                placeholder="label_ja"
                              />
                              <Button
                                variant="ghost"
                                onClick={() => setManualCriteria((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                XÃ³a
                              </Button>
                            </div>
                          ))}
                          <div>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setManualCriteria((prev) => [...prev, { key: "", max_score: 0, label_vi: "", label_ja: "" }])
                              }
                            >
                              ThÃªm tiÃªu chÃ­
                            </Button>
                          </div>
                        </div>
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

                    <div className="detail-section">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '8px' }}>
                        <input type="checkbox" checked={changeRequiredRules} onChange={(e) => setChangeRequiredRules(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontWeight: 600 }}>{ui.changeRules}</span>
                      </label>
                      {changeRequiredRules && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ 
                            padding: '10px 12px', 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                            color: '#ef4444', 
                            fontSize: '12px', 
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            fontWeight: 500
                          }}>
                            {ui.rulesWarning}
                          </div>
                          <textarea 
                            className="ds-input ds-input--textarea" 
                            value={newRequiredRulesContent} 
                            onChange={(e) => setNewRequiredRulesContent(e.target.value)} 
                            rows={4} 
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--ds-color-border)', fontFamily: 'inherit' }}
                          />
                        </div>
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
                  <div style={{ padding: '14px', borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)', background: 'var(--ds-color-bg-muted)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Impact Preview</div>
                    <div style={{ fontSize: 13 }}>
                      Scope: <strong>{documentType}</strong> / <strong>{level}</strong>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Active bundle hiá»‡n táº¡i: <strong>{activeDetails?.name || "N/A"}</strong>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Bundle má»›i sáº½ áº£nh hÆ°á»Ÿng cÃ¡c lÆ°á»£t cháº¥m má»›i trong scope nÃ y sau khi activate.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 10 }}>
                      {[
                        { label: "Rubric", value: draftImpact.rubric },
                        { label: "Prompt", value: draftImpact.prompt },
                        { label: "Policy", value: draftImpact.policy },
                        { label: "Rules", value: draftImpact.rules },
                      ].map((item) => (
                        <div key={item.label} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ds-color-border)", background: item.value === "changed" ? "rgba(245, 158, 11, 0.12)" : "rgba(34,197,94,0.10)", fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{item.label}</div>
                          <div>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {changeRubric && (
                    <div style={{ fontSize: 13, color: criteriaHasDuplicateKey || criteriaTotalScore !== 100 || criteriaHasEmptyField ? "#b42318" : "var(--ds-color-text-main)" }}>
                      Kiá»ƒm tra schema tiÃªu chÃ­:
                      {criteriaTotalScore !== 100 ? " Tá»•ng Ä‘iá»ƒm pháº£i báº±ng 100." : " Tá»•ng Ä‘iá»ƒm há»£p lá»‡."}
                      {criteriaHasDuplicateKey ? " CÃ³ key bá»‹ trÃ¹ng." : " Key khÃ´ng trÃ¹ng."}
                      {criteriaHasEmptyField ? " CÃ³ tiÃªu chÃ­ thiáº¿u key/label." : " KhÃ´ng cÃ³ tiÃªu chÃ­ rá»—ng."}
                    </div>
                  )}
                  <div style={{ padding: '16px', borderRadius: 'var(--ds-radius-md)', background: 'var(--ds-color-bg-muted)', border: '1px solid var(--ds-color-border)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Preview Final Prompt (theo active scope hiá»‡n táº¡i)</div>
                    {finalPromptPreviewError ? (
                      <div style={{ color: "#b42318", fontSize: 13 }}>{finalPromptPreviewError}</div>
                    ) : (
                      <pre style={{ maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
                        {finalPromptPreviewText || "Äang táº¡o preview..."}
                      </pre>
                    )}
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
                      disabled={Boolean(finalPromptPreviewError)}
                    >
                      {ui.saveAndActivate}
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
      {/* New Document Type Modal */}
      <BaseModal
        open={isNewTypeModalOpen}
        onClose={() => setIsNewTypeModalOpen(false)}
        title={ui.newTypeModalTitle}
        subtitle={ui.newTypeModalSubtitle}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsNewTypeModalOpen(false)}>{ui.newTypeBtnCancel}</Button>
            <Button 
              variant="primary"
              isLoading={bootstrapMutation.isPending}
              disabled={!selectedTemplate && !newTypeName}
              onClick={handleCreateNewType}
            >
              {ui.newTypeBtnSubmit}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--ds-color-text-title)' }}>
              {ui.newTypeSelectTemplate}
            </label>
            <Select 
              value={selectedTemplate}
              onChange={(e) => {
                setSelectedTemplate(e.target.value);
                if (e.target.value) setNewTypeName("");
              }}
              options={[
                { value: "", label: ui.newTypePlaceholderTemplate },
                ...Object.entries(globalDefaults?.rubric_templates || {}).map(([key, t]: [string, any]) => {
                  const labelObj = t.label || {};
                  const localizedLabel = labelObj[lang] || labelObj["vi"] || labelObj["en"] || key;
                  return {
                    value: key,
                    label: `${localizedLabel} (${key})`
                  };
                })
              ]}
            />
          </div>

          <div style={{ textAlign: 'center', color: 'var(--ds-color-text-muted)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--ds-color-border)' }} />
            <span>{ui.newTypeOr}</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--ds-color-border)' }} />
          </div>

          <Input 
            label={ui.newTypeCustomName}
            value={newTypeName}
            onChange={(e) => {
              setNewTypeName(e.target.value);
              if (e.target.value) setSelectedTemplate("");
            }}
            placeholder={ui.newTypeCustomPlaceholder}
          />
          
          <div style={{ 
            padding: '12px', 
            backgroundColor: 'var(--ds-color-bg-muted)', 
            borderRadius: 'var(--ds-radius-md)',
            fontSize: '13px',
            color: 'var(--ds-color-text-muted)',
            display: 'flex',
            gap: '10px'
          }}>
            <InfoIcon size="sm" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0 }}>{ui.newTypeNotice}</p>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}

