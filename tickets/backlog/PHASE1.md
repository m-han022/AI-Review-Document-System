# Phase 1 - Mapping And Low-Risk Extraction

## Goal

Tạo nền an toàn cho refactor bằng cách:

- map structure hiện tại
- xác định hotspot coupling
- chuẩn hóa một số seam nhỏ, ít rủi ro
- chưa thay đổi public API
- chưa thay đổi behavior nghiệp vụ

## Scope

- phân tích dependency
- tách helper/resolver/view-model nhỏ
- giảm responsibility overlap ở một số module lớn
- chuẩn hóa validation matrix cho các ticket sau

## Out Of Scope

- rewrite clean architecture toàn bộ
- đổi public API
- đổi DB schema
- rename/move package lớn hàng loạt
- đổi UI/UX behavior ngoài các cải tiến hiển thị phụ trợ đã được kiểm soát

## Exit Criteria

- có architecture map cơ bản
- có hotspot list rõ ràng
- có tối thiểu 2-3 ticket low-risk hoàn thành
- có validation matrix cho backend/frontend
- có ticket phase 2 được chuẩn bị dựa trên kết quả phase 1

## Initial Ticket Set

- `X-REF-001`
- `X-REF-002`
- `BE-REF-001`
- `BE-REF-002`
- `FE-REF-001`
- `FE-REF-002`

## Risks

- hiểu sai seam thực tế của legacy code
- low-risk extraction chạm vào shared state nhiều hơn dự kiến
- thiếu test coverage ở một số khu vực khiến refactor nhỏ vẫn có regression risk

## Validation

- review architecture output
- chạy validation theo từng ticket
- không merge phase 2 planning trước khi phase 1 đã có hotspot map và validation matrix
