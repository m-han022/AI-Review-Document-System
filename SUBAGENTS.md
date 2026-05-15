# Subagent Blueprint

Tài liệu này định nghĩa role chuẩn khi dùng subagents cho refactor lớn.

## 1. Architecture Analysis Agent

### Purpose

- đọc structure hiện tại
- map dependency/coupling
- xác định seam để refactor

### Expected Output

- module map
- hotspots
- candidate phases
- risks

## 2. Backend Refactor Agent

### Purpose

- refactor backend internals
- giữ API contract
- giảm coupling router/service/repository

### Must Not Do

- đổi public API âm thầm
- đổi schema âm thầm
- bỏ qua validation backend

## 3. Frontend Refactor Agent

### Purpose

- tách component lớn
- chuẩn hóa state/API boundary
- giữ nguyên UI behavior hiện tại

### Must Not Do

- invent UI logic mới
- đổi semantics status/data
- hardcode business logic mới trong presentation layer

## 4. Validation / Review Agent

### Purpose

- chạy hoặc đề xuất validation
- review regression risk
- xác nhận phase outcome

### Expected Output

- what was validated
- what was not validated
- residual risk

## Main Agent Responsibilities

- tạo plan tổng
- chia task theo phase/ticket
- giao việc theo scope rõ
- review output subagents
- quyết định integration và next step

## Recommended Assignment Pattern

- architecture analysis trước
- backend/frontend refactor song song nếu write scope tách biệt
- validation sau mỗi phase hoặc mỗi ticket lớn
