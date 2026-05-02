import type { LanguageCode, RubricVersion } from "../types";

export interface CriteriaConfig {
  order: string[];
  maxScores: Record<string, number>;
  labels: Record<string, string>;
}

const DEFAULT_CRITERIA_CONFIG = {
  order: ["review_tong_the", "diem_tot", "diem_xau", "chat_luong_viet"],
  maxScores: {
    review_tong_the: 23.5,
    diem_tot: 33.5,
    diem_xau: 23.5,
    chat_luong_viet: 19.5,
  },
  labels: {
    vi: {
      review_tong_the: "Review tổng thể",
      diem_tot: "Điểm tốt",
      diem_xau: "Điểm cần cải thiện",
      chat_luong_viet: "Chất lượng viết",
    },
    ja: {
      review_tong_the: "レビュー総合",
      diem_tot: "良い点",
      diem_xau: "改善点",
      chat_luong_viet: "文章品質",
    },
  },
} as const;

const PROJECT_REVIEW_CRITERIA_CONFIG = {
  order: ["review_tong_the", "diem_tot", "diem_xau", "chinh_sach"],
  maxScores: {
    review_tong_the: 25,
    diem_tot: 25,
    diem_xau: 30,
    chinh_sach: 20,
  },
  labels: {
    vi: {
      review_tong_the: "Đánh giá tổng thể",
      diem_tot: "Điểm tốt",
      diem_xau: "Điểm xấu",
      chinh_sach: "Chính sách cải thiện",
    },
    ja: {
      review_tong_the: "総合評価",
      diem_tot: "良い点",
      diem_xau: "悪い点",
      chinh_sach: "改善方針",
    },
  },
} as const;

const BUG_ANALYSIS_CRITERIA_CONFIG = {
  order: ["kha_nang_tai_hien_bug", "phan_tich_nguyen_nhan", "danh_gia_anh_huong", "giai_phap_phong_ngua"],
  maxScores: {
    kha_nang_tai_hien_bug: 25,
    phan_tich_nguyen_nhan: 25,
    danh_gia_anh_huong: 25,
    giai_phap_phong_ngua: 25,
  },
  labels: {
    vi: {
      kha_nang_tai_hien_bug: "Khả năng tái hiện bug",
      phan_tich_nguyen_nhan: "Phân tích nguyên nhân",
      danh_gia_anh_huong: "Đánh giá ảnh hưởng",
      giai_phap_phong_ngua: "Giải pháp & phòng ngừa",
    },
    ja: {
      kha_nang_tai_hien_bug: "バグ再現性",
      phan_tich_nguyen_nhan: "原因分析",
      danh_gia_anh_huong: "影響評価",
      giai_phap_phong_ngua: "解決策・再発防止",
    },
  },
} as const;

const QA_REVIEW_CRITERIA_CONFIG = {
  order: ["do_ro_rang", "do_bao_phu", "kha_nang_truy_vet", "tinh_thuc_thi"],
  maxScores: {
    do_ro_rang: 25,
    do_bao_phu: 25,
    kha_nang_truy_vet: 25,
    tinh_thuc_thi: 25,
  },
  labels: {
    vi: {
      do_ro_rang: "Độ rõ ràng",
      do_bao_phu: "Độ bao phủ",
      kha_nang_truy_vet: "Khả năng truy vết",
      tinh_thuc_thi: "Tính thực thi",
    },
    ja: {
      do_ro_rang: "明確性",
      do_bao_phu: "カバレッジ",
      kha_nang_truy_vet: "トレーサビリティ",
      tinh_thuc_thi: "実行可能性",
    },
  },
} as const;

const EXPLANATION_REVIEW_CRITERIA_CONFIG = {
  order: ["do_ro_rang_de_hieu", "tinh_day_du_dung_trong_tam", "tinh_chinh_xac", "tinh_ung_dung"],
  maxScores: {
    do_ro_rang_de_hieu: 25,
    tinh_day_du_dung_trong_tam: 25,
    tinh_chinh_xac: 25,
    tinh_ung_dung: 25,
  },
  labels: {
    vi: {
      do_ro_rang_de_hieu: "Độ rõ ràng & dễ hiểu",
      tinh_day_du_dung_trong_tam: "Tính đầy đủ & đúng trọng tâm",
      tinh_chinh_xac: "Tính chính xác",
      tinh_ung_dung: "Tính ứng dụng",
    },
    ja: {
      do_ro_rang_de_hieu: "明確性・分かりやすさ",
      tinh_day_du_dung_trong_tam: "十分性・焦点",
      tinh_chinh_xac: "正確性",
      tinh_ung_dung: "実用性",
    },
  },
} as const;

export function getCriteriaConfig(
  documentType: string | null | undefined,
  language: LanguageCode,
): CriteriaConfig {
  const config =
    documentType === "project-review"
      ? PROJECT_REVIEW_CRITERIA_CONFIG
      : documentType === "bug-analysis"
        ? BUG_ANALYSIS_CRITERIA_CONFIG
        : documentType === "qa-review"
          ? QA_REVIEW_CRITERIA_CONFIG
          : documentType === "explanation-review"
            ? EXPLANATION_REVIEW_CRITERIA_CONFIG
            : DEFAULT_CRITERIA_CONFIG;
  const labels = config.labels[language] ?? config.labels.ja;

  return {
    order: [...config.order],
    maxScores: { ...config.maxScores },
    labels,
  };
}

export function criteriaConfigFromRubric(rubric: RubricVersion | null | undefined, language: LanguageCode): CriteriaConfig | null {
  if (!rubric) {
    return null;
  }

  return {
    order: rubric.criteria.map((criterion) => criterion.key),
    maxScores: Object.fromEntries(rubric.criteria.map((criterion) => [criterion.key, criterion.max_score])),
    labels: Object.fromEntries(
      rubric.criteria.map((criterion) => [criterion.key, criterion.labels[language] ?? criterion.labels.ja ?? criterion.key]),
    ),
  };
}

export function getActiveRubricConfig(
  rubrics: RubricVersion[] | undefined,
  documentType: string | null | undefined,
  language: LanguageCode,
): CriteriaConfig {
  const activeRubric = rubrics?.find((rubric) => rubric.document_type === documentType && rubric.active);
  return criteriaConfigFromRubric(activeRubric, language) ?? getCriteriaConfig(documentType, language);
}
