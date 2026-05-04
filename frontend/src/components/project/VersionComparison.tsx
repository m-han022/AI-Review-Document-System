import { useMemo } from "react";
import { diffWordsWithSpace } from "diff";
import { useTranslation } from "../LanguageSelector";
import type { VersionComparison as VersionComparisonData } from "../../types";
import SectionBlock from "../ui/SectionBlock";
import Badge from "../ui/Badge";
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  MinusIcon,
  ShieldCheckIcon,
  TargetIcon,
  SparkIcon,
  WorkflowIcon,
  AlertTriangleIcon,
  BookOpenIcon,
  PlusIcon,
  TrashIcon
} from "../ui/Icon";

interface VersionComparisonProps {
  data: VersionComparisonData;
}

function getCriterionIcon(criterionKey: string) {
  switch (criterionKey) {
    case "review_tong_the":
    case "kha_nang_tai_hien_bug":
    case "do_ro_rang":
    case "do_ro_rang_de_hieu":
      return TargetIcon;
    case "diem_tot":
    case "do_bao_phu":
    case "tinh_chinh_xac":
      return ShieldCheckIcon;
    case "kha_nang_truy_vet":
      return SparkIcon;
    case "diem_xau":
    case "danh_gia_anh_huong":
      return AlertTriangleIcon;
    case "chinh_sach":
    case "giai_phap_phong_ngua":
    case "tinh_thuc_thi":
    case "tinh_ung_dung":
      return WorkflowIcon;
    case "chat_luong_viet":
    case "phan_tich_nguyen_nhan":
    case "tinh_day_du_dung_trong_tam":
      return BookOpenIcon;
    default:
      return TargetIcon;
  }
}

function DiffText({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = useMemo(() => {
    // Truncate to avoid performance issues if text is extremely long
    const limit = 5000;
    const t1 = oldText.slice(0, limit);
    const t2 = newText.slice(0, limit);
    return diffWordsWithSpace(t1, t2);
  }, [oldText, newText]);

  return (
    <div style={{ lineHeight: '1.6' }}>
      {diff.map((part, i) => (
        <span
          key={i}
          style={{
            backgroundColor: part.added ? '#dcfce7' : part.removed ? '#fee2e2' : 'transparent',
            textDecoration: part.removed ? 'line-through' : 'none',
            color: part.added ? '#166534' : part.removed ? '#991b1b' : 'inherit',
            padding: part.added || part.removed ? '2px 0' : '0'
          }}
        >
          {part.value}
        </span>
      ))}
      {(oldText.length > 5000 || newText.length > 5000) && (
        <div style={{ marginTop: '8px', color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>
          ... (Text truncated for comparison performance)
        </div>
      )}
    </div>
  );
}

export default function VersionComparison({ data }: VersionComparisonProps) {
  const { t, lang } = useTranslation();

  const scoreA = data.base_run?.total_score ?? data.base_run?.score ?? null;
  const scoreB = data.compare_run?.total_score ?? data.compare_run?.score ?? null;

  const renderStatusBadge = (status: string, delta: number) => {
    switch (status) {
      case "improved":
        return <Badge tone="success"><ArrowUpIcon size="sm" /> {t("compare.improved")} ({delta > 0 ? `+${delta}` : delta})</Badge>;
      case "regressed":
        return <Badge tone="danger"><ArrowDownIcon size="sm" /> {t("compare.regressed")} ({delta})</Badge>;
      case "new":
        return <Badge tone="primary"><PlusIcon size="sm" /> {t("compare.new")}</Badge>;
      case "retired":
        return <Badge tone="default"><TrashIcon size="sm" /> {t("compare.retired")}</Badge>;
      default:
        return <Badge tone="warning"><MinusIcon size="sm" /> {t("compare.unchanged")}</Badge>;
    }
  };

  const feedbackA = data.base_run?.draft_feedback ? (data.base_run.draft_feedback[lang] || data.base_run.draft_feedback['vi'] || data.base_run.draft_feedback['ja']) : "";
  const feedbackB = data.compare_run?.draft_feedback ? (data.compare_run.draft_feedback[lang] || data.compare_run.draft_feedback['vi'] || data.compare_run.draft_feedback['ja']) : "";

  return (
    <div className="version-comparison">
      {/* Deterministic Insight Summary */}
      {data.insights && data.insights.length > 0 && (
        <SectionBlock style={{ marginBottom: '24px' }}>
          <SectionBlock.Header title={t("compare.insights")} />
          <SectionBlock.Body>
             <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e293b' }}>
               {data.insights.map((insight, idx) => (
                 <li key={idx} style={{ marginBottom: '8px' }}>{insight}</li>
               ))}
             </ul>
          </SectionBlock.Body>
        </SectionBlock>
      )}

      {/* High-level Summary Cards */}
      <div className="comparison-summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <SectionBlock>
          <SectionBlock.Header title={t("compare.scoreDelta")} />
          <SectionBlock.Body>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{data.base_version.version}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{scoreA ?? "—"}</div>
              </div>
              <div style={{ fontSize: '20px', color: '#94a3b8' }}>→</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{data.compare_version.version}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{scoreB ?? "—"}</div>
              </div>
            </div>
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
                {data.score_delta !== null && data.score_delta !== undefined ? renderStatusBadge(Number(data.score_delta) > 0 ? "improved" : Number(data.score_delta) < 0 ? "regressed" : "unchanged", Number(data.score_delta)) : <Badge tone="warning">—</Badge>}
            </div>
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock>
          <SectionBlock.Header title={t("compare.okDelta")} />
          <SectionBlock.Body>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                      {data.base_run?.slide_reviews?.filter(s => s.status === "OK").length ?? 0}
                   </div>
                </div>
                <div style={{ fontSize: '20px', color: '#94a3b8' }}>→</div>
                <div style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                      {data.compare_run?.slide_reviews?.filter(s => s.status === "OK").length ?? 0}
                   </div>
                </div>
             </div>
             <div style={{ marginTop: '12px', textAlign: 'center' }}>
                {renderStatusBadge(data.ok_slide_delta > 0 ? "improved" : data.ok_slide_delta < 0 ? "regressed" : "unchanged", data.ok_slide_delta)}
             </div>
          </SectionBlock.Body>
        </SectionBlock>

        <SectionBlock>
          <SectionBlock.Header title={t("compare.ngDelta")} />
          <SectionBlock.Body>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                <div style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                      {data.base_run?.slide_reviews?.filter(s => s.status === "NG").length ?? 0}
                   </div>
                </div>
                <div style={{ fontSize: '20px', color: '#94a3b8' }}>→</div>
                <div style={{ textAlign: 'center' }}>
                   <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                      {data.compare_run?.slide_reviews?.filter(s => s.status === "NG").length ?? 0}
                   </div>
                </div>
             </div>
             <div style={{ marginTop: '12px', textAlign: 'center' }}>
                {/* For NG slides, positive delta is regression */}
                {renderStatusBadge(data.ng_slide_delta < 0 ? "improved" : data.ng_slide_delta > 0 ? "regressed" : "unchanged", data.ng_slide_delta)}
             </div>
          </SectionBlock.Body>
        </SectionBlock>
      </div>

      {/* Criteria Breakdown Table */}
      <SectionBlock style={{ marginBottom: '24px' }}>
        <SectionBlock.Header title={t("compare.criteriaComparison")} />
        <SectionBlock.Body className="p-0">
          <table className="comparison-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{t("rubric.criteria")}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{data.base_version.version}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{data.compare_version.version}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.criteria_deltas.map(({ key, base_score, compare_score, delta, status }) => {
                const Icon = getCriterionIcon(key);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon size="sm" style={{ color: '#94a3b8' }} />
                        <span style={{ fontWeight: '500' }}>{t(`upload.criteria.${key}`) || key}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {base_score !== null ? base_score : "—"}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {compare_score !== null ? compare_score : "—"}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {renderStatusBadge(status, delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionBlock.Body>
      </SectionBlock>

      {/* Feedback Comparison with Text Diff */}
      <SectionBlock>
        <SectionBlock.Header title={t("compare.feedbackComparison")} />
        <SectionBlock.Body>
          {(!feedbackA && !feedbackB) ? (
             <Badge tone="warning">{t("compare.noData")}</Badge>
          ) : (
             <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
               <DiffText oldText={feedbackA} newText={feedbackB} />
             </div>
          )}
        </SectionBlock.Body>
      </SectionBlock>

      {/* Robust Empty States for Individual Versions */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
        {!data.base_run && (
          <Badge tone="danger">{t("compare.noData")} ({data.base_version.version})</Badge>
        )}
        {!data.compare_run && (
          <Badge tone="danger">{t("compare.noData")} ({data.compare_version.version})</Badge>
        )}
      </div>
    </div>
  );
}
