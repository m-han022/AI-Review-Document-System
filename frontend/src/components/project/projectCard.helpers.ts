import { isUploadCriterionKey } from "../../constants/uploadCriteria";
import { getLocalizedText } from "../../locales/utils";
import type { LanguageCode, PageReview } from "../../types";
import { formatUploadedAt } from "../submissions/utils";
import { toBusinessStatus } from "../ui/businessStatus";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  SparkIcon,
  TargetIcon,
  WorkflowIcon,
} from "../ui/Icon";
import type { FeedbackSectionView } from "./ProjectReviewPanels";

export interface OrderedScoreItem {
  key: string;
  label: string;
  value: number;
  max: number;
  evaluation?: string;
  Icon: ReturnType<typeof getCriterionIcon>;
}


export function getCriterionIcon(criterionKey: string) {
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

export function formatDateTime(value: string | null | undefined, lang: LanguageCode) {
  if (!value) return "-";
  return formatUploadedAt(value, lang);
}

export function splitFeedbackLines(feedback: Record<string, string> | null, lang: LanguageCode): string[] {
  const normalized = getLocalizedText(feedback, lang)
    // Some responses store escaped newlines, causing one giant line and empty sections.
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function getStatusLabel(status: string, t: (key: string) => string): string {
  const mapped = toBusinessStatus(status);
  if (mapped === "reviewReady") return t("statusBiz.reviewReady");
  if (mapped === "attentionNeeded") return t("statusBiz.attentionNeeded");
  if (mapped === "exporting") return t("statusBiz.exporting");
  return t("statusBiz.processing");
}

export function splitFeedbackSections(lines: string[]): FeedbackSectionView[] {
  const sections: FeedbackSectionView[] = [];
  for (const line of lines) {
    // Handle markdown/numbered headers and keep inline content after ":" / "-" when present.
    if (/^(?:#{1,6}\s+)?(?:\*\*)?[0-9]+[.)]\s*/.test(line)) {
      const normalized = line.replace(/[*#]/g, "").trim();
      const parts = normalized.split(/[:：]\s*|\s[-–—]\s+/, 2);
      const title = (parts[0] || "").trim();
      const inlineContent = (parts[1] || "").trim();
      sections.push({ title, lines: inlineContent ? [inlineContent] : [] });
      continue;
    }
    const current = sections.at(-1);
    if (current) current.lines.push(line);
    else sections.push({ title: "", lines: [line] });
  }
  return sections.length ? sections : [{ title: "", lines }];
}


export function buildPageReviewItems(
  PageReviews: PageReview[] | undefined,
  lang: LanguageCode,
  t: (key: string) => string,
  extractedText?: string,
) {
  const reviews = PageReviews || [];
  let maxPage = 0;
  if (extractedText) {
    const pageMatches = extractedText.match(/\[(?:Page|Slide)\s+(\d+)\]/g);
    if (pageMatches) {
      maxPage = Math.max(...pageMatches.map((m) => parseInt(m.match(/\d+/)?.[0] || "0", 10)));
    }
  }
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const totalSlides = Math.max(
    maxPage,
    safeReviews.length
      ? Math.max(...safeReviews.map((r) => Number(r.page_number ?? r.slide_number ?? 0)))
      : 0,
  );
  if (totalSlides <= 0) {
    return [
      {
        id: -1,
        page_number: 1,
        status: "OK" as const,
        displayTitle: (t("project.slideNumber") || "Slide {number}").replace("{number}", "1"),
        summary: t("project.noIssuesDetected"),
        issues: [],
        suggestions: "",
      },
    ];
  }
  const results = [];
  const reviewMap = new Map(safeReviews.map((r) => [Number(r.page_number ?? r.slide_number), r]));
  for (let i = 1; i <= totalSlides; i++) {
    const item = reviewMap.get(i);
    if (item) {
      const title = getLocalizedText(item.title, lang);
      const summary = getLocalizedText(item.summary, lang);
      const localizedIssues = item.issues as Record<string, string[]> | null;
      const issues = (localizedIssues?.[lang] ?? localizedIssues?.[lang === "vi" ? "ja" : "vi"] ?? []).filter(Boolean);
      const suggestions = getLocalizedText(item.suggestions, lang);
      results.push({
        ...item,
        page_number: Number((item as any).page_number ?? item.slide_number),
        displayTitle: title || (t("project.slideNumber") || "Slide {number}").replace("{number}", String(i)),
        summary: summary || t("project.noIssuesDetected"),
        issues,
        suggestions,
      });
    } else {
      results.push({
        id: -i,
        page_number: i,
        status: "OK" as const,
        displayTitle: (t("project.slideNumber") || "Slide {number}").replace("{number}", String(i)),
        summary: t("project.noIssuesDetected"),
        issues: [],
        suggestions: "",
      });
    }
  }
  return results.sort((a, b) => a.page_number - b.page_number);
}

export function getCriterionLabel(
  key: string,
  t: (key: string) => string,
  rubricLabelMap?: Record<string, string>,
) {
  const runtimeLabel = rubricLabelMap?.[key]?.trim();
  if (runtimeLabel) return runtimeLabel;
  if (!isUploadCriterionKey(key)) return key;
  switch (key) {
    case "review_tong_the": return t("upload.criteria.review_tong_the");
    case "diem_tot": return t("upload.criteria.diem_tot");
    case "diem_xau": return t("upload.criteria.diem_xau");
    case "chinh_sach": return t("upload.criteria.chinh_sach");
    case "chat_luong_viet": return t("upload.criteria.chat_luong_viet");
    case "kha_nang_tai_hien_bug": return t("upload.criteria.kha_nang_tai_hien_bug");
    case "phan_tich_nguyen_nhan": return t("upload.criteria.phan_tich_nguyen_nhan");
    case "danh_gia_anh_huong": return t("upload.criteria.danh_gia_anh_huong");
    case "giai_phap_phong_ngua": return t("upload.criteria.giai_phap_phong_ngua");
    case "do_ro_rang": return t("upload.criteria.do_ro_rang");
    case "do_bao_phu": return t("upload.criteria.do_bao_phu");
    case "kha_nang_truy_vet": return t("upload.criteria.kha_nang_truy_vet");
    case "tinh_thuc_thi": return t("upload.criteria.tinh_thuc_thi");
    case "do_ro_rang_de_hieu": return t("upload.criteria.do_ro_rang_de_hieu");
    case "tinh_day_du_dung_trong_tam": return t("upload.criteria.tinh_day_du_dung_trong_tam");
    case "tinh_chinh_xac": return t("upload.criteria.tinh_chinh_xac");
    case "tinh_ung_dung": return t("upload.criteria.tinh_ung_dung");
    default: return key;
  }
}

