# Implementation Execution Checklist

## 1. Muc tieu

Checklist nay duoc tach ra tu `EVALUATION_BASELINE_SPEC.md` de doi dev, design, va PMO co the dung truc tiep trong qua trinh trien khai ma khong bo sot cac diem quan trong.

Nguyen tac:

1. khong thay flow cu mot lan
2. moi thay doi phai co owner
3. moi thay doi phai co rollback point
4. chi expose UI moi sau khi backend contract da on dinh

## 2. Roadmap matrix

| Phase | Muc tieu chinh | Owner chinh | Complexity | Dependency | Rollback |
| --- | --- | --- | --- | --- | --- |
| 1 | Governance foundation | PMO / Product / Design | Low | None | rollback tai lieu va quyet dinh governance |
| 2 | Scope + bundle foundation | Backend + PMO | High | Phase 1 | tat active mapping moi, quay ve legacy/default resolution |
| 3 | Runtime contract + audit | Backend + QA | High | Phase 2 | giu du lieu moi, quay ve renderer / contract cu neu can |
| 4 | UI baseline rollout | Frontend + Design | Medium | Phase 2, 3 | feature flag cho UI moi |
| 5 | Decision / risk / override | Backend + Frontend + PMO | Medium | Phase 3, 4 | tat block risk/override, giu review core |
| 6 | Learning case rollout | Backend + PMO | Medium | Phase 5 (khuyen nghi) | tat publishing flow |
| 7 | Reference snippets / patterns | Backend + Frontend + PMO | Medium | Phase 6 (khuyen nghi) | tat snippet/pattern publishing |
| 8 | Universal input foundation | Backend + Frontend + QA | High | Phase 3, 4 | disable source type moi, giu upload legacy |
| 9 | External source integration | Backend + Security + Frontend | High | Phase 8 | disable connector, quay ve upload/snapshot thu cong |

## 3. Gate 0 - Chot baseline

### PMO / Product

- [ ] Chot `EVALUATION_BASELINE_SPEC.md` la business baseline
- [ ] Chot bang thuat ngu thong nhat
- [ ] Chot scope baseline: `(document_type, strictness)`
- [ ] Chot role model: `user` / `admin` / `PMO`
- [ ] Chot decision model baseline

### Design

- [ ] Chot design tokens
- [ ] Chot semantic colors cho status va severity
- [ ] Chot component list bat buoc

### Engineering

- [ ] Chot output schema baseline
- [ ] Chot audit fields toi thieu
- [ ] Chot feature flag strategy

## 4. Gate 1 - Scope va bundle foundation

### Backend

- [ ] Tao model `scope`
- [ ] Tao model `bundle`
- [ ] Tao active bundle mapping
- [ ] Ho tro `Required Rules` default
- [ ] Ho tro `Output Schema` default
- [ ] Luu `bundle_id` vao grading run
- [ ] Co default path ve legacy resolution

### Frontend

- [ ] Hien thi `Loai tai lieu`
- [ ] Hien thi `Muc danh gia`
- [ ] Hien thi `Bo tieu chuan dang ap dung`

### PMO / Admin

- [ ] Xac dinh rubric/prompt/policy baseline cho tung scope ban dau
- [ ] Chot ai duoc tao / validate / approve / activate bundle

## 5. Gate 2 - Runtime contract va audit

### Backend

- [ ] Contract review output da co version ro
- [ ] Luu `ai_decision`
- [ ] Luu `final_decision_after_override` neu co
- [ ] Luu `validation_status`
- [ ] Luu `project_context` metadata can thiet
- [ ] Luu risk warning output theo schema

### Frontend

- [ ] UI doc duoc output schema moi
- [ ] UI khong hardcode tieu chi trai voi rubric active
- [ ] UI phan biet duoc `decision`, `risk_warning`, `review_summary`

### QA

- [ ] Contract test cho output schema
- [ ] Regression test cho bundle resolution
- [ ] Test fallback khi output schema sai

## 6. Gate 3 - UI baseline rollout

### User UI

- [ ] Flow user van don gian
- [ ] User khong phai chon `Rubric / Prompt / Policy`
- [ ] User thay `Bo tieu chuan dang ap dung`
- [ ] User thay canh bao khi context hoac extraction khong day du

### Admin UI

- [ ] Co man danh sach bundle
- [ ] Co man chi tiet bundle
- [ ] Co action `Clone`
- [ ] Co action `Validate`
- [ ] Co action `Activate`
- [ ] Co hien thi version, status, audit metadata

### Design

- [ ] Status badge dung semantic color dung chuan
- [ ] Severity badge dung semantic color dung chuan
- [ ] Typography / spacing / card pattern da thong nhat

## 7. Gate 4 - Decision, risk va override

### Backend

- [ ] Implement default decision rule
- [ ] Ho tro override model
- [ ] Ho tro severity model
- [ ] Ho tro evidence model
- [ ] Ho tro `needs_human_review`

### Frontend

- [ ] Hien thi `decision`
- [ ] Hien thi `recommended_action`
- [ ] Hien thi evidence o muc trust duoc
- [ ] Hien thi override state neu co

### PMO / Product

- [ ] Chot threshold `pass / conditional_pass / fail`
- [ ] Chot rule khi nao bat buoc human review
- [ ] Chot ai duoc override

### QA

- [ ] Test decision model default
- [ ] Test `ai_decision` vs `final_decision_after_override`
- [ ] Test severity/evidence rendering

## 8. Gate 5 - Learning case rollout

### Backend

- [ ] Tao `learning_candidates`
- [ ] Tao `learning_case`
- [ ] Luu source references day du
- [ ] Co status `candidate / reviewing / approved / published / archived`

### Frontend / Admin UI

- [ ] Co man curate learning candidates
- [ ] Co man publish learning case
- [ ] Co search/filter theo taxonomy

### PMO

- [ ] Chot monthly curation process
- [ ] Chot ai approve learning case
- [ ] Chot visibility scope

### Security / Governance

- [ ] Candidate duoc sensitivity scan
- [ ] Search/index khong lo raw sensitive text

## 9. Gate 6 - Reference snippets va reusable patterns

### Backend

- [ ] Tao `reference_snippets`
- [ ] Tao `reusable_patterns`
- [ ] Ho tro `why_good`
- [ ] Ho tro `reuse_guidance`
- [ ] Ho tro `sensitivity_level`

### Frontend

- [ ] Hien thi text snippet
- [ ] Hien thi table snippet neu co
- [ ] Hien thi field pattern neu co
- [ ] Hien thi source reference va sensitivity indicator

### PMO / Knowledge Owner

- [ ] Chot taxonomy snippet/pattern
- [ ] Chot quy trinh duyet snippet
- [ ] Chot chinh sach chia se noi bo

### QA

- [ ] Test masking / redaction ngay tu candidate stage
- [ ] Test snippet rendering cho nhieu loai source

## 10. Gate 7 - Universal input foundation

### Backend

- [ ] Them `input_source_type`
- [ ] Tao canonical content model
- [ ] Tach adapter / extractor / normalizer
- [ ] Luu extraction metadata
- [ ] Luu extraction confidence
- [ ] Ho tro `needs_human_review` khi extraction confidence thap

### Frontend

- [ ] Form intake phan biet upload / URL / text / structured input
- [ ] Preview theo source type
- [ ] Hien thi extraction warnings o muc phu hop

### QA

- [ ] Test adapter normalization cho tung source type quan trong
- [ ] Test extraction-quality downgrade
- [ ] Test UI preview khi du lieu khong day du

## 11. Gate 8 - External source integration

### Backend

- [ ] Ho tro `sharepoint_document`
- [ ] Ho tro `network_file_server`
- [ ] Ho tro `internal_repository_reference`
- [ ] Luu `source_locator`
- [ ] Luu `retrieved_at`
- [ ] Luu `retrieved_by`
- [ ] Luu `retrieval_status`
- [ ] Ho tro `snapshot-first`
- [ ] Danh dau `reference-only` khi ap dung
- [ ] Dam bao review chinh thuc replay duoc

### Frontend

- [ ] UI phan biet upload va external source
- [ ] Hien thi connector/source info
- [ ] Hien thi snapshot vs direct reference
- [ ] Hien thi source reliability neu can

### Security / Governance

- [ ] Chot ai duoc cau hinh connector
- [ ] Chot connector nao duoc phep dung
- [ ] Chot path/site/folder duoc doc
- [ ] Chot caching / masking / classification rule

### QA

- [ ] Test snapshot-first / reference-only behavior
- [ ] Test connector permission boundary
- [ ] Test replayability cua review chinh thuc

## 12. Cross-cutting checks

### Moi thay doi lien quan den evaluation

- [ ] Da doi spec chua
- [ ] Da doi API/data contract chua
- [ ] Da doi UI rendering chua
- [ ] Da doi i18n/text chua
- [ ] Da doi export/dashboard chua
- [ ] Da danh gia backward compatibility chua
- [ ] Da xac dinh rollback point chua

### Moi thay doi lien quan den knowledge sharing

- [ ] Da sensitivity scan chua
- [ ] Da redaction chua
- [ ] Da xac dinh visibility scope chua
- [ ] Da xac dinh owner duyet chua

### Moi thay doi lien quan den external input

- [ ] Da xac dinh source type chua
- [ ] Da co adapter/normalizer chua
- [ ] Da co extraction metadata chua
- [ ] Da co snapshot/replay rule chua

## 13. Minimum safe release

Khong nen rollout rong neu chua dat du cac diem sau:

- [ ] Scope + bundle foundation on dinh
- [ ] Runtime contract on dinh
- [ ] UI baseline on dinh
- [ ] Decision/risk/override on dinh
- [ ] Mandatory tests pass
- [ ] Rollback path da duoc dien tap

## 14. Owner matrix

- [ ] Product/PMO owner ro cho baseline nghiep vu
- [ ] Backend owner ro cho bundle, contract, adapter, audit
- [ ] Frontend owner ro cho intake, preview, rendering, admin UI
- [ ] Design owner ro cho tokens, components, semantic colors
- [ ] Security/governance owner ro cho external source va redaction
- [ ] QA owner ro cho regression va contract coverage
