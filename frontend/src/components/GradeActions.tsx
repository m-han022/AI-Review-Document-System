import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getGradeJob, gradeAll } from "../api/client";
import { submissionsQueryKey } from "../query";
import type { GradeJobResponse } from "../types";
import Badge from "./ui/Badge";
import { RefreshIcon } from "./ui/Icon";
import { useTranslation } from "./LanguageSelector";

interface GradeActionsProps {
  ungradedCount: number;
}

export default function GradeActions({ ungradedCount }: GradeActionsProps) {
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
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
          queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
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

  const handleGradeAll = async () => {
    setGrading(true);
    setResult(null);
    try {
      const res = await gradeAll();
      setActiveJobId(res.job_id);
      setResult(`${t("submissions.grading")} 0/${res.total_count}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : t("submissions.gradingFailed"));
      setGrading(false);
    }
  };

  return (
    <div className="grade-actions">
      <div className="grade-actions__top">
        <button className="btn-primary" onClick={handleGradeAll} disabled={grading || ungradedCount === 0}>
          <RefreshIcon size="sm" />
          {grading ? t("submissions.grading") : `${t("submissions.gradeAll")} (${ungradedCount})`}
        </button>
        <Badge tone={ungradedCount > 0 ? "warning" : "success"}>
          {ungradedCount > 0 ? `${ungradedCount} ${t("project.pending")}` : t("common.ready")}
        </Badge>
      </div>
      <p className="grade-actions__hint">{t("submissions.batchHint")}</p>
      {result ? <div className="grade-actions__status">{result}</div> : null}
    </div>
  );
}
