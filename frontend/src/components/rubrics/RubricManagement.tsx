import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { activateRubricVersion, saveRubricVersion } from "../../api/client";
import type { DocumentType } from "../../constants/documentTypes";
import { rubricsQueryKey } from "../../query";
import type { RubricVersion, RubricVersionPayload, LanguageCode } from "../../types";
import { useRubrics } from "../../hooks/useRubrics";
import { useTranslation } from "../LanguageSelector";
import { Card, Input } from "../ui";
import { ErrorState, LoadingState } from "../ui/States";
import { toHumanErrorMessage } from "../../utils/humanizeError";
import RubricComparePanel from "./RubricComparePanel";
import RubricPromptEditor from "./RubricPromptEditor";
import RubricSidebar from "./RubricSidebar";
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
        text: toHumanErrorMessage(mutationError, t("rubric.saveFailed")),
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
        text: toHumanErrorMessage(mutationError, t("rubric.activateFailed")),
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
    return <ErrorState title={t("rubric.loadFailed")} description={toHumanErrorMessage(error, t("rubric.loadFailed"))} />;
  }
  return (
    <div className="workspace-stack">
      <div className="governance-explorer">
        <RubricSidebar
          t={t}
          documentType={documentType}
          onDocumentTypeChange={setDocumentType}
          activeVersion={activeVersion}
          criteriaCount={form.criteria.length}
          totalScore={totalScore}
          documentRubrics={documentRubrics}
          selectedVersion={form.version}
          onSelectVersion={setVersion}
          onCreateNewVersion={createNewVersion}
          onActivate={() => activateMutation.mutate()}
          canActivate={Boolean(form.version) && !activateMutation.isPending && !selectedRubric?.active}
          activating={activateMutation.isPending}
        />

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

            <RubricPromptEditor
              title={t("rubric.promptSection")}
              subtitle={`${t("common.language")}: ${promptLanguage.toUpperCase()}`}
              promptValue={promptValue}
              placeholder={t("rubric.promptCanonicalPlaceholder")}
              onPromptChange={(value) =>
                setForm((curr) => ({
                  ...curr,
                  prompt: { ...curr.prompt, [promptLanguage]: value },
                }))
              }
              onSave={() => saveMutation.mutate()}
              saveLabel={t("rubric.save")}
              saveDisabled={!totalValid || !hasPrompt || saveMutation.isPending}
              saveLoading={saveMutation.isPending}
              message={message}
            />

            <RubricComparePanel
              title={t("rubric.compareVersion")}
              compareVersionHint={t("rubric.compareVersionHint")}
              compareVersionNone={t("rubric.compareVersionNone")}
              compareVersion={compareVersion}
              onCompareVersionChange={setCompareVersion}
              compareCandidates={compareCandidates.map((r) => ({ value: r.version, label: r.version }))}
              compareRubricVersion={compareRubric?.version ?? null}
              diffAddedLabel={t("rubric.diffAdded")}
              diffChangedLabel={t("rubric.diffChanged")}
              promptChangedLabel={t("rubric.promptChanged")}
              yesLabel={t("common.yes")}
              noLabel={t("common.no")}
              diffSummary={{ added: diffSummary.added, changed: diffSummary.changed }}
              promptChanged={promptChanged}
              criteriaDiff={criteriaDiff}
              currentVersion={form.version}
              currentPrompt={currentPrompt}
              comparePrompt={comparePrompt}
              diffTypeLabel={(type) => getDiffTypeLabel(type, t)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}


