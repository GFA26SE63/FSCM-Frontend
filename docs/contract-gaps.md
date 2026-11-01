# Lệch contract Portal ↔ Backend — danh sách cần sửa

Đo ngày **23/10/2026** trên `develop` của cả hai repo, bằng cách bật API thật (DB dev Azure) rồi gọi
**đúng đường dẫn và đúng loại giá trị mà Portal gửi**, không đăng nhập:

- `401` → route khớp, chỉ thiếu token
- `404` → không route nào khớp
- `405` → đúng đường dẫn, sai HTTP method

| Kết quả | Số lời gọi |
| --- | --- |
| `401` — khớp | 37 |
| `404` — không khớp | **89** |
| `405` — sai method | 2 |
| **Tổng lời gọi trong `features/*/api.ts`** | **128** |

Nguyên nhân gốc: Portal và backend ban đầu được thiết kế độc lập, nên hai bên đặt tên và chọn khóa
độc lập với nhau.

Phân loại dưới đây **đã sửa tay** sau khi đối chiếu từng controller — bản phân loại tự động xếp nhầm
một số endpoint vào "chưa có" trong khi backend đã có dưới tên khác.

---

## 0. Hai thứ chặn ngay từ bước chạy

| Vấn đề | Hiện tại | Phải thành |
| --- | --- | --- |
| Cổng API | `.env` → `VITE_API_BASE_URL=http://localhost:5080` | **5246** (theo `launchSettings.json`) |
| Môi trường khi chạy API | chạy kèm `--no-launch-profile` → `Hosting environment: Production` → không nạp `appsettings.Development.json` → không có connection string → **mọi request 500** | chạy `--launch-profile http` (profile này set `ASPNETCORE_ENVIRONMENT=Development`) |

### 0b. Đăng nhập API thật — đã xử lý

Màn login hỗ trợ cả email/mật khẩu và Google. Google ID token được
đổi tại `POST /api/v1/auth/google/exchange`; nếu chưa cấu hình `VITE_GOOGLE_CLIENT_ID`, người dùng
vẫn có thể đăng nhập bằng tài khoản FSCM cục bộ.

### 0c. `/notifications` hỏng trên **mọi** màn

Thanh menu gọi `GET /notifications` và `GET /notifications/badges` ở **mọi trang**, cả hai đều `404`.
Đây không phải lỗi của một màn mà là hai request lỗi trên từng lần tải trang, nên khi dò lỗi màn khác
sẽ thấy nhiễu. Xếp ở nhóm C (backend chưa có) nhưng nên xử lý sớm hơn vì phạm vi ảnh hưởng.

### 0d. DTO của đơn hàng khác hẳn nhau — việc lớn nhất của nhóm A

Đo bằng cách gọi `GET /orders/{id}` thật rồi so với `OrderSummary` + `OrderDetail` trong
`features/orders/types.ts`: **29 trường Portal đọc không hề tồn tại trong payload thật**, và payload
thật có ~19 trường Portal không dùng. Lệch từ những cái cơ bản nhất:

| Portal đọc | API thật trả |
| --- | --- |
| `code` | `orderCode` |
| `total`, `finalPrice` | `finalAmount` |
| `discount` | `discountAmount` |
| `timeline` | `history` |
| `rejectReason` | `rejectionReason` |
| `promotions`, `allocations`, `pickingLists`, `delivery`, `receivable`, `loyalty`, `salesName`, `channel`, `syncedAt`, `termNdays`… | *(không có)* |

Hệ quả cụ thể: màn chi tiết đơn **crash trắng trang** với API thật —
`Cannot read properties of undefined (reading 'length')` tại `OrderDetailPage.tsx:107`
(`o.promotions.length`).

Nên **nhóm A không phải chỉ "đổi khoá"** cho phần `orders`. Thêm `id` vào DTO là chưa đủ; phải ánh xạ
lại gần như toàn bộ `OrderSummary`/`OrderDetail` theo `OrderResult` của backend. Đây là phần việc nặng
nhất trong toàn bộ tài liệu này.

### 0e. Lỗi dữ liệu + lỗi code: `GET /orders` trả 500

`GET /api/v1/orders` **trả 500 trên DB dev**, nên danh sách đơn không tải được gì cả.

```
System.InvalidOperationException: Sequence contains more than one matching element
  at OrderStore.LoadAsync  (src/FSCM.Persistence/Orders/OrderStore.cs:295)
```

Dòng 298: `promotionSnapshots.SingleOrDefault(item => item.SalesOrderLineId == line.Id)`.

Nguyên nhân: đơn **DH-001031** có **hai dòng `ORDER_PROMOTION` giống hệt nhau** cho cùng một dòng đơn
và cùng một promotion (`SalesOrderLineId = 4cf6fe0b-0c18-4e76-85a0-2ac5e54656a5`, cùng `PromotionId`,
cùng `AppliedAt`, cùng `DiscountAmount`) — bị chèn trùng.

Và schema cho phép điều đó: `IX_ORDER_PROMOTION_SalesOrderLineId` là index **không unique**. Code giả
định tối đa một bản ghi mỗi dòng, schema thì không bắt buộc.

Cần cả hai: xoá dòng trùng trong DB, **và** thêm unique index trên `(SalesOrderLineId, PromotionId)`
để nó không tái diễn. Một đơn hỏng đang làm sập cả endpoint danh sách, nên cân nhắc đọc bằng
`FirstOrDefault` để một bản ghi lỗi chỉ ảnh hưởng đúng đơn đó.

### 0f. Hai từ vựng cho cùng một khái niệm "nguồn MLOR"

| Nơi | Giá trị |
| --- | --- |
| `SALES_ORDER_LINE.MlorSourceScope` (phía đơn) | `Sku` · `Category` · `Default` |
| `MlorSources` (phía đợt phân bổ) | `RetailerProduct` · `RetailerCategory` · `ProductDefault` |

Dùng nhầm bộ này cho màn kia thì nhãn ra **rỗng, không báo lỗi**. Đã dính một lần ở F36-FE.

---

## 1. Nhóm A — route đã có, chỉ sai kiểu khóa (23 lời gọi)

Portal gửi **mã nghiệp vụ** (`DH-001024`, `SKU001`, `CAT-01`), route backend ràng buộc
`{id:guid}` nên không khớp.

**Cách sửa:** thêm `id` (GUID) vào DTO trả về của endpoint danh sách, đổi route param ở
`app/routes.tsx`, rồi đổi `api.ts` sang gọi theo `id`.

| Feature | Lời gọi | Backend thực có |
| --- | --- | --- |
| `orders` | `GET /orders/{code}` | `GET /orders/{id:guid}` |
| `orders` | `GET /orders/{code}/allocation-trace` | `GET /orders/{id:guid}/allocation-trace` |
| `orders` | `POST /orders/{code}/approve` | `POST /orders/{id:guid}/approve` |
| `orders` | `POST /orders/{code}/reject` | `POST /orders/{id:guid}/reject` |
| `orders` | `POST /orders/{code}/cancel` | `POST /orders/{id:guid}/cancel` |
| `orders` | `POST /orders/{code}/dispatch` | `POST /orders/{id:guid}/dispatch` |
| `orders` | `POST /orders/{code}/confirm-receipt` | `POST /orders/{id:guid}/confirm-receipt` |
| `products` | `GET /products/{sku}` | `GET /products/{productId:guid}` |
| `products` | `PUT /products/{sku}` | `PUT /products/{productId:guid}` |
| `products` | `POST /products/{sku}/publish` | `POST /products/{productId:guid}/publish` |
| `products` | `POST /products/{sku}/inactivate` | `POST /products/{productId:guid}/inactivate` |
| `categories` | `GET /categories/{code}` | `GET /categories/{categoryId:guid}` |
| `categories` | `PUT /categories/{code}` | `PUT /categories/{categoryId:guid}` |
| `warehouses` | `GET /warehouses/{code}` | `GET /warehouses/{id:guid}` |
| `warehouses` | `PUT /warehouses/{code}` | `PUT /warehouses/{id:guid}` |
| `users` | `GET /users/{id}` | `GET /users/{id:guid}` (Portal gửi mã, không phải GUID) |
| `users` | `PUT /users/{id}` | `PUT /users/{id:guid}` |
| `regions` | `GET /sales-groups/{code}` | `GET /sales-groups/{salesGroupId:guid}` |
| `regions` | `PUT /sales-groups/{code}` | `PUT /sales-groups/{salesGroupId:guid}` |
| `retailers` | `GET /retailers/{code}` | `GET /retailers/{retailerId:guid}` |
| `receipts` | `GET /goods-receipts/{code}` | `GET /goods-receipts/{receiptId:guid}` |
| `promos` | `GET /promotions/{code}` | `GET /promotions/{id:guid}` — **đã sửa** ở PR #24 |
| `promos` | `POST /promotions/{code}/activate` | `POST /promotions/{id:guid}/activate` — **đã sửa** |

---

## 2. Nhóm B — backend đã có nhưng khác tên / khác mô hình (20 lời gọi)

Nhóm này **không sửa cơ học được**, phải thống nhất tên giữa hai bên trước.

| Feature | Portal gọi | Backend thực có | Ghi chú |
| --- | --- | --- | --- |
| `batches` | `GET /batches` | `GET /inventory` | đổi tên tài nguyên |
| `batches` | `GET /batches/{code}` | `GET /inventory/batches/{batchId:guid}` | đổi tên + khóa |
| `whtransfer` | `GET /batches` | `GET /inventory` | như trên |
| `config` | `GET /settings` | `GET /business-configurations` | Portal gom mọi tham số vào 1 object; backend là key–value có version |
| `config` | `PUT /settings` | `PUT /business-configurations/{key}` | phải tách thành nhiều lần PUT theo key |
| `regions` | `GET /areas` | `GET /regions` | đổi tên |
| `regions` | `POST /areas` | `POST /regions` | đổi tên |
| `retailers` | `GET /areas` | `GET /regions` | đổi tên |
| `regions` | `GET /sales-staff` | `GET /territory-assignments/sales` | đổi tên |
| `regions` | `POST /sales-staff/transfer` | `PUT /territory-assignments/sales/{userId:guid}` | khác cả method |
| `retailers` | `GET /retailer-registrations` | *(không có resource riêng)* | backend không tách "khai báo" thành resource; dùng `GET /retailers` rồi lọc theo trạng thái |
| `retailers` | `GET /retailer-registrations/{code}` | `GET /retailers/{retailerId:guid}` | như trên |
| `retailers` | `POST /retailer-registrations/{code}/approve` | `POST /retailers/{retailerId:guid}/review` | mô hình khác |
| `retailers` | `POST /retailer-registrations/{code}/reject` | `POST /retailers/{retailerId:guid}/review` | cùng 1 endpoint, khác payload |
| `retailers` | `GET /retailers/{code}/mlor` | `GET /retailers/{retailerId:guid}/mlor-resolution` | đổi tên + khóa |
| `products` | `POST /products/{sku}/clone` | `POST /products/{productId:guid}/replacement` | **cần xác nhận** có đúng là một chức năng không — "clone để sửa" (F16) và "replacement" có thể khác nhau |
| `promos` | `POST /promotions/{code}/pause` | `POST /promotions/{id:guid}/deactivate` | **đã sửa** ở PR #24 |
| `batchpromo` | `POST /batch-discounts/{code}/stop` | `POST /promotions/{id:guid}/deactivate` | giảm giá batch cũng là promotion ở backend |
| `picking` | `POST /picking-lists/{code}/scan` | luồng soạn theo **đợt** (`/allocation-runs/.../picking-lists`), không theo mã phiếu | F43/F44 đổi mô hình |
| `picking` | `POST /picking-lists/{code}/ship` | như trên | |

**Hai lời gọi trả `405`** (đúng đường, sai method):

| Portal gọi | Backend thực có |
| --- | --- |
| `POST /batch-discounts` | chỉ có `GET`; tạo giảm giá batch đi qua `/promotions` |
| `PUT /retailers/{code}` | `PUT /retailers/{retailerId:guid}/declaration` |

---

## 3. Nhóm C — backend chưa có (46 lời gọi)

**Không phải lỗi.** Phần lớn là tính năng S2/S3 chưa tới lượt. Ghi ra để biết màn nào chưa thể hoạt
động cho đến khi backend hỗ trợ.

| Feature Portal | Lời gọi chưa có backend |
| --- | --- |
| `dashboard` | `GET /dashboard` |
| `notifications` | `GET /notifications`, `GET /notifications/badges` |
| `fleet` | `/vehicles` và `/drivers` (GET list, GET chi tiết, POST, PUT — 8 lời gọi) |
| `orders` | `GET /drivers`, `GET /vehicles` (dropdown gán xe) |
| `complaints` | `GET /complaints`, `GET /complaints/{code}`, `POST /complaints/{code}/resolve` |
| `disposal` | `GET /disposals`, `/disposals/{code}`, `/disposals/candidates`, `POST /disposals` |
| `whtransfer` | `GET /transfers`, `/transfers/{code}`, `/transfers/suggestions`, `POST /transfers`, `POST /transfers/{code}/receive` |
| `rotation` | `/rotation/proposals` (list, chi tiết, approve, skip, PUT) và `POST /rotation/run` |
| `loyalty` | `/loyalty/programs` (GET, PUT), `/loyalty/retailers` (GET, GET chi tiết) |
| `gifts` | `GET /gifts`, `POST /gifts`, `PUT /gifts/{code}` |
| `redeem` | `/gift-redemptions` (list, chi tiết, POST theo bước) |
| `kpi` | `GET /kpi/sales`, `GET /rankings/products` |
| `debts` | `POST /receivables/{orderCode}/collect` |
| `batchpromo` | `GET /labels/{code}` |

---

## 4. Bẫy đã làm hỏng màn hình hai lần: mảng thuần vs `{ items }`

Backend **không nhất quán**: một số endpoint danh sách trả mảng thuần, một số trả envelope phân
trang. Helper trong `shared/api/http.ts` khác nhau theo đó:

| Trả **mảng thuần** → dùng `get<T[]>` | Trả **`{ items }`** → dùng `getAll<T>` |
| --- | --- |
| `/promotions`, `/categories`, `/warehouses`, `/regions`, `/sales-groups`, `/inventory`, `/goods-receipts`, `/transit-tables/history` | `/products`, `/retailers`, `/users`, `/orders` |

Dùng nhầm `getAll` cho endpoint trả mảng thuần thì nó đọc `.items` của mảng, nhận `undefined`, và
màn hình **rỗng mà không báo lỗi gì**. Đã xảy ra hai lần: lịch sử bảng vận chuyển (F54-FE), rồi danh
sách khuyến mãi (F24-FE). Cả hai đều không bị `tsc` bắt.

---

## 5. Quy tắc khi sửa

1. **Kiểm response thật của server** rồi mới đóng việc. `tsc` vẫn xanh khi JSON runtime sai shape.
2. Kiểm bằng cách bật API thật rồi gọi thử, đừng tin phép so khớp đường dẫn trên giấy — phép so tĩnh
   coi `/{code}` và `/{id:guid}` là một route và cho ra con số sai (70 thay vì 89).
3. Tài khoản dev để kiểm: `admin@fscm.local` (và `operator@`, `sales@`, `warehouse.keeper@`,
   `sales.manager@`, `retailer@` — cùng `@fscm.local`), mật khẩu trùng mật khẩu DB.

---

## Cập nhật 26/10/2026 — đo lại bằng bảng route, và `.env` đã đổi

Lần này đo **tĩnh**: trích mọi `[Route]` + `[HttpXxx]` trong `FSCM.API/Controllers` ra bảng 185 route,
rồi đối chiếu với mọi lời gọi trong `features/*/api.ts`. Không cần API chạy, nên ai cũng lặp lại được.

| | |
| --- | --- |
| Lời gọi trong `features/*/api.ts` | 140 |
| Khớp route backend | 88 |
| **Không khớp** | **43 path, nằm ở 15 feature** |

Portal gọi API thật, nên mỗi path dưới đây là một màn hỏng thật chứ không phải rủi ro trên giấy.

Hai loại khác hẳn nhau, đừng xử lý chung:

**(1) Đổi tên — backend có, Portal gọi sai đường.** Sửa ở phía Portal là xong:

| Portal gọi | Backend thật |
| --- | --- |
| `/drivers`, `/vehicles` | `/deliveries/drivers`, `/deliveries/vehicles` |
| `/labels/{x}` | `/qr-labels/{x}` |
| `/transfers`, `/transfers/{x}/receive`, `/transfers/suggestions` | `/internal-transfers...` |
| `/retailers/{x}/mlor` | `/retailers/{x}/mlor-resolution` |
| `/batch-discounts/{x}/stop` | `/batch-discounts/{x}/remove` |
| `/rankings/products` | `/reports/sales-ranking` |

**(2) Backend chưa có gì cả.** Không sửa được ở Portal: `/receivables`, `/disposals*`, `/kpi/sales`,
`/notifications*`, `/areas`, `/sales-staff*`, `/retailer-registrations*`, `/rotation/*`,
`/dashboard`, `/settings`, `/business-configurations/eta.schedule`, `/batches`.

`redeem` → `/loyalty/redemptions/{x}/{x}` là **dương tính giả**: đoạn `{x}` thứ hai là tên thao tác
(`approve|deliver|complete|reject`) và cả bốn đều có thật.

### Đã dọn trong lần này

- Xoá hẳn feature `picking` cũ (phiếu soạn theo **đơn**). Nó gọi `/picking-lists/{x}/scan` và
  `/picking-lists/{x}/ship` — một cái sai số nhiều, một cái **không tồn tại** — và mô hình một phiếu
  một đơn không phải thứ server có. F43 đã nằm ở feature `runpicking`, đọc đúng phiếu theo đợt/kho.
- `runpicking` sửa từ vựng trạng thái: server gửi `Ready`/`NeedsHandling`, không phải
  `Completed`/`Exception`.
- Thêm feature `shipments` cho F93.

### Một gốc rễ đáng sửa, không phải chuyện đặt tên

`getAll` đọc `.items`, nhưng server trả **mảng trần** ở một số endpoint (`/warehouses`,
`/categories`, `/promotions`). Gọi `getAll` lên endpoint như vậy cho ra `undefined` — màn rỗng,
console im, network tab trông bình thường. Lỗi này đã bắt được **ba lần riêng biệt**. `getAll` giờ
nhận cả hai hình dạng.

Portal từng phân trang `/warehouses` trong khi server trả mảng, và bỏ mất `id` của kho. Hai điểm này
đã được sửa cho khớp server.
