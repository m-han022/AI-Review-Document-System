export const UPLOAD_CRITERIA_KEYS = [
  "review_tong_the",
  "diem_tot",
  "diem_xau",
  "chinh_sach",
  "chat_luong_viet",
  "kha_nang_tai_hien_bug",
  "phan_tich_nguyen_nhan",
  "danh_gia_anh_huong",
  "giai_phap_phong_ngua",
  "do_ro_rang",
  "do_bao_phu",
  "kha_nang_truy_vet",
  "tinh_thuc_thi",
  "do_ro_rang_de_hieu",
  "tinh_day_du_dung_trong_tam",
  "tinh_chinh_xac",
  "tinh_ung_dung",
] as const;

export type UploadCriterionKey = (typeof UPLOAD_CRITERIA_KEYS)[number];

export function isUploadCriterionKey(value: string): value is UploadCriterionKey {
  return (UPLOAD_CRITERIA_KEYS as readonly string[]).includes(value);
}
