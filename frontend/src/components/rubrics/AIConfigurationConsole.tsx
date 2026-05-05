import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { diffLines } from "diff";

import {
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
import type { EvaluationSet, MgmtPolicy, MgmtPrompt, MgmtRubric } from "../../types";
import ConfirmDialog from "../ui/ConfirmDialog";
import SectionBlock from "../ui/SectionBlock";
import { ErrorState, LoadingState } from "../ui/States";
import { useTranslation } from "../LanguageSelector";

const LEVELS = ["low", "medium", "high"] as const;
type ConfigTab = "sets" | "create" | "compare";
const DOCUMENT_TYPE_LABELS: Record<string, { vi: string; ja: string }> = {
  "project-review": { vi: "Tài liệu nhìn nhận dự án", ja: "プロジェクト振り返り資料" },
  "bug-analysis": { vi: "Tài liệu phân tích bug", ja: "バグ分析資料" },
  "qa-review": { vi: "Tài liệu QA", ja: "QA資料" },
  "explanation-review": { vi: "Tài liệu giải thích", ja: "解説資料" },
};
const LEVEL_LABELS: Record<(typeof LEVELS)[number], { vi: string; ja: string }> = {
  low: { vi: "Thấp", ja: "低" },
  medium: { vi: "Vừa", ja: "中" },
  high: { vi: "Cao", ja: "高" },
};

function normalizeBootstrapError(raw: string, lang: "vi" | "ja"): string {
  const lower = (raw || "").toLowerCase();
  if (lower.includes("cannot bootstrap")) {
    return lang === "ja"
      ? "Cannot auto-bootstrap default configuration. Please reload in a few seconds."
      : "Không thể tự khởi tạo cấu hình mặc định. Vui lòng tải lại trang sau vài giây.";
  }
  return raw;
}

export default function AIConfigurationConsole() {
  const { lang } = useTranslation();
  const ui = lang === "ja"
    ? {
        loading: "Loading AI Configuration Console...",
        loadFailed: "Failed to load configuration data",
        title: "AI Configuration Console",
        subtitle: "Operate by Evaluation Set to reduce complexity.",
        modeNote: "Evaluation Set mode: manage Rubric + Prompt + Policy + Required Rules as one set.",
        tabSets: "Evaluation Sets",
        tabCreate: "Create New Set",
        tabCompare: "Compare Sets",
        noActiveSetTooltip: "Create an initial set in the Evaluation Sets tab first.",
        sectionSetList: "Evaluation Set List",
        sectionSetListSub: "Show active/archived sets in current scope. Click an item for details.",
        noActiveSet: "No active Evaluation Set in this scope.",
        noActiveSetHelp: "Click \"Create first set\" to make grading ready.",
        createFromCurrent: "Create from current set",
        bootstrapScope: "Create first set",
        bootstrapping: "Bootstrapping...",
        searchPlaceholder: "Search by set name / version label",
        noSet: "No evaluation set.",
        selected: "Selected",
        setDetail: "Set Detail",
        history: "History",
        selectFromList: "Select an Evaluation Set from the list.",
        compareTitle: "Compare Sets",
        compareSub: "Side-by-side comparison for audit.",
        leftSet: "Left set",
        rightSet: "Right set",
        diff: "Diff Highlight",
        changed: "changed",
        unchanged: "unchanged",
        createTitle: "Create New Evaluation Set",
        step: "Step",
        setName: "Set name",
        docType: "Document type",
        promptLevel: "Evaluation level",
        changeRubric: "Change Rubric",
        changePrompt: "Change Prompt",
        changePolicy: "Change Policy",
        changeRules: "Change Required Rules",
        noEffectiveChange: "No effective change. Existing versions will be reused.",
        cancel: "Cancel",
        review: "Review",
        back: "Back",
        saveArchived: "Save (Archived)",
        saveAndActivate: "Save and Activate",
        saving: "Saving...",
        reviewHint: "Only changed components create new immutable versions.",
        newVersion: "Create new version",
        reuse: "Reuse",
        documentTypeLabel: "Document type",
        createSuccess: "Created and activated new Evaluation Set.",
        bootstrapSuccess: "Created first Evaluation Set.",
        createFailed: "Failed to create set",
        bootstrapFailed: "Failed to bootstrap first set",
        activationTitle: "Confirm Activation",
        activationDesc: "This set will be used for new gradings only. Existing results stay unchanged.",
      }
    : {
        loading: "Đang tải AI Configuration Console...",
        loadFailed: "Không thể tải dữ liệu cấu hình",
        title: "Thiết lập tiêu chuẩn chấm AI",
        subtitle: "Tạo và quản lý bộ tiêu chuẩn chấm để các lần review mới áp dụng đúng cấu hình bạn chọn.",
        scopeDocumentType: "Loại tài liệu",
        scopeLevel: "Mức độ đánh giá",
        modeNote: "Mỗi bộ gồm 4 phần và được version hóa; xem “Hướng dẫn nhanh cách chấm” để biết chi tiết.",
        tabSets: "Bộ tiêu chuẩn chấm",
        tabCreate: "Tạo bộ mới",
        tabCompare: "So sánh bộ",
        noActiveSetTooltip: "Hãy tạo bộ khởi tạo ở tab Bộ tiêu chuẩn chấm trước.",
        sectionSetList: "Danh sách Bộ tiêu chuẩn chấm",
        sectionSetListSub: "Hiển thị active/archived trong scope hiện tại. Chọn item để xem chi tiết.",
        noActiveSet: "Chưa có Bộ cấu hình đánh giá cho loại tài liệu này.",
        noActiveSetHelp: "Bấm \"Tạo bộ đầu tiên\" để hệ thống sẵn sàng chấm.",
        createFromCurrent: "Tạo mới từ bộ hiện tại",
        bootstrapScope: "Tạo bộ đầu tiên",
        bootstrapping: "Đang khởi tạo...",
        searchPlaceholder: "Tìm theo tên set / version label",
        noSet: "Không có bộ tiêu chuẩn chấm.",
        selected: "Đang chọn",
        setDetail: "Bộ đang chọn",
        history: "Lịch sử",
        selectFromList: "Chọn một Bộ tiêu chuẩn chấm từ danh sách.",
        compareTitle: "So sánh bộ",
        compareSub: "So sánh song song để kiểm tra/audit.",
        leftSet: "Bộ trái",
        rightSet: "Bộ phải",
        diff: "Diff Highlight",
        changed: "changed",
        unchanged: "unchanged",
        createTitle: "Tạo Bộ tiêu chuẩn chấm mới",
        step: "Bước",
        setName: "Tên set",
        docType: "Loại tài liệu",
        promptLevel: "Mức độ đánh giá",
        changeRubric: "Đổi Khung tiêu chí chấm điểm",
        changePrompt: "Đổi Hướng dẫn phản hồi AI",
        changePolicy: "Đổi Nguyên tắc đánh giá",
        changeRules: "Đổi Quy tắc bắt buộc",
        noEffectiveChange: "Không có thay đổi hiệu lực. Hệ thống sẽ reuse version hiện có.",
        cancel: "Hủy",
        review: "Xem lại",
        back: "Quay lại",
        saveArchived: "Lưu (Archived)",
        saveAndActivate: "Lưu và kích hoạt",
        saving: "Đang lưu...",
        reviewHint: "Chỉ thành phần thay đổi mới tạo version immutable mới.",
        newVersion: "Tạo version mới",
        reuse: "Reuse",
        documentTypeLabel: "Loại tài liệu",
        createSuccess: "Đã tạo và kích hoạt Bộ tiêu chuẩn chấm mới.",
        bootstrapSuccess: "Đã tạo bộ cấu hình đầu tiên và sẵn sàng sử dụng.",
        createFailed: "Tạo set thất bại",
        bootstrapFailed: "Khởi tạo set thất bại",
        activationTitle: "Xác nhận kích hoạt",
        activationDesc: "Bạn đang kích hoạt set này. Các lần chấm mới sẽ dùng set này. Kết quả cũ không thay đổi.",
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
      setMessage({ type: "error", text: error instanceof Error ? error.message : ui.createFailed });
    },
  });
  const bootstrapSetMutation = useMutation({
    mutationFn: () => bootstrapEvaluationSet({ document_type: documentType, level }),
    onSuccess: async () => {
      setMessage({ type: "success", text: ui.bootstrapSuccess });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-sets", documentType, level] }),
        queryClient.invalidateQueries({ queryKey: ["mgmt-evaluation-set-active", documentType, level] }),
      ]);
    },
    onError: (error) => {
      const raw = error instanceof Error ? error.message : ui.bootstrapFailed;
      setMessage({
        type: "error",
        text: normalizeBootstrapError(raw, lang === "ja" ? "ja" : "vi"),
      });
    },
  });

  const createFirstSetMutation = useMutation({
    mutationFn: async () => {
      const scopeRubrics = rubrics.filter((r) => r.document_type === documentType);
      const activeRubric = scopeRubrics.find((r) => r.status === "active") || scopeRubrics[0];
      if (!activeRubric) throw new Error(lang === "ja" ? "Rubric not found for this document type." : "Chưa có khung tiêu chí chấm điểm cho loại tài liệu này.");
      if (!newPromptContent.trim()) throw new Error(lang === "ja" ? "Please enter prompt content." : "Vui lòng nhập hướng dẫn phản hồi AI.");
      if (!newPolicyContent.trim()) throw new Error(lang === "ja" ? "Please enter policy content." : "Vui lòng nhập nguyên tắc đánh giá.");

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
          throw new Error(
            lang === "ja"
              ? "To create Rubric v1 from scratch, criteria definitions are required."
              : "Để tạo khung tiêu chí chấm điểm v1 từ đầu cần có danh sách tiêu chí."
          );
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
      setMessage({ type: "error", text: error instanceof Error ? error.message : ui.createFailed });
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 12, marginBottom: 16 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{ui.scopeDocumentType || "Document type"}</label>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                {documentTypes.map((item) => {
                  const label = DOCUMENT_TYPE_LABELS[item];
                  const local = label ? (lang === "ja" ? label.ja : label.vi) : item;
                  return <option key={item} value={item}>{`${local} (${item})`}</option>;
                })}
              </select>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{ui.scopeLevel || "Level"}</label>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                {LEVELS.map((item) => {
                  const local = lang === "ja" ? LEVEL_LABELS[item].ja : LEVEL_LABELS[item].vi;
                  return <option key={item} value={item}>{`${local} (${item})`}</option>;
                })}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontSize: 13 }}>
            {ui.modeNote}
          </div>
          <div ref={guideRef} style={{ marginBottom: 12, border: "1px solid #dbeafe", borderRadius: 8, background: "#f8fbff" }}>
            <button
              type="button"
              className="btn-secondary btn-secondary--compact"
              onClick={() => setShowGuide((prev) => !prev)}
              style={{ margin: 8 }}
            >
              {showGuide ? "Ẩn hướng dẫn nhanh cách chấm" : "Hướng dẫn nhanh cách chấm"}
            </button>
            {showGuide ? (
              <div style={{ padding: "0 12px 12px", color: "#334155", fontSize: 13, display: "grid", gap: 10 }}>
                <div>
                  <strong>Bộ cấu hình đánh giá AI gồm 5 phần</strong>
                  <div>1. Khung tiêu chí chấm điểm: quy định chấm những gì và phân bổ điểm.</div>
                  <div>2. Hướng dẫn phản hồi AI: quy định cách AI viết nhận xét.</div>
                  <div>3. Nguyên tắc đánh giá: quy định mức nghiêm ngặt khi chấm.</div>
                  <div>4. Quy tắc bắt buộc: các quy định AI luôn phải tuân thủ.</div>
                  <div>5. Mức độ đánh giá: thấp / vừa / cao.</div>
                </div>
                <div>
                  <strong>Yếu tố khác ảnh hưởng kết quả review</strong>
                  <div>- Nội dung tài liệu upload và phiên bản tài liệu.</div>
                  <div>- Loại tài liệu, ngôn ngữ tài liệu.</div>
                  <div>- Bối cảnh dự án (mô tả dự án) được dùng làm ngữ cảnh bổ sung khi AI chấm; không thay thế nội dung tài liệu.</div>
                  <div>- Mức độ đầy đủ bằng chứng/số liệu/KPI/root cause trong chính tài liệu.</div>
                  <div>- Model AI đang dùng và chế độ chấm mới/tái sử dụng kết quả tương đương.</div>
                </div>
                <div>
                  <strong>Khi nào cần tạo bộ mới</strong>
                  <div>- Khi thay đổi tiêu chí chấm điểm cho loại tài liệu.</div>
                  <div>- Khi thay đổi cách AI viết nhận xét hoặc cách diễn giải kết quả.</div>
                  <div>- Khi cần điều chỉnh mức nghiêm ngặt đánh giá cho scope hiện tại.</div>
                </div>
                <div>
                  <strong>Khi nào không cần tạo bộ mới</strong>
                  <div>- Chỉ sửa lỗi chính tả nhỏ, không thay đổi ý nghĩa chấm.</div>
                  <div>- Tài liệu mới upload nhưng quy tắc đánh giá vẫn giống nhau.</div>
                </div>
                <div>
                  <strong>Ảnh hưởng sau khi kích hoạt bộ mới</strong>
                  <div>- Chỉ các lần chấm mới sẽ dùng bộ mới.</div>
                  <div>- Kết quả đã chấm trước đó không bị thay đổi.</div>
                </div>
                <div>
                  <strong>Checklist trước khi bấm Lưu và kích hoạt</strong>
                  <div>- Đã chọn đúng loại tài liệu.</div>
                  <div>- Đã chọn đúng mức độ đánh giá.</div>
                  <div>- Đã xem lại nội dung thay đổi chính.</div>
                  <div>- Đã thống nhất nội bộ (nếu có quy trình duyệt).</div>
                </div>
                <div>
                  <strong>Định nghĩa từng yếu tố trong bộ tiêu chuẩn</strong>
                  <div>- Khung tiêu chí chấm điểm: xác định chấm những hạng mục nào và phân bổ trọng số.</div>
                  <div>- Hướng dẫn phản hồi AI: quy định cách diễn đạt nhận xét để người đọc dễ hành động.</div>
                  <div>- Nguyên tắc đánh giá: quy định mức nghiêm ngặt khi cho điểm và trừ điểm.</div>
                  <div>- Quy tắc bắt buộc: các ràng buộc đầu ra AI phải luôn tuân thủ.</div>
                  <div>- Mức độ đánh giá: low / medium / high để chọn độ sâu và độ chặt khi phản hồi.</div>
                </div>
                <div>
                  <strong>Ví dụ thay đổi và tác động</strong>
                  <div>- Đổi Khung tiêu chí chấm điểm: điểm theo từng tiêu chí có thể thay đổi.</div>
                  <div>- Đổi Hướng dẫn phản hồi AI: văn phong, độ chi tiết và trọng tâm nhận xét thay đổi.</div>
                  <div>- Đổi Nguyên tắc đánh giá: mức trừ điểm và ngưỡng đạt/chưa đạt thay đổi.</div>
                  <div>- Đổi Mức độ đánh giá: độ sâu phản hồi thay đổi theo low / medium / high.</div>
                  <div>- Đổi Quy tắc bắt buộc: định dạng và cấu trúc kết quả trả về có thể thay đổi.</div>
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
            <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${message.type === "error" ? "#fecaca" : "#bbf7d0"}`, background: message.type === "error" ? "#fef2f2" : "#f0fdf4" }}>
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
                  {showArchived
                    ? (lang === "ja" ? "Show active only" : "Chỉ hiện active")
                    : (lang === "ja" ? "Show all statuses" : "Hiện tất cả trạng thái")}
                </button>
                <select value={historyLimit} onChange={(event) => setHistoryLimit(Number(event.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
                  <div style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
                    {lang === "ja"
                      ? `${visibleHistory.length}/${filteredHistoryCount} ã‚»ãƒƒãƒˆã‚’è¡¨ç¤ºä¸­`
                      : `Đang hiển thị ${visibleHistory.length}/${filteredHistoryCount} bộ`}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {visibleHistory.map((setItem) => {
                      const details = setWithDetails(setItem);
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
                            <strong>Tạo lúc:</strong> {setItem.created_at}
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
                          {showSelectedSetDetail ? "Ẩn chi tiết" : "Xem chi tiết"}
                        </button>
                      </div>
                      {showSelectedSetDetail ? (
                        <>
                          <div style={{ marginBottom: 10, color: "#334155", fontSize: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 8 }}>
                            Bộ này chỉ để xem lại. Muốn thay đổi nội dung, hãy tạo bộ mới từ bộ hiện tại.
                          </div>
                          <div style={{ display: "grid", gap: 6, fontSize: 13, marginBottom: 10 }}>
                            <div><strong>Tên bộ:</strong> {selectedSet.name}</div>
                            <div><strong>Trạng thái:</strong> {selectedSet.status}</div>
                            <div><strong>{ui.documentTypeLabel}:</strong> {selectedSet.document_type}</div>
                            <div><strong>Mức độ đánh giá:</strong> {selectedSet.level}</div>
                            <div><strong>Khung tiêu chí chấm điểm:</strong> {selectedSet.rubric?.version || "-"}</div>
                            <div><strong>Hướng dẫn phản hồi AI:</strong> {selectedSet.prompt?.version || "-"}</div>
                            <div><strong>Nguyên tắc đánh giá:</strong> {selectedSet.policy?.version || "-"}</div>
                            <div><strong>Phiên bản quy tắc bắt buộc:</strong> {selectedSet.required_rules_version}</div>
                            <div><strong>Mã quy tắc bắt buộc:</strong> {(selectedSet.required_rule_hash || "-").slice(0, 16)}...</div>
                          </div>
                          <div style={{ display: "grid", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Khung tiêu chí chấm điểm (chỉ xem)</div>
                              <textarea value={selectedSet.rubric?.prompt?.vi || selectedSet.rubric?.prompt?.ja || ""} rows={4} readOnly style={{ width: "100%", opacity: 0.9 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Hướng dẫn phản hồi AI (chỉ xem)</div>
                              <textarea value={selectedSet.prompt?.content || ""} rows={4} readOnly style={{ width: "100%", opacity: 0.9 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Nguyên tắc đánh giá (chỉ xem)</div>
                              <textarea value={selectedSet.policy?.content || ""} rows={4} readOnly style={{ width: "100%", opacity: 0.9 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Quy tắc bắt buộc (chỉ xem)</div>
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
                          Tạo bộ mới từ bộ này
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
                          So sánh với bộ khác
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
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>{renderSet(leftSet)}</pre>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8 }}>{renderSet(rightSet)}</pre>
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>{ui.diff}</strong>
                <div style={{ maxHeight: 260, overflow: "auto", background: "#f8fafc", padding: 8, borderRadius: 8 }}>
                  {renderDiff(renderSet(leftSet), renderSet(rightSet))}
                </div>
              </div>
              {compareSummary ? (
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(4,minmax(100px,1fr))", gap: 8, fontSize: 12 }}>
                  <div><strong>Khung tiêu chí:</strong> {compareSummary.rubric === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>Hướng dẫn AI:</strong> {compareSummary.prompt === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>Nguyên tắc:</strong> {compareSummary.policy === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>Quy tắc bắt buộc:</strong> {compareSummary.rules === "changed" ? ui.changed : ui.unchanged}</div>
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
                      lang === "ja"
                        ? "Low: fast and short feedback. Medium: balanced. High: stricter and requires clearer evidence."
                        : "Thấp: chấm nhanh, nhận xét ngắn. Vừa: cân bằng. Cao: chấm chặt hơn, yêu cầu bằng chứng rõ hơn."
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
                    Mở hướng dẫn
                  </button>
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changeRubric} onChange={(event) => setChangeRubric(event.target.checked)} /> {ui.changeRubric}
                    {helpDot(
                      lang === "ja"
                        ? "Define what to score and score weights."
                        : "Xác định chấm những hạng mục nào và trọng số điểm tương ứng."
                    )}
                  </label>
                  {changeRubric ? (
                    <>
                      <textarea value={newRubricContent} onChange={(event) => setNewRubricContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} />
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, background: "#f8fafc", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                          {lang === "ja" ? "Rubric criteria (for first set)" : "Tiêu chí chấm điểm (cho tạo mới từ đầu)"}
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {manualCriteria.map((row, idx) => (
                            <div key={`criterion-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr 1fr auto", gap: 6, alignItems: "center" }}>
                              <input
                                value={row.key}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, key: event.target.value } : it))}
                                placeholder="key"
                              />
                              <input
                                type="number"
                                value={row.max_score}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, max_score: Number(event.target.value) || 0 } : it))}
                                placeholder="max"
                              />
                              <input
                                value={row.label_vi}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, label_vi: event.target.value } : it))}
                                placeholder="label vi"
                              />
                              <input
                                value={row.label_ja}
                                onChange={(event) => setManualCriteria((prev) => prev.map((it, i) => i === idx ? { ...it, label_ja: event.target.value } : it))}
                                placeholder="label ja"
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
                              {(lang === "ja" ? "Total score: " : "Tổng điểm: ") + manualCriteria.reduce((sum, item) => sum + (Number(item.max_score) || 0), 0)}
                            </span>
                            <button
                              type="button"
                              className="btn-secondary btn-secondary--compact"
                              onClick={() => setManualCriteria((prev) => [...prev, { key: "", max_score: 0, label_vi: "", label_ja: "" }])}
                            >
                              {lang === "ja" ? "+ Add" : "+ Thêm tiêu chí"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changePrompt} onChange={(event) => setChangePrompt(event.target.checked)} /> {ui.changePrompt}
                    {helpDot(
                      lang === "ja"
                        ? "Define AI feedback style and focus."
                        : "Quy định cách AI diễn đạt nhận xét, cấu trúc phản hồi và trọng tâm phân tích."
                    )}
                  </label>
                  {changePrompt ? <textarea value={newPromptContent} onChange={(event) => setNewPromptContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} /> : null}
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changePolicy} onChange={(event) => setChangePolicy(event.target.checked)} /> {ui.changePolicy}
                    {helpDot(
                      lang === "ja"
                        ? "Define strictness and score deduction rules."
                        : "Quy định mức nghiêm ngặt khi chấm và cách trừ điểm theo thiếu sót."
                    )}
                  </label>
                  {changePolicy ? <textarea value={newPolicyContent} onChange={(event) => setNewPolicyContent(event.target.value)} rows={5} style={{ width: "100%" }} /> : null}
                  <label style={{ display: "block" }}>
                    <input type="checkbox" checked={changeRequiredRules} onChange={(event) => setChangeRequiredRules(event.target.checked)} /> {ui.changeRules}
                    {helpDot(
                      lang === "ja"
                        ? "Mandatory output constraints AI must always follow."
                        : "Các ràng buộc bắt buộc AI luôn phải tuân thủ (ví dụ định dạng đầu ra)."
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
                  <div><strong>Khung tiêu chí chấm điểm:</strong> {effectiveRubricChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.rubric?.version || "-"}`}</div>
                  <div><strong>Hướng dẫn phản hồi AI:</strong> {effectivePromptChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.prompt?.version || "-"}`}</div>
                  <div><strong>Nguyên tắc đánh giá:</strong> {effectivePolicyChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.policy?.version || "-"}`}</div>
                  <div><strong>Quy tắc bắt buộc:</strong> {effectiveRequiredRulesChange ? ui.newVersion : `${activeDetails?.required_rules_version || "system-rules-v1"} (${(activeDetails?.required_rule_hash || "-").slice(0, 16)}...)`}</div>
                  <div><strong>Set Name:</strong> {setName}</div>
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
} | null) {
  if (!setItem) return "No set selected";
  return [
    `name: ${setItem.name}`,
    `status: ${setItem.status}`,
    `muc_do_danh_gia: ${setItem.level}`,
    `khung_tieu_chi_cham_diem: ${setItem.rubric?.version || "-"}`,
    `huong_dan_phan_hoi_ai: ${setItem.prompt?.version || "-"}`,
    `nguyen_tac_danh_gia: ${setItem.policy?.version || "-"}`,
    `ma_quy_tac_bat_buoc: ${setItem.required_rule_hash}`,
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


