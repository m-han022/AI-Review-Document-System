# Evaluation Baseline Final Spec

## 1. Muc tieu

Tai lieu nay la baseline chot de mo rong he thong AI review tai lieu theo huong:

- de dung voi user thuong
- de van hanh voi admin / PMO
- de audit va rollback
- de mo rong ve sau ma khong pha vo flow hien tai

He thong phuc vu 3 muc tieu chinh:

1. Cai thien chat luong tai lieu
2. Ho tro quality gate / chot release
3. Dua ra canh bao rui ro dua tren boi canh thong tin du an

## 2. Nguyen tac cot loi

1. UI user phai don gian hon kien truc backend
2. User khong phai hieu `Rubric / Prompt / Policy`
3. Admin khong cau hinh tu so 0 cho moi truong hop
4. Moi thay doi phai versioned, auditable, rollback duoc
5. Risk warning chi duoc dua tren du lieu that va phai co bang chung
6. Khong mo rong bang cach nhung ngoai le vao ten hoac logic cu

## 3. Mo hinh baseline

Khong quan ly theo:

```text
document_type -> evaluation set
```

Quan ly theo:

```text
(document_type, strictness) -> active evaluation bundle
```

Trong do:

- `document_type`: loai tai lieu
- `strictness`: muc danh gia `low | medium | high`
- `active evaluation bundle`: bo cau hinh AI thuc te dang duoc su dung

Day la baseline toi gian, de van hanh, de hieu, va du de mo rong sau nay.

## 4. Scope va mo rong scope

### 4.1. Scope baseline

Moi scope la:

```text
(document_type, strictness)
```

Moi scope chi co `1 active bundle` tai mot thoi diem.

### 4.2. Nguyen tac mo rong `Loai tai lieu`

`document_type` la master data va la truc mo rong nghiep vu chinh.

Moi `document_type` nen co:

- `code`
- `name`
- `description`
- `status`

Khong duoc encode ngoai le nghiep vu vao ten `document_type`.

Khong dung:

```text
BRD_Banking_High
Proposal_Japan_Strict
```

Neu can bieu dien them nghiep vu, phai mo rong scope hoac runtime context, khong nhan ban `document_type`.

### 4.3. Nguyen tac mo rong `Muc danh gia`

`strictness` la truc mo rong cuong do danh gia, khong phai truc mo rong nghiep vu chinh.

Baseline giu:

- `low`
- `medium`
- `high`

Co the doi nhan hien thi trong UI thanh:

- `Co ban`
- `Tieu chuan`
- `Nghiem ngat`

Chi mo rong `strictness` khi co nhu cau van hanh ro rang. Uu tien them metadata vao tung muc truoc khi tao them muc moi.

### 4.4. Huong mo rong tuong lai

Khi can, he thong co the tang tu:

```text
(document_type, strictness)
```

len:

```text
(document_type, objective, context_profile, strictness)
```

Nhung backend nen mo rong truoc, UI user thuong chi expose sau khi can thiet.

## 5. Kien truc cau hinh

He thong tach thanh 3 lop:

### 5.1. Global defaults

Dung chung toan he thong:

- `Required Rules`
- `Output Schema`
- `Policy presets`

Baseline:

- 1 `Required Rules` default
- 1 `Output Schema` default
- 3 `Policy presets`: `Low`, `Medium`, `High`

### 5.2. Document templates

Dung theo loai tai lieu:

- `Rubric base` theo `document_type`
- `Prompt base` theo `document_type`

### 5.3. Scope bundle

Bundle la to hop tu:

```text
Shared components + document-specific components
```

Shared:

- Required Rules
- Output Schema
- Policy presets

Document-specific:

- Rubric theo loai tai lieu
- Prompt theo loai tai lieu

## 6. Evaluation bundle

Bundle la artifact versioned, immutable, va la cau hinh AI thuc te dung luc runtime.

### 6.1. Cau truc backend

- `bundle_id`
- `scope_id`
- `rubric_version_id`
- `prompt_version_id`
- `policy_version_id`
- `required_rules_version_id`
- `output_schema_version_id`
- `status`
- `validation_status`
- `change_note`
- `created_by`
- `approved_by`
- `activated_by`
- `created_at`
- `approved_at`
- `activated_at`

### 6.2. Truong admin can thao tac

Admin chi nen chon:

- `Loai tai lieu`
- `Muc danh gia`
- `Rubric`
- `Prompt`
- `Policy`
- `Ghi chu thay doi`

He thong tu quan ly:

- `Bundle ID`
- `Required Rules`
- `Output Schema`
- `Validation Status`
- audit metadata

## 7. Vai tro va quyen

### 7.1. User thuong

User duoc:

- chon `Project`
- chon `Loai tai lieu`
- chon `Muc danh gia`
- upload va bat dau review
- xem `Bo tieu chuan dang ap dung` o dang read-only
- xem ket qua review va canh bao rui ro

User khong duoc:

- chon truc tiep `Rubric / Prompt / Policy`
- sua bundle

### 7.2. Admin / PMO

Admin duoc:

- quan ly mapping `scope -> active bundle`
- clone bundle hien tai
- chon `Rubric / Prompt / Policy`
- validate
- approve / activate
- archive bundle cu

## 8. UX baseline

### 8.1. UI user

UI user thuong chi nen hien:

- `Loai tai lieu`
- `Muc danh gia`
- `Bo tieu chuan dang ap dung`
- `Ket qua review`
- `Canh bao rui ro`

### 8.2. UI admin

UI admin nen co:

- man danh sach `Loai tai lieu / Muc danh gia / Bundle active / Trang thai`
- man chi tiet bundle
- action `Clone / Validate / Activate`

### 8.3. Nguyen tac UX

1. mot man hinh chi nen phuc vu mot quyet dinh chinh
2. UI user dung ngon ngu nghiep vu
3. UI admin minh bach trang thai, version, va audit
4. khong hien thi `AI confidence` hay `risk score` neu khong co nguon du lieu that

## 9. Rang buoc giua evaluation components va UI/UX

### 9.1. Rang buoc nghiep vu

UI phai phan anh dung logic dang chay.

Neu backend resolve theo `document_type + strictness`, UI phai cho user thay hoac chon dung 2 truong nay va phai hien thi ro `Bo tieu chuan dang ap dung`.

### 9.2. Muc do rang buoc

`Rubric` anh huong den:

- ten tieu chi
- so luong tieu chi
- cau truc breakdown score

`Prompt` anh huong den:

- wording cua feedback
- muc do chi tiet cua nhan xet

`Policy` anh huong den:

- cach dien giai muc danh gia
- severity / nguong quyet dinh

`Output Schema` la rang buoc ky thuat manh nhat voi UI/backend vi anh huong den:

- parser
- renderer
- export
- dashboard

### 9.3. Nguyen tac

1. UI khong duoc hardcode tieu chi trai voi rubric active
2. user thuong khong can thay chi tiet `Rubric / Prompt / Policy`
3. admin phai thay duoc component active, version, validation, audit metadata
4. moi thay doi `Rubric / Prompt / Policy / Output Schema` phai check tac dong UI truoc khi activate

## 10. Luong thay doi bundle

Khong sua truc tiep bundle active.

Luong chuan:

```text
Clone -> Edit -> Validate -> Activate
```

Nguyen tac:

1. moi scope chi co 1 bundle active
2. bundle la immutable
3. moi thay doi di qua version moi
4. grading run phai luu bundle thuc te da dung

## 11. Decision model

He thong review phai ho tro quyet dinh van hanh, khong chi tra diem.

### 11.1. Trang thai quyet dinh

- `pass`
- `conditional_pass`
- `fail`
- `needs_human_review`

### 11.2. Y nghia

`pass`

- du dieu kien di tiep

`conditional_pass`

- du dieu kien di tiep nhung co dieu kien can xu ly

`fail`

- chua du dieu kien di tiep

`needs_human_review`

- AI khong du can cu de ket luan an toan
- hoac co risk / conflict can nguoi co tham quyen quyet dinh

### 11.2.1. Rule xep trang thai baseline

Neu chua co rule rieng theo bundle/policy, he thong nen ap dung default decision rule sau:

1. `needs_human_review` neu:
   - co `critical` risk warning
   - extraction confidence thap
   - evidence strength khong du de ket luan
   - output co xung dot logic lon
2. `fail` neu:
   - co `high` risk warning khong duoc mitigation
   - hoac score duoi nguong fail cua policy
3. `conditional_pass` neu:
   - dat nguong toi thieu de di tiep
   - nhung con warning hoac gap can xu ly
4. `pass` neu:
   - khong co warning chan workflow
   - score dat nguong policy
   - khong can human intervention

Policy co the override rule nay, nhung moi policy override phai duoc dinh nghia ro va audit duoc.

### 11.3. Nguyen tac

1. quyet dinh cuoi cung thuoc ve nghiep vu
2. neu khong du du lieu, uu tien `needs_human_review`
3. UI phai hien thi ro ket qua va hanh dong tiep theo

## 12. Project-context risk warnings

He thong duoc phep canh bao rui ro dua tren boi canh thong tin du an, nhung phai co ky luat chat.

### 12.1. Project context baseline

- `project_description`
- `project_domain`
- `project_phase`
- `target_milestone`
- `known_constraints`
- `known_dependencies`
- `criticality_level`

### 12.2. Severity baseline

- `low`
- `medium`
- `high`
- `critical`

### 12.3. Evidence model

Moi warning nen co:

- `source_type`
- `source_reference`
- `evidence_text`
- `evidence_strength`

`source_type`:

- `document`
- `project_context`
- `rule`

`evidence_strength`:

- `weak`
- `medium`
- `strong`

### 12.4. Output model

Moi warning nen co:

- `title`
- `severity`
- `reason`
- `evidence`
- `recommended_action`

### 12.5. Nguyen tac

1. chi canh bao khi co bang chung
2. khong tao `AI confidence score` gia
3. khong tao `risk score` gia
4. warning severity cao phai co evidence manh hon
5. neu khong du thong tin, phai tra ve `Khong du thong tin de ket luan` hoac `needs_human_review`

## 13. Human review va override

AI la cong cu ho tro, khong thay the quyet dinh nghiep vu cuoi cung.

### 13.1. Truong hop can human review

1. ket qua la `needs_human_review`
2. co `critical` risk warning
3. evidence khong du manh
4. project thuoc nhom nhay cam / governance chat

### 13.2. Override model

Neu co override, phai luu:

- `override_decision`
- `override_reason_code`
- `override_comment`
- `override_by`
- `override_at`

### 13.3. Nguyen tac

1. override phai co ly do
2. khong overwrite ket qua AI goc
3. override la mot lop audit bo sung
4. metrics cuoi cung nen phan biet:
   - `ai_decision`
   - `final_decision_after_override`

## 14. Activation governance

### 14.1. Trang thai bundle de xuat

- `draft`
- `validated`
- `approved`
- `active`
- `archived`

### 14.2. Governance

Nen tach ro:

- nguoi tao draft
- nguoi validate
- nguoi approve
- nguoi activate

Neu can governance chat, uu tien 4-mat:

1. nguoi tao khong phai nguoi approve cuoi
2. activate phai co audit trail ro rang

### 14.3. Activate behavior

Can chot ro:

1. activate co hieu luc ngay hay theo `effective_from`
2. rollback se quay ve bundle nao
3. activate co can refresh cache / metadata khong

## 15. Fallback va failure behavior

### 15.1. Khong resolve duoc bundle

- thong bao ro rang cho user/admin
- khong review trong che do mo ho
- log su kien governance

### 15.2. Output sai schema

- mark run la `failed` hoac `needs_human_review` theo policy
- khong render nhu mot ket qua hop le

### 15.3. Thieu project context

- van co the review tai lieu
- risk warning giam pham vi
- UI phai biet context khong day du

### 15.4. Prompt/rubric/policy conflict

- fail o buoc validate
- khong cho activate

### 15.5. Model timeout / loi AI

- retry theo policy he thong
- neu that bai cuoi cung thi luu error va giu audit

### 15.6. Nguyen tac

1. khong silently fallback theo cach gay hieu nham
2. fallback quan trong phai co log va audit
3. neu khong an toan de ket luan, uu tien `needs_human_review`

## 16. Runtime flow

```text
User chon project
-> User chon document_type
-> User chon strictness
-> He thong resolve active bundle
-> He thong nap project context + document content
-> AI thuc hien review
-> He thong luu bundle_id vao grading run
-> He thong tra ve document assessment + risk warnings + decision
```

## 17. Design system va implementation governance

### 17.1. Nguon su that

1. `Spec` la nguon su that nghiep vu
2. `Code` la nguon su that thuc thi
3. `UI text / design tokens` la nguon su that hien thi
4. `Slides / demo` chi la artifact dien giai

Chuoi thay doi:

```text
Spec -> API/Data contract -> UI/UX -> Code -> Docs/Slides
```

### 17.2. Thuat ngu thong nhat

- `document_type` = `Loai tai lieu`
- `strictness` = `Muc danh gia`
- `evaluation bundle` = `Bo tieu chuan danh gia`
- `rubric` = `Khung tieu chi danh gia`
- `prompt` = `Huong dan phan hoi AI`
- `policy` = `Nguyen tac danh gia`
- `risk warnings` = `Canh bao rui ro`

### 17.3. Design system

1. mau sac phai di qua design tokens
2. typography phai thong nhat
3. spacing phai theo scale co dinh
4. card, badge, table, form control phai dung component chuan

### 17.4. Semantic colors

Phai co mapping nhat quan cho:

- `success`
- `warning`
- `danger`
- `info`
- `neutral`

Va phai ap dung nhat quan cho:

- `Active`
- `Draft`
- `Archived`
- `Passed`
- `Failed`
- `High risk`
- `Medium risk`
- `Low risk`

### 17.5. Components nen chuan hoa

- `StatusBadge`
- `SeverityBadge`
- `ScopeChip`
- `BundleCard`
- `ReviewSummary`
- `RiskWarningCard`
- `ValidationState`
- `CompareTable`

### 17.6. Change gate

Truoc khi activate thay doi lien quan den `Rubric / Prompt / Policy / Output Schema / UI`, phai tra loi:

1. doi spec nao
2. doi API/data contract nao
3. doi UI rendering nao
4. doi i18n/text nao
5. doi export/dashboard nao
6. co can migrate du lieu khong
7. co anh huong backward compatibility khong

## 18. Metrics va success criteria

### 18.1. Metrics van hanh

- review latency
- queue delay
- grading failure rate
- schema parse failure rate
- retry rate

### 18.2. Metrics nghiep vu

- ty le `pass / conditional_pass / fail / needs_human_review`
- ty le human override
- ty le false positive risk warning
- ty le rollback bundle activation

### 18.3. Metrics adoption

- ty le project dung baseline moi
- ty le admin di dung quy trinh `Clone / Validate / Activate`
- ty le user hoan thanh flow ma khong can ho tro thu cong

### 18.4. Nguyen tac

1. metrics phai map ve API, event, hoac state that
2. khong invent KPI neu chua co nguon du lieu
3. success criteria nen duoc chot truoc rollout rong

## 19. Organizational learning va knowledge rollout

Ngoai review va audit, he thong nen co them mot lop `Learning & Knowledge Rollout` de tong hop va chia se tri thuc tot ra toan cong ty.

Lop nay phuc vu 2 luong rieng:

1. hoc tu `review result`
2. hoc tu `document content` tot trong tai lieu input

### 19.1. Learning case tu review result

Can mot thuc the `Learning Case` rieng, khong chi dung raw grading run.

Moi `Learning Case` co the gom:

- `case_id`
- `title`
- `source_project_id`
- `source_document_id`
- `source_version_id`
- `source_grading_run_id`
- `case_type`
- `summary`
- `what_went_well`
- `what_went_wrong`
- `why_it_matters`
- `recommended_reuse`
- `tags`
- `visibility_scope`
- `approved_by`
- `published_at`

`case_type` baseline:

- `best_practice`
- `common_issue`
- `risk_pattern`
- `improvement_example`
- `release_readiness_case`

### 19.2. Monthly curation flow

Khong nen de AI tu publish.

Luong baseline:

```text
Review result
-> Learning candidates
-> Human curation
-> Approve
-> Publish
```

Trang thai baseline:

- `candidate`
- `reviewing`
- `approved`
- `published`
- `archived`

Nguyen tac bo sung:

1. learning candidate phai duoc sensitivity scan truoc khi vao danh sach curate
2. neu candidate co kha nang lo du lieu nhay cam, phai vao trang thai `reviewing` voi redaction bat buoc
3. candidate search/index khong duoc expose raw sensitive text truoc khi qua redaction gate

### 19.3. Dau ra phuc vu learning tu review

Ngoai `document_assessment` va `risk_warnings`, he thong nen co the sinh:

- `good_practices`
- `repeated_issues`
- `learning_candidates`
- `rollout_recommendations`

### 19.4. Monthly digest

He thong nen tong hop duoc theo thang:

- top best practices
- recurring issues
- top risk signals truoc release
- notable improvement cases
- rollout recommendations

### 19.5. Knowledge rollout

Sau khi duoc duyet, learning case co the duoc publish vao:

- `Learning Hub`
- monthly digest
- team sharing deck
- searchable knowledge base

## 20. Reference snippets va reusable patterns tu tai lieu input

Khong chi hoc tu ket qua review. He thong con nen hoc tu chinh noi dung tai lieu input neu noi dung do duoc viet tot va co gia tri tai su dung.

### 20.1. Nguon tri thuc tu document content

He thong nen co kha nang trich xuat:

- doan mo ta tot
- cau truc section tot
- cach viet ro rang
- cach mo ta dependency / assumption / risk tot
- cach trinh bay giup tai lieu de duyet va de trien khai

### 20.2. Reference snippet model

Can thuc the `Reference Snippet` rieng.

Moi snippet co the gom:

- `snippet_id`
- `source_project_id`
- `source_document_id`
- `source_version_id`
- `section_name`
- `snippet_text`
- `snippet_type`
- `why_good`
- `reuse_guidance`
- `sensitivity_level`
- `approved_by`
- `published_at`

`snippet_type` baseline:

- `good_requirement_statement`
- `good_risk_description`
- `good_dependency_mapping`
- `good_summary_structure`
- `good_test_case_pattern`

### 20.3. Reusable pattern model

Ngoai snippet text, he thong nen co the sinh `Reusable Pattern` o muc cau truc.

Vi du:

- executive summary pattern
- dependency mapping pattern
- risk section pattern
- acceptance criteria pattern
- BRD section structure pattern

### 20.4. Dau ra phuc vu snippet extraction

Runtime review co the bo sung:

- `reference_snippets`
- `reusable_patterns`
- `good_practices`
- `learning_candidates`

### 20.5. Nguyen tac chat luong

Moi snippet/pattern duoc chia se nen co:

1. `why_good`
2. `reuse_guidance`
3. `document_type` hoac `knowledge_area`
4. nguon goc tai lieu ro rang

Khong nen publish mot doan chi vi AI danh gia “hay” ma khong giai thich duoc vi sao co gia tri tai su dung.

### 20.6. Sensitive data control

Vi snippet duoc trich tu tai lieu that, bat buoc co:

- masking thong tin nhay cam
- review truoc khi publish
- `visibility_scope`
- `sensitivity_level`

Nguyen tac bo sung:

1. redaction phai xuat hien tu luc tao candidate, khong chi luc publish
2. raw snippet text neu nhay cam chi duoc xem boi vai tro co quyen
3. index/search default nen dung ban da redacted
4. audit log van phai giu du thong tin ve viec redaction da xay ra

### 20.7. Luong baseline cho snippet learning

```text
Document input
-> AI extract good snippets / reusable patterns
-> Create learning candidates
-> Human curation
-> Approve
-> Publish to snippet library / knowledge base
```

## 21. Knowledge taxonomy va impact tracking

De rollout tri thuc ngang toan cong ty, case va snippet phai duoc phan loai va theo doi hieu qua.

### 21.1. Knowledge taxonomy baseline

Nen phan loai theo:

- `document_type`
- `department`
- `domain`
- `project_phase`
- `risk_category`
- `knowledge_area`

### 21.2. Knowledge output libraries

Nen co it nhat 2 kho:

1. `Case Learning Library`
2. `Snippet / Pattern Library`

### 21.3. Impact tracking

Can theo doi:

- case/snippet nao duoc tai su dung
- recurring issue co giam sau khi publish learning khong
- best practice nao nen cap nhat vao rubric/prompt/policy
- team nao ap dung learning nhieu nhat

## 22. Universal input model va content normalization principles

Neu he thong can mo rong trong tuong lai de ho tro khong chi `pdf` va `ppt`, ma toan bo loai du lieu, thi phai doi tu duy tu `review file` sang `review normalized content from any source`.

### 22.1. Nguyen tac tong quat

Khong nen coi input chi la file office. Input phai duoc coi la `content source` hoac `review asset`.

He thong nen di theo flow:

```text
Input source
-> extraction / normalization
-> canonical content model
-> review / risk / learning / snippet extraction
```

### 22.2. Tach `document_type` va `input_source_type`

Hai khai niem nay phai tach rieng:

- `document_type`: loai tai lieu nghiep vu
- `input_source_type`: nguon du lieu / kieu ky thuat cua input

Vi du:

```text
document_type = BRD
input_source_type = file_docx
```

Khong dung:

```text
document_type = BRD_DOCX
```

### 22.3. Input source types baseline

Nen mo hinh hoa duoc cac nguon:

- `file_pdf`
- `file_pptx`
- `file_docx`
- `file_xlsx`
- `url_page`
- `wiki_page`
- `ticket`
- `email_thread`
- `meeting_transcript`
- `json_payload`
- `plain_text`
- `image_ocr`
- `sharepoint_document`
- `network_file_server`
- `internal_repository_reference`

### 22.4. Canonical content model

Moi input sau khi extract nen duoc dua ve mot mo hinh noi dung chung, toi thieu co:

- `title`
- `language`
- `sections`
- `plain_text`
- `structured_fields`
- `tables`
- `attachments`
- `metadata`
- `source_references`

AI review nen danh gia tren lop canonical nay, khong danh gia truc tiep tung format thap.

### 22.5. Adapter / plugin principle

Moi loai input nen co adapter hoac extractor rieng.

Vi du:

- `PDF adapter`
- `PPTX adapter`
- `DOCX adapter`
- `XLSX adapter`
- `Web page adapter`
- `Ticket adapter`
- `Wiki adapter`
- `OCR adapter`

Moi adapter co trach nhiem:

1. doc input
2. extract noi dung
3. normalize ve canonical model
4. tra metadata ve chat luong extraction

### 22.6. Extraction quality model

Vi chat luong extract se khac nhau giua cac loai du lieu, can luu them:

- `extraction_status`
- `extraction_method`
- `extraction_confidence`
- `normalization_warnings`
- `missing_sections_detected`

Nguyen tac:

1. AI phai biet chat luong extraction truoc khi ket luan manh
2. neu extraction confidence thap, co the can `needs_human_review`
3. UI nen biet input nao dang duoc review tren du lieu khong day du hoac confidence thap

### 22.7. Structured vs unstructured content

He thong nen phan biet:

#### a. Unstructured content

- pdf
- docx
- pptx
- plain text
- webpage

#### b. Semi-structured content

- wiki page
- ticket
- email thread

#### c. Structured content

- xlsx
- json
- form submission
- table exports

Tuy loai noi dung, strategy review co the khac nhau:

- review theo section
- review theo fields
- review theo records
- review theo tables

### 22.8. Bundle va input source

Baseline van giu:

```text
(document_type, strictness) -> active bundle
```

`input_source_type` nen duoc dua vao runtime context truoc, khong nen dua ngay vao scope baseline.

Chi khi extraction va logic danh gia khac biet dang ke moi xem xet mo rong scope hoac policy theo input profile.

### 22.9. Snippet extraction cho nhieu loai input

Khi mo rong input, `reference snippets` cung phai mo rong theo.

Khong chi co:

- `text snippet`

Ma con co the co:

- `table snippet`
- `field pattern`
- `conversation excerpt`

### 22.10. Nguyen tac mo rong input

1. khong rang buoc he thong vao dinh dang file cu the
2. luon tach `document_type` va `input_source_type`
3. moi input phai normalize ve canonical content model
4. adapter/extractor nen theo plugin pattern
5. AI review phai nhan duoc metadata ve chat luong extraction
6. mo rong input type khong duoc pha vo bundle model hien tai

### 22.11. External source reading principles

Tuong lai he thong khong chi doc input tu upload thu cong, ma con co the doc tu nguon ben ngoai duoc chi dinh nhu:

- SharePoint
- network file server
- document repository noi bo
- he thong quan ly tai lieu khac

Nguyen tac:

1. xem nguon ngoai la `source reference`, khong mac dinh la file da duoc dua vao he thong
2. moi lan review tu nguon ngoai phai luu du:
   - `source_locator`
   - `source_version_hint`
   - `retrieved_at`
   - `retrieved_by`
   - `retrieval_status`
3. he thong phai biet dang review:
   - ban sao da snapshot
   - hay ban doc truc tiep tu nguon ngoai
4. neu khong snapshot, phai canh bao rui ro audit vi nguon ngoai co the thay doi
5. neu co snapshot, snapshot do phai tro thanh mot phan cua audit trail

### 22.12. Snapshot va audit rule

Khi doc tu nguon ngoai, nen uu tien mot trong 2 che do:

#### a. Snapshot-first

- he thong lay noi dung tai thoi diem review
- luu immutable snapshot hoac canonical snapshot co the replay duoc
- luu hash cua snapshot va normalized content metadata
- review chay tren snapshot do

#### b. Reference-only

- he thong chi luu tham chieu den nguon ngoai
- chi nen dung cho use case low-risk hoac exploratory

Baseline khuyen nghi:

- voi review chinh thuc, uu tien `snapshot-first`
- voi preview / exploratory reading, co the cho phep `reference-only`

Rule bat buoc:

1. review chinh thuc phai replay duoc
2. chi luu `hash + metadata` ma khong co snapshot replayable la khong du cho audit manh
3. neu dung `reference-only`, UI va audit phai danh dau ro day khong phai review replayable

### 22.13. External connector governance

Moi ket noi nguon ngoai phai co governance rieng:

1. connector nao duoc phep dung
2. ai duoc phep cau hinh connector
3. ai duoc phep review du lieu tu connector do
4. source path / site / folder nao duoc phep doc
5. co can filter theo project / business unit / sensitivity level khong

Khong nen cho backend doc tu moi source ngoai mot cach tu do, khong gioi han path va permission.

### 22.14. Permission va security model

Khi doc tu nguon ngoai, can chot ro:

1. dung account he thong hay account nguoi dung
2. co can delegated access khong
3. co log du action read khong
4. du lieu doc ve co duoc cache khong
5. cache giu bao lau
6. co can masking / classification truoc khi dua vao review khong

Neu khong chot phan nay, viec mo rong sang SharePoint hoac file server se tao lo hong audit va bao mat.

### 22.15. External source reliability model

Nguon ngoai can co metadata van hanh rieng:

- `retrieval_latency`
- `connector_status`
- `last_successful_sync`
- `source_availability`
- `staleness_indicator`

Neu nguon ngoai cham, loi, hoac stale, UI va backend phai biet de tranh review tren du lieu khong dang tin.

### 22.16. UI/UX cho external sources

Frontend ve lau dai nen phan biet:

- upload file
- nhap URL
- chon nguon ngoai

Neu la nguon ngoai, UI nen hien thi them:

- ten nguon
- duong dan / locator
- trang thai ket noi
- thoi diem lay du lieu
- review dang dung snapshot hay direct reference

User thuong khong can thay toan bo metadata ky thuat, nhung phai biet du lieu dang den tu dau va co dang tin khong.

## 23. Frontend expansion considerations

Neu input khong con gioi han o `pdf/ppt`, frontend phai duoc thiet ke lai theo huong `source-aware UX`, nhung van giu ngon ngu nghiep vu de user khong bi roi.

### 23.1. Upload / intake model

Frontend khong nen chi co mot man `upload file`.

Ve lau dai nen ho tro cac cach nap input:

- upload file
- paste text
- nhap URL
- chon source noi bo nhu wiki / ticket / email / transcript
- nap JSON hoac structured payload

### 23.2. UI fields nen tach ro

Frontend nen tach ro:

- `Loai tai lieu`
- `Muc danh gia`
- `Nguon du lieu` hoac `input_source_type`

User van nen thao tac theo nghiep vu truoc, sau do moi chon kieu source ky thuat neu can.

### 23.3. Dynamic input form

Tuy theo `input_source_type`, frontend co the can doi form:

- `file_pdf`, `file_docx`, `file_pptx`: upload file
- `url_page`, `wiki_page`: nhap URL
- `plain_text`: paste text
- `json_payload`: paste hoac upload JSON
- `ticket`, `email_thread`: nhap link, ID, hoac connector source

Nguyen tac:

1. form chi hien field can thiet cho source dang chon
2. khong bat user dien thong tin khong lien quan
3. van giu layout va terminology nhat quan

### 23.4. Viewer va preview model

Frontend can chuan bi tu duy preview theo nhieu loai source:

- document viewer cho file
- text preview cho plain text / transcript
- section preview cho wiki / webpage
- field/table preview cho JSON / XLSX / structured data

Nguyen tac:

1. preview phai dua tren canonical content hoac extraction result
2. khong phu thuoc hoan toan vao viewer goc cua tung format
3. neu preview khong day du, phai thong bao ro muc do extraction

### 23.5. UX voi extraction quality

Frontend nen biet va hien thi duoc:

- `extraction_status`
- `extraction_confidence`
- `normalization_warnings`

Nhung chi hien thi o muc phu hop:

- user thuong: canh bao de hieu
- admin: metadata chi tiet hon

## 24. Backend expansion considerations

Backend can duoc mo rong tu `file processing service` thanh `multi-source content processing pipeline`.

### 24.1. API contract direction

API intake ve lau dai nen ho tro:

- file binary
- file URL
- plain text
- structured payload
- external source reference

Nen co mot contract intake tong quat, vi du:

- `document_type`
- `strictness`
- `input_source_type`
- `source_payload`
- `project_context`

Trong do `source_payload` thay doi theo tung source type.

### 24.2. Processing pipeline

Backend nen tach thanh cac buoc ro:

1. intake validation
2. source extraction
3. normalization
4. extraction quality assessment
5. review execution
6. learning/snippet extraction
7. persistence va audit

### 24.3. Service boundaries

Nen tach ro:

- source adapter / extractor
- canonical normalizer
- review engine
- risk engine
- learning extraction engine
- persistence / audit layer

Khong nen de mot service vua parse file, vua review, vua sinh knowledge artifact ma khong co boundary ro.

### 24.4. Persistence considerations

Backend nen luu duoc:

- source metadata
- normalized content metadata
- extraction quality metadata
- canonical references
- review output
- learning candidates
- reference snippets

### 24.5. Failure handling theo source

Vi moi source co rui ro rieng, backend can phan biet:

- source fetch failure
- parsing failure
- normalization failure
- schema failure
- review failure

Moi lop loi nen co status va audit trail rieng.

### 24.6. Replayability requirement

Voi moi review chinh thuc, backend nen co kha nang replay toi thieu tren:

- canonical content snapshot
- bundle da dung
- output schema version
- extraction metadata

Day la yeu cau bat buoc neu he thong huong toi audit manh va external source review.

## 25. UI/UX adaptation for multi-source inputs

Khi mo rong sang nhieu loai input, UI/UX khong nen chi “them field”, ma phai co cach thich nghi theo source ma van giu mot nguon trai nghiem chung.

### 25.1. Common UX shell

Bat ke source nao, user van nen thay chung:

- `Project`
- `Loai tai lieu`
- `Muc danh gia`
- `Nguon du lieu`
- `Bo tieu chuan dang ap dung`
- `Trang thai review`

### 25.2. Source-specific interaction

Phan khac biet chi nen nam o khu intake va preview.

Vi du:

- file source -> upload widget
- URL source -> URL fetch widget
- text source -> text editor
- structured source -> field/table mapper

### 25.3. Result rendering adaptation

Ket qua review co the can render khac theo source:

- text document -> section findings
- table data -> field/table findings
- conversation/transcript -> excerpt findings
- ticket/wiki -> field + narrative findings

Nhung van phai quy ve cung mot bo component tong quat:

- review summary
- risk warnings
- good practices
- snippets / reusable patterns

### 25.4. Snippet UX cho nhieu loai input

`Reference snippets` khong chi la text block.

UI nen san sang cho:

- text snippet
- table snippet
- field pattern
- conversation excerpt

Moi loai can co:

- source reference
- why_good
- reuse_guidance
- sensitivity indicator

### 25.5. Progressive disclosure

Nguyen tac UX bat buoc:

1. user thuong chi thay complexity khi can
2. metadata ky thuat chi mo rong cho admin hoac expert
3. expansion khong duoc lam mat tinh don gian cua flow co ban

## 26. Testing bat buoc

Toi thieu phai co:

1. contract test cho output schema
2. regression test cho active bundle resolution
3. UI rendering test cho trang thai chinh
4. test cho risk warning khi co / khong co project context
5. test cho permission user/admin
6. test cho decision model default
7. test cho `ai_decision` va `final_decision_after_override`
8. test cho adapter normalization theo tung input source type quan trong
9. test cho extraction-quality downgrade va `needs_human_review`
10. test cho snapshot-first / reference-only behavior
11. test cho connector permission boundary
12. test cho masking/redaction cua learning candidate va reference snippet

## 27. Migration strategy

Neu ap dung baseline nay vao he thong hien co:

1. khong pha flow cu ngay lap tuc
2. rollout theo phase hoac feature flag
3. du lieu cu van phai xem va audit duoc
4. record cu nen map toi thieu ve `default bundle` hoac `legacy bundle marker`

Huong migration de xuat:

1. xac dinh `document_type` hien co
2. map `strictness`, neu chua co thi default `medium`
3. tao `default bundle` cho cac scope hien co
4. rollout UI admin truoc, user sau

Rollback:

1. rollback scope/bundle khong duoc rewrite lich su
2. rollback UI khong duoc lam mat du lieu moi da tao

## 28. Future expansion principles

1. mo rong theo `dimension`, khong theo ngoai le
2. backend mo rong truoc, UI mo rong sau
3. luon giu backward compatibility
4. chi mo rong khi co ly do nghiep vu ro rang
5. uu tien theo thu tu:

```text
reuse -> clone -> extend -> create new
```

6. moi dimension moi phai qua governance gate
7. khong mo rong bang cach lam user thuong kho dung hon
8. moi kha niem moi phai duoc phan lop ro:
   - `master data`
   - `scope dimension`
   - `bundle component`
   - `runtime context`
   - `output artifact`
   - `UI-only metadata`
9. moi mo rong phai co `default path`
10. nen rollout theo 3 muc:
    - `latent`
    - `admin-only`
    - `user-facing`

## 29. Implementation roadmap

De trien khai baseline nay ma khong lam ngat quang he thong hien tai, nen di theo tung pha nho, giu flow cu van chay trong luc bo sung nang luc moi.

### 29.1. Nguyen tac rollout

1. khong thay the flow cu mot lan
2. moi pha phai co `default path`
3. chi expose UI moi sau khi backend contract da on dinh
4. moi pha phai co rollback point
5. uu tien rollout bang feature flag hoac controlled activation

### 29.2. Phase 1 - Governance foundation

Muc tieu:

- khoa business baseline
- khoa terminology
- khoa role model
- khoa design/governance rules

Deliverables:

- `EVALUATION_BASELINE_SPEC.md` duoc chot
- bang thuat ngu thong nhat
- semantic status / color / role definitions
- checklist `Clone -> Validate -> Activate`

Chua lam:

- chua doi runtime logic
- chua doi intake model

Dependency:

- khong co

Rollback:

- chi la rollback tai lieu/quyet dinh governance, khong tac dong runtime

### 29.3. Phase 2 - Scope and bundle foundation

Muc tieu:

- dua `scope -> active bundle` vao backend
- tach cau hinh danh gia khoi logic cu

Deliverables:

- model `scope`
- model `bundle`
- active bundle mapping
- default `Required Rules`
- default `Output Schema`
- admin co the map `Rubric / Prompt / Policy`

Dependency:

- Phase 1

Nguyen tac:

- flow cu van chay
- mapping moi phai co default path ve logic hien tai neu can

Rollback:

- co the tat active mapping moi va quay ve default mapping/legacy resolution

### 29.4. Phase 3 - Audit and runtime contract

Muc tieu:

- moi lan review phai truy vet duoc day du
- chot output contract

Deliverables:

- grading run luu `bundle_id`
- output schema contract
- decision model
- validation status
- fallback/error behavior baseline

Dependency:

- Phase 2

Rollback:

- giu du lieu moi da ghi
- UI van co the doc du lieu theo contract cu neu can

### 29.5. Phase 4 - UI baseline rollout

Muc tieu:

- dua UX moi vao van hanh ma khong lam user bi roi

Deliverables:

- UI user: `Loai tai lieu`, `Muc danh gia`, `Bo tieu chuan dang ap dung`
- UI admin: danh sach bundle, detail, clone/validate/activate
- role-based visibility

Dependency:

- Phase 2
- Phase 3

Nguyen tac:

- user flow cu duoc giu don gian
- complexity moi chi nam o admin UI

Rollback:

- feature flag cho admin UI moi
- user UI quay ve layout cu neu can

### 29.6. Phase 5 - Risk warning by project context

Muc tieu:

- tang gia tri van hanh ma chua phai doi input model lon

Deliverables:

- project context baseline
- severity/evidence model
- `risk_warnings`
- `needs_human_review`
- override flow

Dependency:

- Phase 3
- Phase 4

Rollback:

- tat block `risk_warnings`
- giu document review core van chay

### 29.7. Phase 6 - Learning from review result

Muc tieu:

- bien ket qua review thanh tri thuc to chuc

Deliverables:

- `learning_candidates`
- `learning_case`
- curation flow
- monthly digest
- learning library

Dependency:

- Phase 5 khuyen nghi, nhung co the tach rieng

Rollback:

- tat publishing flow
- giu review core khong anh huong

### 29.8. Phase 7 - Reference snippets and reusable patterns

Muc tieu:

- hoc tu noi dung tot trong tai lieu input

Deliverables:

- `reference_snippets`
- `reusable_patterns`
- `why_good`
- `reuse_guidance`
- masking / sensitivity flow

Dependency:

- Phase 6 khuyen nghi

Rollback:

- tat snippet publishing
- giu learning case tu review result neu da on dinh

### 29.9. Phase 8 - Universal input foundation

Muc tieu:

- doi tu duy tu `review file` sang `review normalized content`

Deliverables:

- `input_source_type`
- canonical content model
- extraction quality metadata
- adapter/plugin architecture

Dependency:

- Phase 3 bat buoc
- Phase 4 khuyen nghi

Nguyen tac:

- backend lam truoc
- chua can expose full multi-source UI ngay

Rollback:

- source type moi co the disable rieng
- upload file legacy van chay

### 29.10. Phase 9 - External source integration

Muc tieu:

- doc input tu SharePoint, file server, va external repositories co governance

Deliverables:

- external connector model
- source locator model
- snapshot-first mode
- retrieval audit metadata
- permission/security governance

Dependency:

- Phase 8

Nguyen tac:

- uu tien `snapshot-first`
- khong cho doc tu nguon ngoai tu do khong governance

Rollback:

- disable tung connector
- quay ve upload/snapshot flow thu cong

### 29.11. Phase priority summary

Neu can uu tien thuc dung, thu tu nen la:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8
9. Phase 9

### 29.12. Minimum safe foundation

Neu chua co du nguon luc, khong nen nhay thang vao learning layer hoac universal input.

Nen dam bao xong truoc:

1. governance foundation
2. scope + active bundle
3. audit/runtime contract
4. UI baseline

Day la nen tang toi thieu de cac pha sau khong pha vo he thong.

## 30. Ket luan

Baseline nay chot cach xay dung he thong review theo huong:

- UI user toi gian
- backend co governance va audit
- bundle versioned va activate an toan
- risk warning co can cu
- mo rong duoc ve sau ma khong pha vo trai nghiem co ban

Neu tuan thu dung baseline nay, he thong se giu duoc diem can bang tot giua:

- de dung
- de van hanh
- de kiem soat
- de mo rong
