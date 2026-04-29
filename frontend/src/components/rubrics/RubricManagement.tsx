/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { activateRubricVersion, saveRubricVersion } from "../../api/client";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../../constants/documentTypes";
import { rubricsQueryKey } from "../../query";
import type { RubricVersion, RubricVersionPayload } from "../../types";
import { useTranslation } from "../LanguageSelector";
import SectionBlock from "../ui/SectionBlock";
import { PlusIcon } from "../ui/Icon";
import { useRubrics } from "../../hooks/useRubrics";

type FormState = RubricVersionPayload;

const EMPTY_PROMPT = {};

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
  const selectedRubric = version
    ? documentRubrics.find((rubric) => rubric.version === version) ?? null
    : activeRubric;
  const [form, setForm] = useState<FormState>(() => payloadFromRubric(null));
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!version && activeRubric) {
      setVersion(activeRubric.version);
    }
  }, [activeRubric, version]);

  useEffect(() => {
    setVersion("");
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
                    <strong>{rubric.version}</strong>
                    <span className={`rubric-status-badge ${rubric.active ? "rubric-status-badge--active" : ""}`}>
                      {rubric.active ? t("rubric.active") : ""}
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn-primary btn-primary--compact"
                onClick={() => activateMutation.mutate()}
                disabled={!form.version || activateMutation.isPending}
              >
                {activateMutation.isPending ? t("rubric.activating") : t("rubric.activate")}
              </button>

              <button type="button" className="btn-secondary btn-secondary--compact" onClick={createNewVersion}>
                <PlusIcon size="sm" />
                {t("rubric.createVersion")}
              </button>
            </aside>

            <div className="rubric-editor">
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

              <div className="rubric-editor__section rubric-editor__section--expand">
                <div className="rubric-editor__section-head">
                  <h3>{t("rubric.promptSection")}</h3>
                </div>
                <div className="rubric-prompt-single">
                  <label className="rubric-field rubric-field--textarea">
                    <span>{t("rubric.promptCanonical")}</span>
                    <textarea
                      value={form.prompt?.[promptLanguage] || ""}
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
