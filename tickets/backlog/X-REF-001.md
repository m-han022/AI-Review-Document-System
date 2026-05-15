# X-REF-001 - Map Current Architecture And Dependency Hotspots

## Status

- Proposed

## Goal

Lập bản đồ structure hiện tại của backend/frontend và chỉ ra hotspot coupling lớn nhất để làm đầu vào cho các ticket refactor tiếp theo.

## Scope

- inventory module chính ở `backend/app`
- inventory module chính ở `frontend/src`
- xác định file/component/service lớn
- xác định dependency direction hiện tại
- ghi nhận seam có thể refactor an toàn

## Out Of Scope

- implement refactor runtime
- đổi file structure
- move module

## Current Problem

- project đã lớn, nhiều module có trách nhiệm chồng lấn
- chưa có architecture map ngắn gọn để biết nên cắt theo seam nào trước

## Target State

- có tài liệu ngắn về:
  - main modules
  - dependency hotspots
  - candidate low-risk seams

## Constraints

- không đổi behavior
- không đổi API
- không đổi schema

## Implementation Notes

- output có thể là markdown trong `tickets/backlog/` hoặc tài liệu phase
- ưu tiên practicality hơn là vẽ sơ đồ quá chi tiết

## Validation

- review chéo với root/module AGENTS
- xác nhận hotspot list phản ánh đúng code hiện tại

## Risk

- dễ phân tích quá rộng, thiếu tính hành động

## Rollback

- không cần rollback runtime vì đây là ticket phân tích

## Dependencies

- none

## Acceptance Criteria

- có danh sách module chính backend/frontend
- có tối thiểu 5 hotspot cụ thể
- có đề xuất seam cho phase 1/phase 2
