import type { LanguageCode } from "../types";

export type AIConfigCopy = {
  loading: string;
  loadFailed: string;
  title: string;
  subtitle: string;
  scopeDocumentType?: string;
  scopeLevel?: string;
  modeNote: string;
  tabSets: string;
  tabCreate: string;
  tabCompare: string;
  noActiveSetTooltip: string;
  sectionSetList: string;
  sectionSetListSub: string;
  noActiveSet: string;
  noActiveSetHelp: string;
  createFromCurrent: string;
  bootstrapScope: string;
  bootstrapping: string;
  searchPlaceholder: string;
  noSet: string;
  selected: string;
  setDetail: string;
  history: string;
  selectFromList: string;
  compareTitle: string;
  compareSub: string;
  leftSet: string;
  rightSet: string;
  diff: string;
  changed: string;
  unchanged: string;
  createTitle: string;
  step: string;
  setName: string;
  docType: string;
  promptLevel: string;
  changeRubric: string;
  changePrompt: string;
  changePolicy: string;
  changeRules: string;
  noEffectiveChange: string;
  cancel: string;
  review: string;
  back: string;
  saveArchived: string;
  saveAndActivate: string;
  saving: string;
  reviewHint: string;
  newVersion: string;
  reuse: string;
  documentTypeLabel: string;
  createSuccess: string;
  bootstrapSuccess: string;
  createFailed: string;
  bootstrapFailed: string;
  activationTitle: string;
  activationDesc: string;
  quickGuideShow: string;
  quickGuideHide: string;
  showActiveOnly: string;
  showAllStatuses: string;
  rubricNotFound: string;
  promptRequired: string;
  policyRequired: string;
  criteriaRequired: string;
  historyShowing: string;
  createdAt: string;
  hideDetail: string;
  showDetail: string;
  readOnlyNotice: string;
  setNameLabel: string;
  statusLabel: string;
  levelLabel: string;
  rubricLabel: string;
  promptLabel: string;
  policyLabel: string;
  requiredRulesVersionLabel: string;
  requiredRulesHashLabel: string;
  rubricReadonly: string;
  promptReadonly: string;
  policyReadonly: string;
  rulesReadonly: string;
  createFromThisSet: string;
  compareWithOtherSet: string;
  rubricCompareLabel: string;
  promptCompareLabel: string;
  policyCompareLabel: string;
  rulesCompareLabel: string;
  levelHelp: string;
  openGuide: string;
  rubricHelp: string;
  rubricCriteriaLabel: string;
  criterionKeyPlaceholder: string;
  criterionMaxPlaceholder: string;
  criterionLabelViPlaceholder: string;
  criterionLabelJaPlaceholder: string;
  totalScorePrefix: string;
  addCriterion: string;
  promptHelp: string;
  policyHelp: string;
  rulesHelp: string;
  setNameSummary: string;
  rulesWarning: string;
};

export const AI_CONFIG_COPY: Record<LanguageCode, AIConfigCopy> = {
  ja: {
    loading: "Loading AI Configuration Console...",
    loadFailed: "Failed to load configuration data",
    title: "AI Configuration Console",
    subtitle: "採点セット単位で管理し、運用をシンプルにします。",
    modeNote: "採点セットモード: Rubric + Prompt + Policy + Required Rules を1つのセットとして管理します。",
    tabSets: "Evaluation Sets",
    tabCreate: "Create New Set",
    tabCompare: "Compare Sets",
    noActiveSetTooltip: "Create an initial set in the Evaluation Sets tab first.",
    sectionSetList: "採点セット一覧",
    sectionSetListSub: "現在のスコープで active / archived を表示します。項目を選択して詳細を確認できます。",
    noActiveSet: "No active Evaluation Set in this scope.",
    noActiveSetHelp: "Click \"Create first set\" to make grading ready.",
    createFromCurrent: "Create from current set",
    bootstrapScope: "Create first set",
    bootstrapping: "Bootstrapping...",
    searchPlaceholder: "Search by set name / version label",
    noSet: "No evaluation set.",
    selected: "Selected",
    setDetail: "Set Detail",
    history: "History",
    selectFromList: "Select an Evaluation Set from the list.",
    compareTitle: "Compare Sets",
    compareSub: "Side-by-side comparison for audit.",
    leftSet: "Left set",
    rightSet: "Right set",
    diff: "差分表示",
    changed: "変更あり",
    unchanged: "変更なし",
    createTitle: "Create New Evaluation Set",
    step: "Step",
    setName: "Set name",
    docType: "Document type",
    promptLevel: "Evaluation level",
    changeRubric: "Change Rubric",
    changePrompt: "Change Prompt",
    changePolicy: "Change Policy",
    changeRules: "Change Required Rules",
    noEffectiveChange: "No effective change. Existing versions will be reused.",
    cancel: "Cancel",
    review: "Review",
    back: "Back",
    saveArchived: "Save (Archived)",
    saveAndActivate: "Save and Activate",
    saving: "Saving...",
    reviewHint: "変更した要素だけ新しい immutable version を作成します。",
    newVersion: "Create new version",
    reuse: "再利用",
    documentTypeLabel: "Document type",
    createSuccess: "Created and activated new Evaluation Set.",
    bootstrapSuccess: "Created first Evaluation Set.",
    createFailed: "Failed to create set",
    bootstrapFailed: "Failed to bootstrap first set",
    activationTitle: "Confirm Activation",
    activationDesc: "This set will be used for new gradings only. Existing results stay unchanged.",
    quickGuideShow: "Quick guide",
    quickGuideHide: "Hide quick guide",
    showActiveOnly: "Show active only",
    showAllStatuses: "Show all statuses",
    rubricNotFound: "Rubric not found for this document type.",
    promptRequired: "Please enter prompt content.",
    policyRequired: "Please enter policy content.",
    criteriaRequired: "To create Rubric v1 from scratch, criteria definitions are required.",
    historyShowing: "Showing {shown}/{total} sets",
    createdAt: "Created at",
    hideDetail: "Hide details",
    showDetail: "View details",
    readOnlyNotice: "This set is for viewing only. To change content, create a new set from current.",
    setNameLabel: "Set name",
    statusLabel: "Status",
    levelLabel: "Evaluation level",
    rubricLabel: "Rubric",
    promptLabel: "Prompt",
    policyLabel: "Policy",
    requiredRulesVersionLabel: "Required rules version",
    requiredRulesHashLabel: "Required rules hash",
    rubricReadonly: "Rubric (read-only)",
    promptReadonly: "Prompt (read-only)",
    policyReadonly: "Policy (read-only)",
    rulesReadonly: "Required rules (read-only)",
    createFromThisSet: "Create new set from this",
    compareWithOtherSet: "Compare with another set",
    rubricCompareLabel: "Rubric",
    promptCompareLabel: "Prompt",
    policyCompareLabel: "Policy",
    rulesCompareLabel: "Required rules",
    levelHelp: "Low: fast and short feedback. Medium: balanced. High: stricter and requires clearer evidence.",
    openGuide: "Open guide",
    rubricHelp: "Define what to score and score weights.",
    rubricCriteriaLabel: "Rubric criteria (for first set)",
    criterionKeyPlaceholder: "key",
    criterionMaxPlaceholder: "max",
    criterionLabelViPlaceholder: "label vi",
    criterionLabelJaPlaceholder: "label ja",
    totalScorePrefix: "Total score: ",
    addCriterion: "+ Add",
    promptHelp: "Define AI feedback style and focus.",
    policyHelp: "Define strictness and score deduction rules.",
    rulesHelp: "Mandatory output constraints AI must always follow.",
    setNameSummary: "Set Name",
    rulesWarning: "注意：これはシステムの安定性を確保するための必須ルールであるため、変更しないことをお勧めします。",
  },
  vi: {
    loading: "Đang tải AI Configuration Console...",
    loadFailed: "Không thể tải dữ liệu cấu hình",
    title: "Thiết lập tiêu chuẩn chấm AI",
    subtitle: "Thiết lập cách AI chấm điểm theo từng bộ tiêu chuẩn, dễ theo dõi và dễ thay đổi.",
    scopeDocumentType: "Loại tài liệu",
    scopeLevel: "Mức độ đánh giá",
    modeNote: "Mỗi bộ tiêu chuẩn chấm gồm 4 phần chính, thay đổi phần nào thì chỉ tạo version mới cho phần đó.",
    tabSets: "Bộ tiêu chuẩn chấm",
    tabCreate: "Tạo bộ mới",
    tabCompare: "So sánh bộ",
    noActiveSetTooltip: "Hãy tạo bộ khởi tạo ở tab Bộ tiêu chuẩn chấm trước.",
    sectionSetList: "Danh sách Bộ tiêu chuẩn chấm",
    sectionSetListSub: "Hiển thị active/archived trong scope hiện tại. Chọn item để xem chi tiết.",
    noActiveSet: "Chưa có Bộ cấu hình đánh giá cho loại tài liệu này.",
    noActiveSetHelp: "Bấm \"Tạo bộ đầu tiên\" để hệ thống sẵn sàng chấm.",
    createFromCurrent: "Tạo mới từ bộ hiện tại",
    bootstrapScope: "Tạo bộ đầu tiên",
    bootstrapping: "Đang khởi tạo...",
    searchPlaceholder: "Tìm theo tên set / version label",
    noSet: "Không có bộ tiêu chuẩn chấm.",
    selected: "Đang chọn",
    setDetail: "Bộ đang chọn",
    history: "Lịch sử",
    selectFromList: "Chọn một Bộ tiêu chuẩn chấm từ danh sách.",
    compareTitle: "So sánh bộ",
    compareSub: "So sánh song song để kiểm tra/audit.",
    leftSet: "Bộ trái",
    rightSet: "Bộ phải",
    diff: "Diff Highlight",
    changed: "changed",
    unchanged: "unchanged",
    createTitle: "Tạo Bộ tiêu chuẩn chấm mới",
    step: "Bước",
    setName: "Tên set",
    docType: "Loại tài liệu",
    promptLevel: "Mức độ đánh giá",
    changeRubric: "Đổi Khung tiêu chí chấm điểm",
    changePrompt: "Đổi Hướng dẫn phản hồi AI",
    changePolicy: "Đổi Nguyên tắc đánh giá",
    changeRules: "Đổi Quy tắc bắt buộc",
    noEffectiveChange: "Không có thay đổi hiệu lực. Hệ thống sẽ reuse version hiện có.",
    cancel: "Hủy",
    review: "Xem lại",
    back: "Quay lại",
    saveArchived: "Lưu (Archived)",
    saveAndActivate: "Lưu và kích hoạt",
    saving: "Đang lưu...",
    reviewHint: "Chỉ thành phần thay đổi mới tạo version immutable mới.",
    newVersion: "Tạo version mới",
    reuse: "Reuse",
    documentTypeLabel: "Loại tài liệu",
    createSuccess: "Đã tạo và kích hoạt Bộ tiêu chuẩn chấm mới.",
    bootstrapSuccess: "Đã tạo bộ cấu hình đầu tiên và sẵn sàng sử dụng.",
    createFailed: "Tạo set thất bại",
    bootstrapFailed: "Khởi tạo set thất bại",
    activationTitle: "Xác nhận kích hoạt",
    activationDesc: "Bạn đang kích hoạt set này. Các lần chấm mới sẽ dùng set này. Kết quả cũ không thay đổi.",
    quickGuideShow: "Hướng dẫn nhanh cách chấm",
    quickGuideHide: "Ẩn hướng dẫn nhanh cách chấm",
    showActiveOnly: "Chỉ hiện active",
    showAllStatuses: "Hiện tất cả trạng thái",
    rubricNotFound: "Chưa có khung tiêu chí chấm điểm cho loại tài liệu này.",
    promptRequired: "Vui lòng nhập hướng dẫn phản hồi AI.",
    policyRequired: "Vui lòng nhập nguyên tắc đánh giá.",
    criteriaRequired: "Để tạo khung tiêu chí chấm điểm v1 từ đầu cần có danh sách tiêu chí.",
    historyShowing: "Đang hiển thị {shown}/{total} bộ",
    createdAt: "Tạo lúc",
    hideDetail: "Ẩn chi tiết",
    showDetail: "Xem chi tiết",
    readOnlyNotice: "Bộ này chỉ để xem lại. Muốn thay đổi nội dung, hãy tạo bộ mới từ bộ hiện tại.",
    setNameLabel: "Tên bộ",
    statusLabel: "Trạng thái",
    levelLabel: "Mức độ đánh giá",
    rubricLabel: "Khung tiêu chí chấm điểm",
    promptLabel: "Hướng dẫn phản hồi AI",
    policyLabel: "Nguyên tắc đánh giá",
    requiredRulesVersionLabel: "Phiên bản quy tắc bắt buộc",
    requiredRulesHashLabel: "Mã quy tắc bắt buộc",
    rubricReadonly: "Khung tiêu chí chấm điểm (chỉ xem)",
    promptReadonly: "Hướng dẫn phản hồi AI (chỉ xem)",
    policyReadonly: "Nguyên tắc đánh giá (chỉ xem)",
    rulesReadonly: "Quy tắc bắt buộc (chỉ xem)",
    createFromThisSet: "Tạo bộ mới từ bộ này",
    compareWithOtherSet: "So sánh với bộ khác",
    rubricCompareLabel: "Khung tiêu chí",
    promptCompareLabel: "Hướng dẫn AI",
    policyCompareLabel: "Nguyên tắc",
    rulesCompareLabel: "Quy tắc bắt buộc",
    levelHelp: "Thấp: chấm nhanh, nhận xét ngắn. Vừa: cân bằng. Cao: chấm chặt hơn, yêu cầu bằng chứng rõ hơn.",
    openGuide: "Mở hướng dẫn",
    rubricHelp: "Xác định chấm những hạng mục nào và trọng số điểm tương ứng.",
    rubricCriteriaLabel: "Tiêu chí chấm điểm (cho tạo mới từ đầu)",
    criterionKeyPlaceholder: "key",
    criterionMaxPlaceholder: "max",
    criterionLabelViPlaceholder: "label vi",
    criterionLabelJaPlaceholder: "label ja",
    totalScorePrefix: "Tổng điểm: ",
    addCriterion: "+ Thêm tiêu chí",
    promptHelp: "Quy định cách AI diễn đạt nhận xét, cấu trúc phản hồi và trọng tâm phân tích.",
    policyHelp: "Quy định mức nghiêm ngặt khi chấm và cách trừ điểm theo thiếu sót.",
    rulesHelp: "Các ràng buộc bắt buộc AI luôn phải tuân thủ (ví dụ định dạng đầu ra).",
    setNameSummary: "Tên bộ",
    rulesWarning: "Lưu ý: Không nên sửa nội dung này vì đây là các quy tắc hệ thống bắt buộc đảm bảo tính ổn định của kết quả AI.",
  },
  en: {
    loading: "Loading AI Configuration Console...",
    loadFailed: "Failed to load configuration data",
    title: "AI Configuration Console",
    subtitle: "Manage evaluation sets efficiently with a unified interface.",
    modeNote: "Evaluation Set mode: Manage Rubric + Prompt + Policy + Required Rules as a single unit.",
    tabSets: "Evaluation Sets",
    tabCreate: "Create New Set",
    tabCompare: "Compare Sets",
    noActiveSetTooltip: "Create an initial set in the Evaluation Sets tab first.",
    sectionSetList: "Evaluation Sets List",
    sectionSetListSub: "View active/archived sets in the current scope. Select an item to see details.",
    noActiveSet: "No active Evaluation Set in this scope.",
    noActiveSetHelp: "Click \"Create first set\" to make grading ready.",
    createFromCurrent: "Create from current set",
    bootstrapScope: "Create first set",
    bootstrapping: "Bootstrapping...",
    searchPlaceholder: "Search by set name / version label",
    noSet: "No evaluation set found.",
    selected: "Selected",
    setDetail: "Set Detail",
    history: "History",
    selectFromList: "Select an Evaluation Set from the list.",
    compareTitle: "Compare Sets",
    compareSub: "Side-by-side comparison for audit purposes.",
    leftSet: "Left set",
    rightSet: "Right set",
    diff: "Highlight differences",
    changed: "changed",
    unchanged: "unchanged",
    createTitle: "Create New Evaluation Set",
    step: "Step",
    setName: "Set name",
    docType: "Document type",
    promptLevel: "Evaluation level",
    changeRubric: "Change Rubric",
    changePrompt: "Change Prompt",
    changePolicy: "Change Policy",
    changeRules: "Change Required Rules",
    noEffectiveChange: "No effective change. Existing versions will be reused.",
    cancel: "Cancel",
    review: "Review",
    back: "Back",
    saveArchived: "Save (Archived)",
    saveAndActivate: "Save and Activate",
    saving: "Saving...",
    reviewHint: "Only modified components will create new immutable versions.",
    newVersion: "Create new version",
    reuse: "Reuse existing",
    documentTypeLabel: "Document type",
    createSuccess: "Created and activated new Evaluation Set.",
    bootstrapSuccess: "Created first Evaluation Set.",
    createFailed: "Failed to create set",
    bootstrapFailed: "Failed to bootstrap first set",
    activationTitle: "Confirm Activation",
    activationDesc: "Activating this set will make it the default for new gradings. Previous results will not be affected.",
    quickGuideShow: "Quick guide",
    quickGuideHide: "Hide quick guide",
    showActiveOnly: "Show active only",
    showAllStatuses: "Show all statuses",
    rubricNotFound: "No rubric found for this document type.",
    promptRequired: "Prompt content is required.",
    policyRequired: "Policy content is required.",
    criteriaRequired: "Criteria definitions are required to create Rubric v1.",
    historyShowing: "Showing {shown}/{total} sets",
    createdAt: "Created at",
    hideDetail: "Hide details",
    showDetail: "View details",
    readOnlyNotice: "This set is read-only. To modify it, create a new set based on this one.",
    setNameLabel: "Set name",
    statusLabel: "Status",
    levelLabel: "Evaluation level",
    rubricLabel: "Rubric",
    promptLabel: "Prompt",
    policyLabel: "Policy",
    requiredRulesVersionLabel: "Required rules version",
    requiredRulesHashLabel: "Required rules hash",
    rubricReadonly: "Rubric (read-only)",
    promptReadonly: "Prompt (read-only)",
    policyReadonly: "Policy (read-only)",
    rulesReadonly: "Required rules (read-only)",
    createFromThisSet: "Create new set from this",
    compareWithOtherSet: "Compare with another set",
    rubricCompareLabel: "Rubric",
    promptCompareLabel: "Prompt",
    policyCompareLabel: "Policy",
    rulesCompareLabel: "Required rules",
    levelHelp: "Low: fast/short feedback. Medium: balanced. High: strict/detailed evidence required.",
    openGuide: "Open guide",
    rubricHelp: "Define grading criteria and weights.",
    rubricCriteriaLabel: "Rubric criteria (for new sets)",
    criterionKeyPlaceholder: "key",
    criterionMaxPlaceholder: "max",
    criterionLabelViPlaceholder: "label (vi)",
    criterionLabelJaPlaceholder: "label (ja)",
    totalScorePrefix: "Total score: ",
    addCriterion: "+ Add criterion",
    promptHelp: "Define AI tone, response structure, and analysis focus.",
    policyHelp: "Define strictness levels and point deduction rules.",
    rulesHelp: "Mandatory system constraints for AI output.",
    setNameSummary: "Set Name",
    rulesWarning: "Warning: Changing this content is not recommended as these are mandatory system rules ensuring AI output stability.",
  },
};
