import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getGradeJob, gradeAll } from "../api/client";
import { projectsQueryKey } from "../query";
import type { GradeJobResponse } from "../types";
import Badge from "./ui/Badge";
import ConfirmDialog from "./ui/ConfirmDialog";
import { RefreshIcon } from "./ui/Icon";
import { useTranslation } from "./LanguageSelector";

interface GradeActionsProps {
  ungradedCount: number;
  totalCount: number;
}

export default function GradeActions({ ungradedCount, totalCount }: GradeActionsProps) {
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [confirmRegradeAll, setConfirmRegradeAll] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    const pollJob = async () => {
      try {
        const job: GradeJobResponse = await getGradeJob(activeJobId);
        setResult(
          `${t("submissions.grading")} ${job.processed_count}/${job.total_count}` +
            (job.failed_count > 0 ? `, ${job.failed_count} ${t("common.failed")}` : ""),
        );

        if (job.status === "completed") {
          setResult(
            `${t("submissions.graded")}: ${job.graded_count}` +
              (job.failed_count > 0 ? `, ${job.failed_count} ${t("common.failed")}` : ""),
          );
          setGrading(false);
          setActiveJobId(null);
          queryClient.invalidateQueries({ queryKey: projectsQueryKey });
        } else if (job.status === "failed") {
          setResult(job.error || t("submissions.gradingFailed"));
          setGrading(false);
          setActiveJobId(null);
        }
      } catch (err) {
        setResult(err instanceof Error ? err.message : t("submissions.gradingFailed"));
        setGrading(false);
        setActiveJobId(null);
      }
    };

    void pollJob();
    const timer = window.setInterval(() => {
      void pollJob();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [activeJobId, queryClient, t]);

  const handleGradeAll = async (force: boolean) => {
    setGrading(true);
    setResult(null);
    try {
      const res = await gradeAll({ force });
      setActiveJobId(res.job_id);
      setResult(`${force ? t("submissions.regrade") : t("submissions.grading")} 0/${res.total_count}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : t("submissions.gradingFailed"));
      setGrading(false);
    }
  };

  return (
    <div className="grade-actions">
      <div className="grade-actions__panel">
        <div className="grade-actions__summary">
          <div className="grade-actions__summary-main">
            <strong>{t("project.title") || t("submissions.title")}</strong>
            <span>
              {grading
                ? t("submissions.grading")
                : ungradedCount > 0
                  ? `${ungradedCount}/${totalCount} ${t("project.pending")}`
                  : `${totalCount} ${t("submissions.graded")}`}
            </span>
          </div>
          <Badge tone={ungradedCount > 0 ? "warning" : "success"}>
            {ungradedCount > 0 ? `${ungradedCount} ${t("project.pending")}` : t("common.ready")}
          </Badge>
        </div>
        <div className="grade-actions__buttons">
          <button
            className="btn-primary"
            onClick={() => void handleGradeAll(false)}
            disabled={grading || ungradedCount === 0}
          >
            <RefreshIcon size="sm" />
            {grading ? t("submissions.grading") : `${t("submissions.gradeAll")} (${ungradedCount})`}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setConfirmRegradeAll(true)}
            disabled={grading || totalCount === 0}
          >
            <RefreshIcon size="sm" />
            {t("submissions.regradeAll")}
          </button>
        </div>
      </div>
      <p className="grade-actions__hint">
        {ungradedCount > 0 ? t("submissions.batchHint") : t("submissions.batchRegradeHint")}
      </p>
      {result ? <div className="grade-actions__status">{result}</div> : null}

      <ConfirmDialog
        open={confirmRegradeAll}
        title={t("submissions.regradeAll")}
        description={t("submissions.regradeAllConfirm").replace("{count}", String(totalCount))}
        confirmLabel={t("submissions.regradeAll")}
        cancelLabel={t("common.cancel")}
        pending={grading}
        onConfirm={() => {
          setConfirmRegradeAll(false);
          void handleGradeAll(true);
        }}
        onCancel={() => {
          if (!grading) {
            setConfirmRegradeAll(false);
          }
        }}
      />
    </div>
  );
}
