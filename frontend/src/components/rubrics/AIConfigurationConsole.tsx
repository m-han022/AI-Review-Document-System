import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { diffLines } from "diff";

import {
  bootstrapEvaluationSet,
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

export default function AIConfigurationConsole() {
  const { lang } = useTranslation();
  const ui = lang === "ja"
    ? {
        loading: "AI設定コンソールを読み込み中...",
        loadFailed: "設定データの読み込みに失敗しました",
        title: "AI Configuration Console",
        subtitle: "Evaluation Set 単位で設定を運用し、複雑さを下げます。",
        modeNote: "Evaluation Set モード: Rubric + Prompt + Policy + Required Rules をセット単位で管理します。",
        tabSets: "Evaluation Sets",
        tabCreate: "新規セット作成",
        tabCompare: "セット比較",
        noActiveSetTooltip: "先に Evaluation Sets タブで初期セットを作成してください。",
        sectionSetList: "Evaluation Set 一覧",
        sectionSetListSub: "現在スコープの active/archived を表示。クリックで詳細を確認。",
        noActiveSet: "このスコープに active な Evaluation Set がありません。",
        noActiveSetHelp: "続行するには、最初の Evaluation Set を作成してください。",
        createFromCurrent: "Current から新規作成",
        bootstrapScope: "現在スコープを初期化",
        bootstrapping: "初期化中...",
        searchPlaceholder: "セット名 / version label で検索",
        noSet: "Evaluation Set がありません。",
        selected: "選択中",
        setDetail: "セット詳細",
        history: "履歴",
        selectFromList: "一覧から Evaluation Set を選択してください。",
        compareTitle: "セット比較",
        compareSub: "監査用に左右比較します。",
        leftSet: "左セット",
        rightSet: "右セット",
        diff: "差分ハイライト",
        changed: "変更あり",
        unchanged: "変更なし",
        createTitle: "新規 Evaluation Set 作成",
        step: "ステップ",
        setName: "セット名",
        docType: "ドキュメントタイプ",
        promptLevel: "プロンプトレベル",
        changeRubric: "Rubric を変更",
        changePrompt: "Prompt を変更",
        changePolicy: "Policy を変更",
        changeRules: "Required Rules を変更",
        noEffectiveChange: "実質的な変更がありません。既存 version を再利用します。",
        cancel: "キャンセル",
        review: "確認",
        back: "戻る",
        saveArchived: "保存 (Archived)",
        saveAndActivate: "保存して有効化",
        saving: "保存中...",
        reviewHint: "変更したコンポーネントのみ新 version が作成されます。",
        newVersion: "新しい version を作成",
        reuse: "再利用",
        documentTypeLabel: "ドキュメントタイプ",
        createSuccess: "新しい Evaluation Set を作成して有効化しました。",
        bootstrapSuccess: "初期 Evaluation Set を作成しました。",
        createFailed: "セット作成に失敗しました",
        bootstrapFailed: "初期セット作成に失敗しました",
        activationTitle: "有効化の確認",
        activationDesc: "このセットを有効化します。新規採点のみ影響し、過去結果は変わりません。",
      }
    : {
        loading: "Đang tải AI Configuration Console...",
        loadFailed: "Không thể tải dữ liệu cấu hình",
        title: "AI Configuration Console",
        subtitle: "Vận hành theo Evaluation Set để giảm độ phức tạp.",
        modeNote: "Evaluation Set mode: quản lý theo bộ (Rubric + Prompt + Policy + Required Rules), không sửa trực tiếp version cũ.",
        tabSets: "Evaluation Sets",
        tabCreate: "Tạo bộ mới",
        tabCompare: "So sánh bộ",
        noActiveSetTooltip: "Hãy tạo bộ khởi tạo ở tab Evaluation Sets trước.",
        sectionSetList: "Danh sách Evaluation Set",
        sectionSetListSub: "Hiển thị active/archived trong scope hiện tại. Chọn item để xem chi tiết.",
        noActiveSet: "Chưa có Bộ cấu hình đánh giá cho loại tài liệu này.",
        noActiveSetHelp: "Bấm \"Tạo bộ đầu tiên\" để hệ thống sẵn sàng chấm.",
        createFromCurrent: "Tạo mới từ bộ hiện tại",
        bootstrapScope: "Tạo bộ đầu tiên",
        bootstrapping: "Đang khởi tạo...",
        searchPlaceholder: "Tìm theo tên set / version label",
        noSet: "Không có evaluation set.",
        selected: "Đang chọn",
        setDetail: "Chi tiết Set",
        history: "Lịch sử",
        selectFromList: "Chọn một Evaluation Set từ danh sách.",
        compareTitle: "So sánh Set",
        compareSub: "So sánh song song để kiểm tra/audit.",
        leftSet: "Set trái",
        rightSet: "Set phải",
        diff: "Diff Highlight",
        changed: "changed",
        unchanged: "unchanged",
        createTitle: "Tạo Evaluation Set mới",
        step: "Bước",
        setName: "Tên set",
        docType: "Loại tài liệu",
        promptLevel: "Mức prompt",
        changeRubric: "Đổi Rubric",
        changePrompt: "Đổi Prompt",
        changePolicy: "Đổi Policy",
        changeRules: "Đổi Required Rules",
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
        createSuccess: "Đã tạo và kích hoạt Evaluation Set mới.",
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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("sets");
  const detailPanelRef = useRef<HTMLDivElement | null>(null);

  const [changeRubric, setChangeRubric] = useState(false);
  const [changePrompt, setChangePrompt] = useState(true);
  const [changePolicy, setChangePolicy] = useState(false);
  const [changeRequiredRules, setChangeRequiredRules] = useState(false);
  const [setName, setSetName] = useState("");
  const [newRubricContent, setNewRubricContent] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [newPolicyContent, setNewPolicyContent] = useState("");
  const [newRequiredRulesContent, setNewRequiredRulesContent] = useState("");

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
      setMessage({ type: "error", text: error instanceof Error ? error.message : ui.bootstrapFailed });
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

  useEffect(() => {
    // Enforce onboarding flow: no active set => user must bootstrap in "sets" tab first.
    if (!hasCurrentSet && activeTab !== "sets") {
      setActiveTab("sets");
    }
  }, [hasCurrentSet, activeTab]);

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
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              {documentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={level} onChange={(event) => setLevel(event.target.value)}>
              {LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontSize: 13 }}>
            {ui.modeNote}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className={activeTab === "sets" ? "btn-primary btn-primary--compact" : "btn-secondary btn-secondary--compact"} onClick={() => setActiveTab("sets")}>
              {ui.tabSets}
            </button>
            <button
              className={activeTab === "create" ? "btn-primary btn-primary--compact" : "btn-secondary btn-secondary--compact"}
              onClick={() => {
                setActiveTab("create");
                setCreateOpen(true);
                if (hasCurrentSet) openCreateFromCurrent();
              }}
              disabled={!hasCurrentSet}
              title={!hasCurrentSet ? ui.noActiveSetTooltip : undefined}
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
                    onClick={() => bootstrapSetMutation.mutate()}
                    disabled={bootstrapSetMutation.isPending}
                  >
                    {bootstrapSetMutation.isPending ? ui.bootstrapping : ui.bootstrapScope}
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
                    ? (lang === "ja" ? "active のみ表示" : "Chỉ hiện active")
                    : (lang === "ja" ? "全ステータス表示" : "Hiện tất cả trạng thái")}
                </button>
                <select value={historyLimit} onChange={(event) => setHistoryLimit(Number(event.target.value))}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
                  <div style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
                    {lang === "ja"
                      ? `${visibleHistory.length}/${filteredHistoryCount} セットを表示中`
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
                            <strong>Rubric:</strong> {details?.rubric?.version || "#"+setItem.rubric_version_id} |{" "}
                            <strong>Prompt:</strong> {details?.prompt?.version || "#"+setItem.prompt_version_id} |{" "}
                            <strong>Policy:</strong> {details?.policy?.version || "#"+setItem.policy_version_id} |{" "}
                            <strong>Required Rules:</strong> {setItem.required_rules_version || "system-rules-v1"} ({(setItem.required_rule_hash || "-").slice(0, 12)}...)
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
                      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                        <div><strong>Name:</strong> {selectedSet.name}</div>
                        <div><strong>Status:</strong> {selectedSet.status}</div>
                        <div><strong>{ui.documentTypeLabel}:</strong> {selectedSet.document_type}</div>
                        <div><strong>Level:</strong> {selectedSet.level}</div>
                        <div><strong>Rubric:</strong> {selectedSet.rubric?.version || "-"}</div>
                        <div><strong>Prompt:</strong> {selectedSet.prompt?.version || "-"}</div>
                        <div><strong>Policy:</strong> {selectedSet.policy?.version || "-"}</div>
                        <div><strong>Rules version:</strong> {selectedSet.required_rules_version}</div>
                        <div><strong>Rules hash:</strong> {selectedSet.required_rule_hash}</div>
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
                  <div><strong>Rubric:</strong> {compareSummary.rubric === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>Prompt:</strong> {compareSummary.prompt === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>Policy:</strong> {compareSummary.policy === "changed" ? ui.changed : ui.unchanged}</div>
                  <div><strong>Rules:</strong> {compareSummary.rules === "changed" ? ui.changed : ui.unchanged}</div>
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
                  <div>{ui.promptLevel}: <strong>{level}</strong></div>
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <label style={{ display: "block" }}><input type="checkbox" checked={changeRubric} onChange={(event) => setChangeRubric(event.target.checked)} /> {ui.changeRubric}</label>
                  {changeRubric ? <textarea value={newRubricContent} onChange={(event) => setNewRubricContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} /> : null}
                  <label style={{ display: "block" }}><input type="checkbox" checked={changePrompt} onChange={(event) => setChangePrompt(event.target.checked)} /> {ui.changePrompt}</label>
                  {changePrompt ? <textarea value={newPromptContent} onChange={(event) => setNewPromptContent(event.target.value)} rows={5} style={{ width: "100%", marginBottom: 8 }} /> : null}
                  <label style={{ display: "block" }}><input type="checkbox" checked={changePolicy} onChange={(event) => setChangePolicy(event.target.checked)} /> {ui.changePolicy}</label>
                  {changePolicy ? <textarea value={newPolicyContent} onChange={(event) => setNewPolicyContent(event.target.value)} rows={5} style={{ width: "100%" }} /> : null}
                  <label style={{ display: "block" }}><input type="checkbox" checked={changeRequiredRules} onChange={(event) => setChangeRequiredRules(event.target.checked)} /> {ui.changeRules}</label>
                  {changeRequiredRules ? <textarea value={newRequiredRulesContent} onChange={(event) => setNewRequiredRulesContent(event.target.value)} rows={6} style={{ width: "100%" }} /> : null}
                </div>
                {!hasEffectiveChange ? (
                  <div style={{ marginTop: 8, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 8 }}>
                    {ui.noEffectiveChange}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn-secondary btn-secondary--compact" onClick={() => { setCreateOpen(false); setActiveTab("sets"); }}>{ui.cancel}</button>
                  <button className="btn-primary btn-primary--compact" disabled={!setName.trim()} onClick={() => setCreateStep(2)}>{ui.review}</button>
                </div>
              </>
            ) : null}

            {createStep === 2 ? (
              <>
                <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  <div><strong>Rubric:</strong> {effectiveRubricChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.rubric?.version || "-"}`}</div>
                  <div><strong>Prompt:</strong> {effectivePromptChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.prompt?.version || "-"}`}</div>
                  <div><strong>Policy:</strong> {effectivePolicyChange ? ui.newVersion : `${ui.reuse} ${activeDetails?.policy?.version || "-"}`}</div>
                  <div><strong>Required Rules:</strong> {effectiveRequiredRulesChange ? ui.newVersion : `${activeDetails?.required_rules_version || "system-rules-v1"} (${(activeDetails?.required_rule_hash || "-").slice(0, 16)}...)`}</div>
                  <div><strong>Set Name:</strong> {setName}</div>
                </div>
                <div style={{ marginTop: 8, color: "#475569", fontSize: 12 }}>
                  {ui.reviewHint}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn-secondary btn-secondary--compact" onClick={() => setCreateStep(1)}>{ui.back}</button>
                  <button className="btn-secondary btn-secondary--compact" disabled={createSetMutation.isPending} onClick={() => createSetMutation.mutate(false)}>
                    {createSetMutation.isPending ? ui.saving : ui.saveArchived}
                  </button>
                  <button className="btn-primary btn-primary--compact" disabled={createSetMutation.isPending} onClick={() => setActivateConfirmOpen(true)}>
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


