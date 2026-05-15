import type { GradingRunHistory, Project, DocumentListOut, VersionListOut } from "../../types";
import { Button, Card, Input, Select, SearchableSelect, StatusBadge } from "../ui";
import { EmptyState, LoadingState } from "../ui/States";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/Icon";
import {
  auditErrorSummary,
  auditReviewedAtLabel,
  auditStatusLabel,
  auditStatusTone,
  isFailedAuditStatus,
} from "./auditDashboard.helpers";

type Translator = (key: string, params?: Record<string, string | number>) => string;

export interface AuditFilterState {
  projectId: string;
  documentId: string;
  versionId: string;
  status: string;
  fromTime: string;
  toTime: string;
  limit: number;
  offset: number;
}

export function AuditFiltersSection({
  t,
  filters,
  projectsList,
  documentsList,
  versionsList,
  canExport,
  isExporting,
  onSetFilter,
  onReset,
  onRefresh,
  onExport,
}: {
  t: Translator;
  filters: AuditFilterState;
  projectsList: Project[];
  documentsList: DocumentListOut[];
  versionsList: VersionListOut[];
  canExport: boolean;
  isExporting: boolean;
  onSetFilter: (key: keyof AuditFilterState, value: string | number) => void;
  onReset: () => void;
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <section aria-label={t("sm.auditDashboard.filterTitle")}>
      <Card title={t("sm.auditDashboard.filterTitle")}>
        <div className="audit-filter-section">
          <SearchableSelect
            label={t("sm.audit.project")}
            value={filters.projectId}
            onChange={(val) => onSetFilter("projectId", val)}
            options={projectsList.map((p) => ({ value: p.project_id, label: p.project_name || p.project_id }))}
            placeholder={t("sm.auditDashboard.projectPlaceholder")}
          />
          <SearchableSelect
            label={t("sm.audit.document")}
            value={filters.documentId}
            onChange={(val) => onSetFilter("documentId", val)}
            disabled={!filters.projectId}
            options={documentsList.map((d) => ({ value: String(d.document_id), label: d.document_name }))}
            placeholder={t("sm.auditDashboard.documentPlaceholder")}
            hideValue={true}
          />
          <SearchableSelect
            label={t("sm.audit.version")}
            value={filters.versionId}
            onChange={(val) => onSetFilter("versionId", val)}
            disabled={!filters.documentId}
            options={versionsList.map((v) => ({ value: String(v.document_version_id), label: v.version }))}
            placeholder={t("sm.auditDashboard.versionPlaceholder")}
            hideValue={true}
          />
          <Select
            label={t("common.status")}
            value={filters.status}
            onChange={(e) => onSetFilter("status", e.target.value)}
            options={[
              { value: "", label: t("sm.auditDashboard.statusAll") },
              { value: "PENDING", label: t("status.pending") },
              { value: "EXTRACTING", label: t("status.extracting") },
              { value: "GRADING", label: t("status.grading") },
              { value: "COMPLETED", label: t("status.completed") },
              { value: "FAILED", label: t("status.failed") },
            ]}
          />
          <Input
            label={t("sm.auditDashboard.fromTime")}
            type="datetime-local"
            value={filters.fromTime}
            onChange={(e) => onSetFilter("fromTime", e.target.value)}
          />
          <Input
            label={t("sm.auditDashboard.toTime")}
            type="datetime-local"
            value={filters.toTime}
            onChange={(e) => onSetFilter("toTime", e.target.value)}
          />
        </div>

        <div className="audit-actions">
          <Button variant="ghost" onClick={onReset} size="md">
            {t("sm.auditDashboard.reset")}
          </Button>
          <Button variant="outline" onClick={onRefresh} size="md">
            {t("sm.common.retry")}
          </Button>
          <Button variant="primary" onClick={onExport} disabled={!canExport || isExporting} isLoading={isExporting} size="md">
            {t("submissions.exportExcel")}
          </Button>
        </div>
      </Card>
    </section>
  );
}

export function AuditRunsTableSection({
  t,
  status,
  rows,
  selectedRunId,
  offset,
  limit,
  onSelectRun,
  onPreviousPage,
  onNextPage,
}: {
  t: Translator;
  status: "idle" | "loading" | "ready" | "empty" | "error";
  rows: GradingRunHistory[];
  selectedRunId: number | null;
  offset: number;
  limit: number;
  onSelectRun: (runId: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <section aria-label={t("sm.auditDashboard.tableTitle")}>
      <div className="ds-table-container">
        <table className="ds-table ds-table--compact">
          <thead>
            <tr>
              <th style={{ width: "80px" }}>{t("sm.audit.gradingRun")}</th>
              <th style={{ width: "22%" }}>{t("sm.audit.project")}</th>
              <th style={{ width: "22%" }}>{t("sm.audit.document")}</th>
              <th style={{ width: "90px" }}>{t("sm.audit.version")}</th>
              <th style={{ width: "100px" }}>{t("project.totalScore")}</th>
              <th style={{ width: "130px" }}>{t("common.status")}</th>
              <th style={{ width: "170px" }}>{t("project.reviewedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" ? (
              <tr><td colSpan={7}><LoadingState title={t("common.loading")} /></td></tr>
            ) : status === "empty" ? (
              <tr><td colSpan={7}><EmptyState title={t("sm.auditDashboard.empty")} compact /></td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} onClick={() => onSelectRun(row.id)} className={`audit-table-row ${selectedRunId === row.id ? "is-active" : ""}`}>
                  <td>#{String(row.id)}</td>
                  <td className="ds-text-truncate" title={String(row.project_name || row.project_id)}>{String(row.project_name || row.project_id || t("common.noValue"))}</td>
                  <td className="ds-text-truncate" title={String(row.document_name || "")}>{String(row.document_name || t("common.noValue"))}</td>
                  <td>{String(row.document_version || t("common.noValue"))}</td>
                  <td className="font-bold">{typeof row.total_score === "number" ? `${row.total_score}/100` : "-"}</td>
                  <td>
                    <div className="audit-status-cell">
                      <StatusBadge tone={auditStatusTone(row.status)}>{auditStatusLabel(row.status, t)}</StatusBadge>
                      {isFailedAuditStatus(row.status) && row.error_message && (
                        <div className="audit-status-reason ds-text-truncate" title={row.error_message}>{auditErrorSummary(row.error_message)}</div>
                      )}
                    </div>
                  </td>
                  <td className="text-muted" style={{ fontSize: "11px" }}>{auditReviewedAtLabel(row.graded_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="audit-pagination" style={{ borderTop: "1px solid var(--ds-color-border)", paddingTop: "16px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="audit-pagination-info">
            {String(t("common.pagination", { start: offset + 1, end: offset + rows.length, total: rows.length }))}
          </div>
          <div className="audit-pagination-btns" style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" size="sm" disabled={offset === 0} onClick={onPreviousPage}><ChevronLeftIcon size="sm" /></Button>
            <Button variant="ghost" size="sm" disabled={rows.length < limit} onClick={onNextPage}><ChevronRightIcon size="sm" /></Button>
          </div>
        </div>
      </div>
    </section>
  );
}
