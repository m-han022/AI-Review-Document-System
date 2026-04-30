/* eslint-disable react-hooks/set-state-in-effect */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { activateRubricVersion, saveRubricVersion } from "../../api/client";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../../constants/documentTypes";
import { rubricsQueryKey } from "../../query";
import type { RubricVersion, RubricVersionPayload } from "../../types";
import { useRubrics } from "../../hooks/useRubrics";
import { useTranslation } from "../LanguageSelector";
import Badge from "../ui/Badge";
import { PlusIcon } from "../ui/Icon";
import SectionBlock from "../ui/SectionBlock";
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

function promptText(prompt: RubricVersion["prompt"], key: "vi" | "ja"): string {
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
      labels: { vi: criterion.labels.vi ?? criterion.key, ja: criterion.labels.ja ?? criterion.key },
    })),
    prompt: {
      vi: promptText(rubric.prompt, "vi") || promptText(rubric.prompt, "ja"),
      ja: promptText(rubric.prompt, "ja"),
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
  lang: "vi" | "ja",
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
      currentLabel: currentItem?.labels?.[lang] ?? currentItem?.key ?? "—",
      compareLabel: compareItem?.labels?.[lang] ?? compareItem?.key ?? "—",
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
  const activeVersion = activeRubric?.version ?? "—";
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
    return <div className="loading-panel">{t("rubric.loading")}</div>;
  }

  if (error) {
    return <div className="error-banner">{error instanceof Error ? error.message : t("rubric.loadFailed")}</div>;
  }

  return (
    <div className="rubric-manager">
      <SectionBlock className="rubric-editor-panel">
        <SectionBlock.Header title={t("rubric.title")} subtitle={t("rubric.subtitle")} />
        <SectionBlock.Body>
          <div className="rubric-manager__top-bar">
            <label className="rubric-field">
              <span>{t("upload.documentType")}</span>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rubric-manager__layout">
            <aside className="rubric-manager__sidebar">
              <div className="rubric-sidebar-panel">
                <div className="rubric-sidebar-panel__head">
                  <div>
                    <span className="rubric-sidebar-panel__eyebrow">{t("rubric.activeSummary")}</span>
                    <strong>{activeVersion}</strong>
                  </div>
                  <Badge tone="success">{t("rubric.active")}</Badge>
                </div>
                <div className="rubric-sidebar-panel__meta">
                  <div>
                    <span>{t("upload.rubricVersionLabel")}</span>
                    <strong>{form.version || "—"}</strong>
                  </div>
                  <div>
                    <span>{t("rubric.criteria")}</span>
                    <strong>{form.criteria.length}</strong>
                  </div>
                  <div>
                    <span>{t("upload.overallScore")}</span>
                    <strong>{totalScore}</strong>
                  </div>
                </div>
              </div>

              <div className="rubric-sidebar-section">
                <div className="rubric-sidebar-title">{t("rubric.versionList")}</div>
                <div className="rubric-version-list">
                  {documentRubrics.map((rubric) => (
                    <button
                      key={`${rubric.document_type}-${rubric.version}`}
                      type="button"
                      className={`rubric-version-item ${rubric.active ? "rubric-version-item--active" : ""} ${
                        rubric.version === form.version ? "is-selected" : ""
                      }`.trim()}
                      onClick={() => setVersion(rubric.version)}
                    >
                      <div className="rubric-version-item__copy">
                        <strong>{rubric.version}</strong>
                        <span>{rubric.criteria.length} {t("rubric.criteria")}</span>
                      </div>
                      {rubric.active ? (
                        <span className="rubric-status-badge rubric-status-badge--active">{t("rubric.active")}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rubric-sidebar-section">
                <div className="rubric-sidebar-title">{t("rubric.compareVersion")}</div>
                <label className="rubric-field">
                  <span>{t("rubric.compareVersionHint")}</span>
                  <select
                    value={compareVersion}
                    onChange={(event) => setCompareVersion(event.target.value)}
                  >
                    <option value="">{t("rubric.compareVersionNone")}</option>
                    {compareCandidates.map((rubric) => (
                      <option key={`${rubric.document_type}-${rubric.version}`} value={rubric.version}>
                        {rubric.version}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rubric-sidebar-actions">
                <button type="button" className="btn-secondary btn-secondary--compact" onClick={createNewVersion}>
                  <PlusIcon size="sm" />
                  {t("rubric.createVersion")}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary--compact"
                  onClick={() => activateMutation.mutate()}
                  disabled={!form.version || activateMutation.isPending}
                >
                  {activateMutation.isPending ? t("rubric.activating") : t("rubric.activate")}
                </button>
              </div>
            </aside>

            <div className="rubric-editor">
              <div className="rubric-editor__hero">
                <div className="rubric-editor__hero-copy">
                  <div className="rubric-editor__hero-top">
                    <Badge tone={selectedRubric?.active ? "success" : "default"}>
                      {selectedRubric?.active ? t("rubric.active") : form.version}
                    </Badge>
                    <span>{t("rubric.promptSection")}</span>
                  </div>
                  <h3>{form.version || "—"}</h3>
                  <p>{t("rubric.activeSummarySubtitle")}</p>
                </div>

                <div className="rubric-active-summary">
                  <div className="rubric-active-summary__item">
                    <span>{t("rubric.criteria")}</span>
                    <strong>{form.criteria.length}</strong>
                  </div>
                  <div className="rubric-active-summary__item">
                    <span>{t("upload.overallScore")}</span>
                    <strong>{totalScore}</strong>
                  </div>
                  <div className="rubric-active-summary__item">
                    <span>{t("common.language")}</span>
                    <strong>{promptLanguage.toUpperCase()}</strong>
                  </div>
                  <div className="rubric-active-summary__item">
                    <span>{t("common.status")}</span>
                    <strong>{hasPrompt ? t("common.ready") : t("project.pending")}</strong>
                  </div>
                </div>
              </div>

              {compareRubric ? (
                <div className="rubric-diff-summary">
                  <div className="rubric-diff-summary__head">
                    <div>
                      <h3>{t("rubric.compareSummaryTitle")}</h3>
                      <p>
                        {form.version} ↔ {compareRubric.version}
                      </p>
                    </div>
                    <Badge tone={promptChanged ? "warning" : "success"}>
                      {promptChanged ? t("rubric.promptChanged") : t("rubric.promptUnchanged")}
                    </Badge>
                  </div>
                  <div className="rubric-diff-summary__grid">
                    <article className="rubric-diff-summary__item">
                      <span>{t("rubric.diffAdded")}</span>
                      <strong>{diffSummary.added}</strong>
                    </article>
                    <article className="rubric-diff-summary__item">
                      <span>{t("rubric.diffRemoved")}</span>
                      <strong>{diffSummary.removed}</strong>
                    </article>
                    <article className="rubric-diff-summary__item">
                      <span>{t("rubric.diffChanged")}</span>
                      <strong>{diffSummary.changed}</strong>
                    </article>
                    <article className="rubric-diff-summary__item">
                      <span>{t("rubric.diffUnchanged")}</span>
                      <strong>{diffSummary.unchanged}</strong>
                    </article>
                  </div>
                </div>
              ) : null}

              <div className="rubric-editor__header">
                <label className="rubric-field">
                  <span>{t("upload.rubricVersionLabel")}</span>
                  <input
                    value={form.version}
                    onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                  />
                </label>

                <div className="rubric-criteria-compact">
                  <span>{t("rubric.criteriaNote")}</span>
                  <div className="rubric-key-group">
                    {form.criteria.map((criterion) => (
                      <code key={criterion.key} title={criterion.labels[lang]}>
                        {criterion.key}
                      </code>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rubric-editor__section">
                <div className="rubric-editor__section-head">
                  <div>
                    <h3>{t("rubric.scoreAllocationTitle")}</h3>
                    <p className="section-block__subtitle">{t("rubric.scoreAllocationSubtitle")}</p>
                  </div>
                </div>
                <Suspense fallback={chartFallback}>
                  <RubricScoreAllocationChart criteria={form.criteria} language={lang} />
                </Suspense>
              </div>

              <div className="rubric-editor__section rubric-editor__section--expand">
                <div className="rubric-editor__section-head">
                  <div>
                    <h3>{t("rubric.promptSection")}</h3>
                    <p className="section-block__subtitle">{t("common.language")}: {promptLanguage.toUpperCase()}</p>
                  </div>
                </div>
                <div className="rubric-prompt-single">
                  <label className="rubric-field rubric-field--textarea">
                    <span>{t("rubric.promptCanonical")}</span>
                    <textarea
                      value={promptValue}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          prompt: { ...(current.prompt || {}), [promptLanguage]: event.target.value },
                        }))
                      }
                      rows={15}
                      placeholder={t("rubric.promptCanonicalPlaceholder")}
                    />
                  </label>
                </div>
              </div>

              {compareRubric ? (
                <>
                  <div className="rubric-editor__section">
                    <div className="rubric-editor__section-head">
                      <div>
                        <h3>{t("rubric.criteriaDiffTitle")}</h3>
                        <p className="section-block__subtitle">{t("rubric.criteriaDiffSubtitle")}</p>
                      </div>
                    </div>
                    <div className="rubric-diff-list">
                      {criteriaDiff.map((item) => (
                        <article className={`rubric-diff-card rubric-diff-card--${item.type}`.trim()} key={item.key}>
                          <div className="rubric-diff-card__head">
                            <strong>{item.key}</strong>
                            <Badge
                              tone={
                                item.type === "added"
                                  ? "success"
                                  : item.type === "removed"
                                    ? "danger"
                                    : item.type === "changed"
                                      ? "warning"
                                      : "default"
                              }
                            >
                              {t(`rubric.diffType.${item.type}`)}
                            </Badge>
                          </div>
                          <div className="rubric-diff-card__grid">
                            <div>
                              <span>{form.version}</span>
                              <strong>{item.currentLabel}</strong>
                              <p>{item.currentMax ?? "—"}</p>
                            </div>
                            <div>
                              <span>{compareRubric.version}</span>
                              <strong>{item.compareLabel}</strong>
                              <p>{item.compareMax ?? "—"}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="rubric-editor__section">
                    <div className="rubric-editor__section-head">
                      <div>
                        <h3>{t("rubric.promptDiffTitle")}</h3>
                        <p className="section-block__subtitle">{t("rubric.promptDiffSubtitle")}</p>
                      </div>
                    </div>
                    <div className="rubric-prompt-compare">
                      <article className="rubric-prompt-compare__panel">
                        <span>{form.version}</span>
                        <pre>{currentPrompt || "—"}</pre>
                      </article>
                      <article className="rubric-prompt-compare__panel">
                        <span>{compareRubric.version}</span>
                        <pre>{comparePrompt || "—"}</pre>
                      </article>
                    </div>
                  </div>
                </>
              ) : null}

              {message ? <div className={`rubric-message rubric-message--${message.type}`}>{message.text}</div> : null}

              <div className="rubric-editor__actions">
                <button
                  type="button"
                  className="btn-primary btn-primary--compact"
                  onClick={() => saveMutation.mutate()}
                  disabled={!totalValid || !hasPrompt || saveMutation.isPending}
                >
                  {saveMutation.isPending ? t("rubric.saving") : t("rubric.save")}
                </button>
              </div>
            </div>
          </div>
        </SectionBlock.Body>
      </SectionBlock>
    </div>
  );
}
