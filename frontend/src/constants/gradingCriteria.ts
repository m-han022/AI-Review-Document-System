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
      review_tong_the: "Review t\u1ed5ng th\u1ec3",
      diem_tot: "\u0110i\u1ec3m t\u1ed1t",
      diem_xau: "\u0110i\u1ec3m c\u1ea7n c\u1ea3i thi\u1ec7n",
      chat_luong_viet: "Ch\u1ea5t l\u01b0\u1ee3ng vi\u1ebft",
    },
    ja: {
      review_tong_the: "\u30ec\u30d3\u30e5\u30fc\u7dcf\u5408",
      diem_tot: "\u826f\u3044\u70b9",
      diem_xau: "\u6539\u5584\u70b9",
      chat_luong_viet: "\u6587\u7ae0\u54c1\u8cea",
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
      review_tong_the: "\u0110\u00e1nh gi\u00e1 t\u1ed5ng th\u1ec3",
      diem_tot: "\u0110i\u1ec3m t\u1ed1t",
      diem_xau: "\u0110i\u1ec3m x\u1ea5u",
      chinh_sach: "Ch\u00ednh s\u00e1ch c\u1ea3i thi\u1ec7n",
    },
    ja: {
      review_tong_the: "\u7dcf\u5408\u8a55\u4fa1",
      diem_tot: "\u826f\u3044\u70b9",
      diem_xau: "\u60aa\u3044\u70b9",
      chinh_sach: "\u6539\u5584\u65b9\u91dd",
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
      kha_nang_tai_hien_bug: "Kh\u1ea3 n\u0103ng t\u00e1i hi\u1ec7n bug",
      phan_tich_nguyen_nhan: "Ph\u00e2n t\u00edch nguy\u00ean nh\u00e2n",
      danh_gia_anh_huong: "\u0110\u00e1nh gi\u00e1 \u1ea3nh h\u01b0\u1edfng",
      giai_phap_phong_ngua: "Gi\u1ea3i ph\u00e1p & ph\u00f2ng ng\u1eeba",
    },
    ja: {
      kha_nang_tai_hien_bug: "\u30d0\u30b0\u518d\u73fe\u6027",
      phan_tich_nguyen_nhan: "\u539f\u56e0\u5206\u6790",
      danh_gia_anh_huong: "\u5f71\u97ff\u8a55\u4fa1",
      giai_phap_phong_ngua: "\u89e3\u6c7a\u7b56\u30fb\u518d\u767a\u9632\u6b62",
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
      do_ro_rang: "\u0110\u1ed9 r\u00f5 r\u00e0ng",
      do_bao_phu: "\u0110\u1ed9 bao ph\u1ee7",
      kha_nang_truy_vet: "Kh\u1ea3 n\u0103ng truy v\u1ebft",
      tinh_thuc_thi: "T\u00ednh th\u1ef1c thi",
    },
    ja: {
      do_ro_rang: "\u660e\u78ba\u6027",
      do_bao_phu: "\u30ab\u30d0\u30ec\u30c3\u30b8",
      kha_nang_truy_vet: "\u30c8\u30ec\u30fc\u30b5\u30d3\u30ea\u30c6\u30a3",
      tinh_thuc_thi: "\u5b9f\u884c\u53ef\u80fd\u6027",
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
      do_ro_rang_de_hieu: "\u0110\u1ed9 r\u00f5 r\u00e0ng & d\u1ec5 hi\u1ec3u",
      tinh_day_du_dung_trong_tam: "T\u00ednh \u0111\u1ea7y \u0111\u1ee7 & \u0111\u00fang tr\u1ecdng t\u00e2m",
      tinh_chinh_xac: "T\u00ednh ch\u00ednh x\u00e1c",
      tinh_ung_dung: "T\u00ednh \u1ee9ng d\u1ee5ng",
    },
    ja: {
      do_ro_rang_de_hieu: "\u660e\u78ba\u6027\u30fb\u5206\u304b\u308a\u3084\u3059\u3055",
      tinh_day_du_dung_trong_tam: "\u5341\u5206\u6027\u30fb\u7126\u70b9",
      tinh_chinh_xac: "\u6b63\u78ba\u6027",
      tinh_ung_dung: "\u5b9f\u7528\u6027",
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
