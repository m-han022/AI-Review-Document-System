/* eslint-disable react-hooks/set-state-in-effect */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { activateRubricVersion, saveRubricVersion } from "../../api/client";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../../constants/documentTypes";
import { rubricsQueryKey } from "../../query";
import type { RubricVersion, RubricVersionPayload, LanguageCode } from "../../types";
import { useRubrics } from "../../hooks/useRubrics";
import { useTranslation } from "../LanguageSelector";
import { Button, Card, Input, Select, StatusBadge } from "../ui";
import { PlusIcon } from "../ui/Icon";
import { ErrorState, LoadingState } from "../ui/States";
const RubricScoreAllocationChart = lazy(() => import("./charts/RubricScoreAllocationChart"));

type FormState = RubricVersionPayload;

const EMPTY_PROMPT = {};

interface CriteriaDiffItem {
  key: string;
  type: "added" | "removed" | "changed" | "unchanged";
  currentMax: number | null;
  compareMax: number | null;
  currentLabel: string;
  compareLabel: string;
}

function getDiffTypeLabel(type: CriteriaDiffItem["type"], t: (key: string) => string): string {
  switch (type) {
    case "added":
      return t("rubric.diffType.added");
    case "removed":
      return t("rubric.diffType.removed");
    case "changed":
      return t("rubric.diffType.changed");
    case "unchanged":
      return t("rubric.diffType.unchanged");
    default:
      return type;
  }
}

function promptText(prompt: RubricVersion["prompt"], key: LanguageCode): string {
  if (typeof prompt === "string") {
    return key === "vi" ? prompt : "";
  }
  return prompt?.[key] || "";
}

function payloadFromRubric(rubric: RubricVersion | null): FormState {
  if (!rubric) {
    return {
      version: "v1",
      criteria: [],
      prompt: EMPTY_PROMPT,
    };
  }

  return {
    version: rubric.version,
    criteria: rubric.criteria.map((criterion) => ({
      key: criterion.key,
      max_score: criterion.max_score,
      labels: { 
        vi: criterion.labels.vi ?? criterion.key, 
        ja: criterion.labels.ja ?? criterion.key,
        en: (criterion.labels as any).en ?? criterion.key 
      },
    })),
    prompt: {
      vi: promptText(rubric.prompt, "vi") || promptText(rubric.prompt, "ja"),
      ja: promptText(rubric.prompt, "ja"),
      en: promptText(rubric.prompt, "en") || promptText(rubric.prompt, "ja"),
    },
  };
}

function nextVersion(versions: string[]): string {
  const numericVersions = versions
    .map((version) => /^v(\d+)$/i.exec(version)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number.parseInt(value, 10));
  const next = numericVersions.length ? Math.max(...numericVersions) + 1 : versions.length + 1;
  return `v${next}`;
}

function buildCriteriaDiff(
  current: RubricVersion | null,
  compare: RubricVersion | null,
  lang: LanguageCode,
): CriteriaDiffItem[] {
  const currentCriteria = current?.criteria ?? [];
  const compareCriteria = compare?.criteria ?? [];
  const keys = [...new Set([...currentCriteria.map((item) => item.key), ...compareCriteria.map((item) => item.key)])];

  return keys.map((key) => {
    const currentItem = currentCriteria.find((item) => item.key === key) ?? null;
    const compareItem = compareCriteria.find((item) => item.key === key) ?? null;

    let type: CriteriaDiffItem["type"] = "unchanged";
    if (currentItem && !compareItem) {
      type = "added";
    } else if (!currentItem && compareItem) {
      type = "removed";
    } else if (
      currentItem
      && compareItem
      && (
        currentItem.max_score !== compareItem.max_score
        || (currentItem.labels?.[lang] ?? currentItem.key) !== (compareItem.labels?.[lang] ?? compareItem.key)
      )
    ) {
      type = "changed";
    }

    return {
      key,
      type,
      currentMax: currentItem?.max_score ?? null,
      compareMax: compareItem?.max_score ?? null,
      currentLabel: currentItem?.labels?.[lang] ?? currentItem?.key ?? "-",
      compareLabel: compareItem?.labels?.[lang] ?? compareItem?.key ?? "-",
    };
  });
}

export default function RubricManagement() {
  const { lang, t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useRubrics();
  const rubrics = useMemo(() => data?.rubrics ?? [], [data?.rubrics]);
  const [documentType, setDocumentType] = useState<DocumentType>("project-review");
  const documentRubrics = useMemo(
    () => rubrics.filter((rubric) => rubric.document_type === documentType),
    [documentType, rubrics],
  );
  const activeRubric = documentRubrics.find((rubric) => rubric.active) ?? documentRubrics[0] ?? null;
  const [version, setVersion] = useState<string>("");
  const [compareVersion, setCompareVersion] = useState<string>("");
  const selectedRubric = version
    ? documentRubrics.find((rubric) => rubric.version === version) ?? null
    : activeRubric;
  const compareRubric = compareVersion
    ? documentRubrics.find((rubric) => rubric.version === compareVersion) ?? null
    : null;
  const [form, setForm] = useState<FormState>(() => payloadFromRubric(null));
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!version && activeRubric) {
      setVersion(activeRubric.version);
    }
  }, [activeRubric, version]);

  useEffect(() => {
    setVersion("");
    setCompareVersion("");
  }, [documentType]);

  useEffect(() => {
    if (selectedRubric) {
      setForm(payloadFromRubric(selectedRubric));
      setMessage(null);
    }
  }, [selectedRubric]);

  const totalScore = form.criteria.reduce((sum, criterion) => sum + Number(criterion.max_score || 0), 0);
  const totalValid = Math.abs(totalScore - 100) <= 0.01;
  const hasPrompt = Boolean(form.prompt?.vi?.trim());
  const promptLanguage = lang;
  const promptValue = form.prompt?.[promptLanguage] || "";
  const activeVersion = activeRubric?.version ?? t("common.noValue");
  const compareCandidates = documentRubrics.filter((rubric) => rubric.version !== form.version);
  const criteriaDiff = useMemo(
    () => buildCriteriaDiff(selectedRubric, compareRubric, lang),
    [compareRubric, lang, selectedRubric],
  );
  const diffSummary = useMemo(() => {
    const added = criteriaDiff.filter((item) => item.type === "added").length;
    const removed = criteriaDiff.filter((item) => item.type === "removed").length;
    const changed = criteriaDiff.filter((item) => item.type === "changed").length;
    const unchanged = criteriaDiff.filter((item) => item.type === "unchanged").length;
    return { added, removed, changed, unchanged };
  }, [criteriaDiff]);
  const currentPrompt = promptText(selectedRubric?.prompt ?? form.prompt, promptLanguage);
  const comparePrompt = compareRubric ? promptText(compareRubric.prompt, promptLanguage) : "";
  const promptChanged = Boolean(compareRubric) && currentPrompt.trim() !== comparePrompt.trim();
  const chartFallback = <div className="chart-card chart-card--loading" aria-hidden="true" />;

  const saveMutation = useMutation({
    mutationFn: () => saveRubricVersion(documentType, form.version, form),
    onSuccess: async (rubric) => {
      setVersion(rubric.version);
      setMessage({ type: "success", text: t("rubric.saved") });
      await queryClient.invalidateQueries({ queryKey: rubricsQueryKey });
    },
    onError: (mutationError) => {
      setMessage({
        type: "error",
        text: mutationError instanceof Error ? mutationError.message : t("rubric.saveFailed"),
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => activateRubricVersion(documentType, form.version),
    onSuccess: async (rubric) => {
      setVersion(rubric.version);
      setMessage({ type: "success", text: t("rubric.activated") });
      await queryClient.invalidateQueries({ queryKey: rubricsQueryKey });
    },
    onError: (mutationError) => {
      setMessage({
        type: "error",
        text: mutationError instanceof Error ? mutationError.message : t("rubric.activateFailed"),
      });
    },
  });

  const createNewVersion = () => {
    const versionName = nextVersion(documentRubrics.map((rubric) => rubric.version));
    const source = payloadFromRubric(activeRubric);
    setVersion(versionName);
    setForm({
      ...source,
      version: versionName,
    });
    setMessage(null);
  };

  if (isLoading) {
    return <LoadingState title={t("rubric.loading")} description={t("rubric.pageSubtitle")} />;
  }

  if (error) {
    return <ErrorState title={t("rubric.loadFailed")} description={error instanceof Error ? error.message : t("rubric.loadFailed")} />;
  }
  return (
    <div className="workspace-stack">
      <div className="governance-explorer">
        {/* Sidebar */}
        <aside className="governance-explorer__sidebar">
          <div style={{ marginBottom: '16px' }}>
            <Card title={t("upload.documentType")}>
              <Select 
                value={documentType} 
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                options={DOCUMENT_TYPE_OPTIONS.map(opt => ({ value: opt.id, label: t(opt.labelKey) }))}
              />
            </Card>
          </div>

          <Card title={t("rubric.activeSummary")}>
            <div className="detail-section">
              <span className="detail-section__title">{t("rubric.activeVersion")}</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '18px' }}>{activeVersion}</strong>
                <StatusBadge tone="success">{t("rubric.active")}</StatusBadge>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="detail-section">
                <span className="detail-section__title">{t("rubric.criteria")}</span>
                <strong>{form.criteria.length}</strong>
              </div>
              <div className="detail-section">
                <span className="detail-section__title">{t("upload.overallScore")}</span>
                <strong>{totalScore}</strong>
              </div>
            </div>
          </Card>

          <Card title={t("rubric.versionList")}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {documentRubrics.map((rubric) => (
                <button
                  key={`${rubric.document_type}-${rubric.version}`}
                  type="button"
                  className={`submission-card__button ${rubric.version === form.version ? "is-active" : ""}`}
                  style={{ textAlign: 'left', width: '100%' }}
                  onClick={() => setVersion(rubric.version)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{rubric.version}</div>
                    {rubric.active && <StatusBadge tone="success">{t("rubric.active")}</StatusBadge>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ds-color-text-muted)' }}>
                    {rubric.criteria.length} {t("rubric.criteria")}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button variant="outline" size="sm" onClick={createNewVersion} fullWidth>
                <PlusIcon size="sm" />
                {t("rubric.createVersion")}
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => activateMutation.mutate()} 
                disabled={!form.version || activateMutation.isPending || selectedRubric?.active}
                isLoading={activateMutation.isPending}
                fullWidth
              >
                {t("rubric.activate")}
              </Button>
            </div>
          </Card>
        </aside>

        {/* Content */}
        <main className="governance-explorer__content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card title={t("rubric.activeSummarySubtitle")}>
              <div className="governance-grid">
                <Input 
                  label={t("upload.rubricVersionLabel")} 
                  value={form.version} 
                  onChange={(e) => setForm(curr => ({ ...curr, version: e.target.value }))}
                />
                <div className="detail-section">
                  <span className="detail-section__title">{t("rubric.criteria")}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {form.criteria.map(c => (
                      <code key={c.key} style={{ fontSize: '11px', padding: '2px 6px', background: 'var(--ds-color-bg-muted)', borderRadius: '4px' }}>
                        {c.key}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card title={t("rubric.scoreAllocationTitle")} subtitle={t("rubric.scoreAllocationSubtitle")}>
              <Suspense fallback={chartFallback}>
                <RubricScoreAllocationChart criteria={form.criteria} language={lang} />
              </Suspense>
            </Card>

            <Card title={t("rubric.promptSection")} subtitle={`${t("common.language")}: ${promptLanguage.toUpperCase()}`}>
              <textarea
                value={promptValue}
                onChange={(e) => setForm(curr => ({
                  ...curr,
                  prompt: { ...curr.prompt, [promptLanguage]: e.target.value }
                }))}
                rows={15}
                style={{ 
                  width: '100%', padding: '12px', 
                  borderRadius: 'var(--ds-radius-md)', border: '1px solid var(--ds-color-border)',
                  fontFamily: 'var(--ds-font-mono)', fontSize: '13px', lineHeight: '1.5',
                  backgroundColor: 'var(--ds-color-bg-main)', color: 'var(--ds-color-text-main)'
                }}
                placeholder={t("rubric.promptCanonicalPlaceholder")}
              />
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  variant="primary" 
                  onClick={() => saveMutation.mutate()}
                  disabled={!totalValid || !hasPrompt || saveMutation.isPending}
                  isLoading={saveMutation.isPending}
                >
                  {t("rubric.save")}
                </Button>
              </div>
              {message && (
                <div style={{ marginTop: '12px' }}>
                  <StatusBadge tone={message.type === "success" ? "success" : "danger"}>
                    {message.text}
                  </StatusBadge>
                </div>
              )}
            </Card>

            <Card title={t("rubric.compareVersion")}>
              <div style={{ marginBottom: '16px' }}>
                <Select 
                  label={t("rubric.compareVersionHint")} 
                  value={compareVersion} 
                  onChange={(e) => setCompareVersion(e.target.value)}
                  options={[
                    { value: "", label: t("rubric.compareVersionNone") },
                    ...compareCandidates.map(r => ({ value: r.version, label: r.version }))
                  ]}
                />
              </div>

              {compareRubric && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="governance-grid">
                    <div className="detail-section">
                      <span className="detail-section__title">{t("rubric.diffAdded")}</span>
                      <div style={{ fontSize: '20px', fontWeight: 700 }}>{diffSummary.added}</div>
                    </div>
                    <div className="detail-section">
                      <span className="detail-section__title">{t("rubric.diffChanged")}</span>
                      <div style={{ fontSize: '20px', fontWeight: 700 }}>{diffSummary.changed}</div>
                    </div>
                    <div className="detail-section">
                      <span className="detail-section__title">{t("rubric.promptChanged")}</span>
                      <StatusBadge tone={promptChanged ? "warning" : "success"}>
                        {promptChanged ? t("common.yes") : t("common.no")}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="rubric-diff-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {criteriaDiff.map((item) => (
                      <div key={item.key} style={{ 
                        padding: '16px', borderRadius: 'var(--ds-radius-md)', 
                        border: '1px solid var(--ds-color-border)',
                        backgroundColor: 'var(--ds-color-bg-muted)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <strong style={{ fontSize: '14px' }}>{item.key}</strong>
                          <StatusBadge tone={
                            item.type === "added" ? "success" : 
                            item.type === "removed" ? "danger" : 
                            item.type === "changed" ? "warning" : "muted"
                          }>
                            {getDiffTypeLabel(item.type, t)}
                          </StatusBadge>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                          <div>
                            <div style={{ color: 'var(--ds-color-text-muted)' }}>{form.version}</div>
                            <div style={{ fontWeight: 600 }}>{item.currentLabel}</div>
                            <div>{item.currentMax ?? "—"}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--ds-color-text-muted)' }}>{compareRubric.version}</div>
                            <div style={{ fontWeight: 600 }}>{item.compareLabel}</div>
                            <div>{item.compareMax ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="detail-section">
                      <span className="detail-section__title">{form.version} Prompt</span>
                      <pre style={{ 
                        padding: '12px', backgroundColor: 'var(--ds-color-bg-muted)', 
                        borderRadius: 'var(--ds-radius-md)', fontSize: '11px', whiteSpace: 'pre-wrap',
                        maxHeight: '300px', overflowY: 'auto'
                      }}>
                        {currentPrompt || "—"}
                      </pre>
                    </div>
                    <div className="detail-section">
                      <span className="detail-section__title">{compareRubric.version} Prompt</span>
                      <pre style={{ 
                        padding: '12px', backgroundColor: 'var(--ds-color-bg-muted)', 
                        borderRadius: 'var(--ds-radius-md)', fontSize: '11px', whiteSpace: 'pre-wrap',
                        maxHeight: '300px', overflowY: 'auto'
                      }}>
                        {comparePrompt || "—"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
