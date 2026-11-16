# S11 — API làm bài & chấm tự động

**Phụ thuộc:** S08 · **Song song với:** S09, S10

> **Đã đổi (2026-11-15):** mỗi participant chỉ làm **1 lượt mỗi phiên**, mọi loại đề; muốn làm lại thì mentor mở phiên mới ([PRODUCT.md §4.4, §7.15](../PRODUCT.md)). Các đoạn dưới đây nói về làm lại / lượt điểm cao nhất là bản cũ.

## Bối cảnh
Lõi nghiệp vụ: bắt đầu lượt, trộn câu, autosave, nộp, chấm, luật làm lại. Contract: [architecture.md §2, §5 (me/attempts), §6](../architecture.md); business: [PRODUCT.md §4.3–4.5](../PRODUCT.md).

## Phạm vi
- `src/shared/scoring.ts`: `scoreAnswer`, `pickCountedAttempt` như §6 (thuần, test kỹ).
- `POST /api/me/attempts`, `GET /api/me/attempts/:id`, `PUT /api/me/attempts/:id/answers/:questionId`, `POST /api/me/attempts/:id/submit`.
- `GET /api/me` bổ sung: lượt đang làm (nếu có), danh sách lượt đã nộp (attemptNo, score, maxScore tự động, submittedAt), `canStartNew`.
- Hiện thực hook `onSessionClosing` của S06: tự nộp mọi attempt chưa nộp (chấm như nộp thường).
- `GET /api/admin/sessions/:id` bổ sung tiến độ mỗi participant (trạng thái, số lượt, điểm lượt được tính).
- Publish `leaderboard` khi có bài nộp.
- DTO member trong `src/shared/api/attempts.ts`: **không** có `is_correct`, `explanation`.

## Quy tắc
- Bắt đầu lượt: session `running`, participant `active`, không có lượt dở; đề có tự luận và đã có 1 lượt → 409 "Đề có tự luận chỉ được làm 1 lần".
- Trộn khi `shuffle = true`: thứ tự câu và thứ tự đáp án mỗi câu (Fisher–Yates, `crypto.randomInt`); `shuffle = false` → theo `position`.
- Autosave: chỉ khi lượt chưa nộp và session `running`; `selectedOptionIds` phải thuộc câu đó; single chỉ được ≤ 1 lựa chọn; essay nhận `textAnswer` ≤ 10.000 ký tự.
- Submit: chấm mọi câu trắc nghiệm (câu bỏ trống = 0), essay `auto_score = null`; `attempt.auto_score` = tổng. Submit lần 2 → 409.
- Chỉ chủ lượt mới truy cập được lượt đó (khác participant → 404).

## Acceptance criteria
- [x] Mọi quy tắc trên có test.
- [x] **Test không lộ đáp án**: response của mọi endpoint `/api/me/*` trước khi đóng phiên không chứa key `isCorrect`/`is_correct`/`explanation` (kiểm đệ quy trên JSON).
- [x] Đóng phiên khi có người đang làm → lượt đó được nộp và chấm.

## Test bắt buộc
- `scoreAnswer`: single đúng/sai/bỏ trống; multi đúng hết/thiếu/thừa; essay → null.
- `pickCountedAttempt`: chọn điểm cao nhất, hoà → nộp sớm hơn; đề có tự luận → lượt duy nhất.
- API: luồng làm lại đề trắc nghiệm 2 lần; chặn làm lại đề tự luận; autosave sai câu → 400; trộn với `shuffle=false` giữ thứ tự.
