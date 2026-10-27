# FSCM Portal – React 19 + TypeScript + Vite

Web cho Admin, Operator, Warehouse Keeper, Sales Manager (FA26SE083 · GFA26SE63). Giao diện bám theo prototype Design (bản 20) và SPEC chung.

## Chạy

```bash
npm install
cp .env.example .env        # VITE_USE_MOCK=true: chạy không cần backend (dữ liệu mẫu prototype 27/09/2026)
npm run dev                 # http://localhost:5173
npm run build               # tsc -b && vite build → dist/ (deploy Vercel)
```

Đăng nhập mock: chọn vai trò, email demo (vd. `khoa.pm@fscm.local` – Admin), mật khẩu bất kỳ ≥ 6 ký tự. Sidebar có ô "Xem với vai trò (demo)" để đổi vai trò nhanh.

Nối backend thật: `VITE_USE_MOCK=false`, cấu hình `VITE_API_BASE_URL`, `VITE_ENTRA_*` và `VITE_GOOGLE_CLIENT_ID`; backend cần đổi ID token tại `POST /api/v1/auth/external-login` thành JWT FSCM.

## Kiến trúc và cấu trúc thư mục

Portal dùng kiến trúc feature-based. `app` lắp ráp ứng dụng, `shared` chứa hạ tầng/tài nguyên dùng lại thật sự, còn mỗi `features/<feature>` sở hữu trọn UI và data-access của nghiệp vụ đó.

```
src/
├─ app/
│  ├─ main.tsx              điểm vào browser, cài mock adapter trước khi render
│  ├─ App.tsx               root component
│  ├─ providers.tsx         React Query, Auth và Toast providers
│  ├─ router.tsx            ghép route, auth guard, role guard và lazy loading
│  ├─ routes.tsx            một nguồn cho route, menu, icon và quyền theo vai trò
│  ├─ layout/               shell dùng chung: sidebar, topbar, content
│  └─ pages/                Login và NotFound ở cấp ứng dụng
├─ shared/
│  ├─ api/
│  │  ├─ http.ts            Axios duy nhất: base URL, Bearer, ProblemDetails → ApiError
│  │  ├─ errors.ts/types.ts contract hạ tầng dùng chung
│  │  └─ mock/              adapter chạy trong browser
│  │     ├─ fixtures/       dữ liệu prototype dùng chung
│  │     ├─ handlers/       route mock theo module, mô phỏng REST
│  │     └─ engines/        thuật toán mô phỏng allocation/pricing/transit/rotation
│  ├─ auth/                 session context, token store, external auth và guards
│  ├─ router/               lớp tương thích router; feature không import router package trực tiếp
│  ├─ hooks/                hook kỹ thuật dùng cho nhiều feature
│  ├─ lib/                  hàm thuần format/date/id/status/env
│  └─ ui/                   design-system primitives, không chứa nghiệp vụ
└─ features/<feature>/
   ├─ api.ts                lời gọi endpoint của riêng feature
   ├─ hooks.ts              React Query keys, query và mutation hooks
   ├─ types.ts              DTO/view model của feature
   ├─ pages/                route-level components, điều phối dữ liệu
   ├─ components/           UI có ngữ nghĩa nghiệp vụ, chỉ dùng trong feature
   └─ index.ts              public exports của feature
```

Luồng phụ thuộc chuẩn:

```text
app/routes → feature page → feature hook → feature api → shared/api/http
                          ↘ feature component

mọi tầng có thể dùng shared/ui, shared/lib và shared/auth khi phù hợp
```

### Quy tắc khi implement thêm

- Bắt đầu từ `features/<x>` nếu code có tên/ngữ nghĩa nghiệp vụ. Chỉ đưa vào `shared` khi ít nhất hai feature có thể dùng mà không cần biết nghiệp vụ nguồn.
- Page điều phối route, query state và dialog; component hiển thị/thu input; `api.ts` không import React; `types.ts` không chứa side effect.
- Mọi request thật đi qua instance trong `shared/api/http.ts`; không tạo Axios instance trong feature. Giữ mapping ProblemDetails và xử lý `401` tập trung.
- Query key được định nghĩa trong hook của feature, có chứa mọi filter ảnh hưởng response. Mutation phải invalidate/refetch đúng key liên quan.
- `app/routes.tsx` là nguồn sự thật cho URL, menu và role; backend vẫn là nơi quyết định authorization cuối cùng.
- Feature khác chỉ import qua `features/<x>/index.ts` nếu cần dùng public API; tránh import sâu vào `pages/` hoặc component nội bộ.
- Không đưa business rule authoritative vào UI/mock engine. Engine mock chỉ phục vụ demo; khi nối backend, kết quả server thắng.
- Khi thêm GraphQL, đặt client/provider ở `shared/api`, operation và hook ở feature. GraphQL dùng cho Query; command vẫn gọi REST theo API hiện tại. Sau REST mutation phải đồng bộ cả React Query cache và Apollo cache nếu cùng màn dùng hai nguồn.
- Giữ alias `@/*`, TypeScript strict, lazy route và role guard theo pattern đang có. Không thêm global state nếu server state có thể do React Query/Apollo quản lý hoặc state chỉ thuộc một page.

### Cách thêm feature mới

1. Tạo `features/<x>/{api.ts,hooks.ts,types.ts,index.ts,pages/,components/}`; có thể bỏ thư mục chưa cần nhưng giữ đúng trách nhiệm.
2. Định nghĩa DTO theo response backend, sau đó viết API function và query/mutation hook.
3. Tạo page chỉ sử dụng hook/component; xử lý loading/error bằng shared UI.
4. Export route component trong `index.ts` và thêm đúng một khai báo vào `APP_ROUTES`.
5. Nếu mock mode cần hỗ trợ, thêm handler vào module phù hợp và fixture tối thiểu; contract mock phải giống backend.
6. Chạy `npm run lint` và `npm run build` trước khi bàn giao.

Feature ↔ menu: dashboard · orders (chi tiết + **Giải thích phân bổ B1–B4** + chi phí giao ước tính) · debts (công nợ một phần, thu một lần) · **runpicking (Phiếu soạn theo đợt: lấy gom theo batch, chia về từng dòng đơn)** · picking · receipts · whtransfer · **rotation (Luân chuyển cận hạn: đề xuất, bảng điểm từng kho ứng viên, duyệt / sửa SL / bỏ qua)** · **fleet (Xe & người giao)** · batches · batchpromo · disposal · promos · retailers · loyalty · gifts · redeem · regions · categories · products (nháp / publish / inactive / clone) · warehouses · users (không tạo Admin) · kpi · complaints · config (**lịch ngày chạy đợt: giờ chốt + mốc nhắc**, trọng số phân bổ, trọng số luân chuyển, Dmax, **bảng vận chuyển dùng chung**, tỷ lệ điểm).

## Phiếu soạn theo đợt (runpicking)

Phiếu soạn phát hành sau khi phương án được duyệt **và** giữ tồn thành công. Màn này đọc
`GET /allocation-runs/{runId}/picking-lists`. Hai điều **không được** làm khi sửa nó:

- **Không gộp batch.** Hai batch của cùng một SKU phải là **hai dòng lấy gom**. Batch là thứ mà
  phân bổ và bản giá được quyết định trên đó; gộp đi là phiếu soạn không còn đối chiếu được.
- **Không tính giá ở đây.** Mỗi dòng chia mang `allocationPlanPriceId` — **mã** bản giá đã duyệt.
  Màn hình hiện mã đó, không nhân lại số tiền. Tính lại ở đây thì chỉ cần bảng giảm HSD đổi một lần
  là số trên phiếu khác số trên hoá đơn, và không ai phát hiện tới lúc đối chiếu.

Tiền chỉ hiện với vai trò có quyền (Admin / Operator). Thủ kho lấy hàng trên kệ không cần giá, và
phiếu soạn cũng không phải nơi quyết định giá.

Trạng thái lượt lấy gom là **`Pending` / `Picked`** — khác hẳn bộ `NotPicked/Picking/Shipped` của
màn `picking` cũ (theo từng đơn). Đừng dùng nhầm `StatusChip domain="picking"` ở đây.

## Lịch ngày chạy đợt (config)

Mục "Lịch ngày chạy đợt" sửa **một document duy nhất** (`eta.schedule`), vì các mốc chỉ có nghĩa khi
đặt cạnh nhau. Đó cũng là lịch mà đợt phân bổ chạy theo và ETA báo cho khách tính từ — đừng tách ra
thành cấu hình riêng cho portal, vì hai lịch chính là cách hai giờ chốt sinh ra lúc đầu.

- **Khuyến nghị gửi đơn là khuyến nghị**, không phải cổng chặn. Đơn nhận sau mốc đó mà trước giờ
  chốt vẫn vào đợt. UI phải hiện rõ điều này, đừng gọi nó là "hạn".
- **Mốc nhắc phải nằm trước thứ nó nhắc**: hai mốc trước giờ chốt phải trước giờ chốt; nhắc duyệt
  phương án phải nằm **giữa** giờ chốt và hạn duyệt.
- **Quá hạn duyệt hệ thống không tự duyệt.** Câu này nằm ngay trong mục cấu hình, nơi người sửa giờ
  đang đứng — đừng rút gọn nó đi.
- Validate ở client **lặp lại đúng** luật của server. Mốc nhắc sai thứ tự không phải lỗi nhẹ hơn chỉ
  vì được gõ trong portal.

Server trả mốc đã **quy ra thời điểm thật** cho một ngày nghiệp vụ; portal không tự suy giờ Việt Nam
từ chuỗi `"12:00"`.
Feature ↔ menu: dashboard · orders (chi tiết + **Giải thích phân bổ B1–B4** đọc từ trace thật của đợt + chi phí giao ước tính) · debts (công nợ một phần, thu một lần) · picking · receipts · whtransfer · **rotation (Luân chuyển cận hạn: đề xuất, bảng điểm từng kho ứng viên, duyệt / sửa SL / bỏ qua)** · **fleet (Xe & người giao)** · batches · batchpromo · disposal · promos · retailers · loyalty · gifts · redeem · regions · categories · products (nháp / publish / inactive / clone) · warehouses · users (không tạo Admin) · kpi · complaints · config (trọng số phân bổ, trọng số luân chuyển, Dmax, **bảng vận chuyển dùng chung**, tỷ lệ điểm).

## Giải thích phân bổ (orders)

Cửa sổ "Giải thích phân bổ" đọc trace mà đợt 12:00 ghi lại, qua
`GET /allocation-runs/orders/{salesOrderId}/trace`. Vài điều dễ làm sai khi sửa màn này:

- **Hạn dùng tính bằng giờ, không phải ngày.** Đợt so sánh bằng giờ là có chủ đích: tới sáng hôm
  sau khác tới chiều hôm đó. `formatHours` hiện số ngày bên cạnh cho dễ đọc, nhưng số gốc là giờ.
- **Batch bị loại phải ở lại trên màn hình**, kèm lý do. "Vì sao không phải batch kia" mới là câu
  cửa sổ này sinh ra để trả lời; chỉ hiện batch được chọn là bỏ mất công dụng của nó.
- **Mọi xếp hạng của mọi lượt**, không chỉ batch thắng. Một điểm số chẳng nói gì nếu không có các
  điểm nó đã thắng, và `f_Q` được tính lại mỗi lượt nên cùng một batch ra điểm khác giữa hai lượt.
- **Không hiện giá ở đây.** Đợt chọn batch trước rồi mới định giá, nên giảm giá cận hạn không tham
  gia chấm điểm. Giá đọc từ bản lưu riêng (`.../price`); trộn hai thứ sẽ gợi ý sai rằng giảm giá
  giúp batch được chọn.
- **Trạng thái phiên bản phương án phải hiện.** Phương án chờ duyệt là đề xuất, chưa giữ hàng. Người
  dùng không phân biệt được hai thứ này sẽ hứa hàng chưa thật sự được giữ.
- **`Released` khác `Short`.** Dòng `Released` đã rút được hàng rồi mất vì một dòng *khác* của cùng
  đơn thiếu — đơn là đủ-hoặc-không-gì nên lượng tạm của cả đơn được trả về quỹ chung. Nó không phải
  dòng bị thiếu.
- Đơn không đủ hàng được **ghi là thiếu**; đợt không tự từ chối đơn, không tự hạ MLOR, không nới bán
  kính, và không lấy batch của đơn trước để nhường đơn sau.

Mock map engine theo-ngày sẵn có sang shape thật. Hai chỗ mock không làm được, đã ghi chú tại chỗ
trong `orderView.ts`: chỉ giữ xếp hạng đầy đủ của lượt đầu, và không có dữ liệu `Released`.

Endpoint phía đợt (trace, giá) key theo **định danh** chứ không theo mã đơn, nên `OrderDetail` có
trường `id`; mock sinh id ổn định từ mã đơn bằng `mockGuid`.

## Contract FE ↔ BE: chỗ đã khớp và chỗ chưa

Portal được dựng như prototype trên mock trước khi backend có; hai bên thiết kế độc lập. Đo bằng
cách bật API thật (Azure dev DB) rồi gọi **đúng đường dẫn và đúng loại giá trị** Portal gửi, không
đăng nhập — `401` nghĩa là route khớp, `404` nghĩa là không (23/10/2026):

| Kết quả | Số lời gọi |
| --- | --- |
| `401` — route khớp | 37 |
| `404` — không khớp | **89** |
| `405` — đúng đường, sai method | 2 |
| **Tổng** | **128** |

89 chỗ `404` chia làm ba nhóm, và chúng cần ba cách xử lý khác hẳn nhau:

**A. Route có sẵn, chỉ sai kiểu khóa — 23 chỗ.** Portal gửi mã nghiệp vụ (`DH-001024`, `SKU001`),
route backend ràng buộc `{id:guid}` nên không khớp. Gặp ở `orders` (7), `products` (4),
`categories`, `warehouses`, `users`, `sales-groups`, `retailers`, `goods-receipts`, `promotions`.
Sửa được cơ học: thêm `id` vào DTO, đổi route param, sửa mock theo. `orders` và `promos` đã làm.

**B. Cùng nhóm tài nguyên nhưng khác tên — 6 chỗ.** Phải thống nhất tên với backend:

| Portal gọi | Backend thực có |
| --- | --- |
| `POST /products/{sku}/clone` | *(không có)* — gần nhất là `/products/{id}/replacement` |
| `POST /promotions/{code}/pause` | `POST /promotions/{id}/deactivate` |
| `GET /retailers/{code}/mlor` | `GET /retailers/{id}/mlor-resolution` |
| `POST /picking-lists/{code}/scan`, `/ship` | luồng soạn hàng theo đợt, không theo mã phiếu |
| `POST /batch-discounts/{code}/stop` | `POST /promotions/{id}/deactivate` |

**C. Backend chưa có tính năng — 60 chỗ.** `dashboard`, `notifications`, `complaints`, `disposal`,
`gifts`, `redeem`, `loyalty`, `rotation`, `whtransfer`, `kpi`, `fleet`, `/settings`, `/areas`,
`/sales-staff`, `/retailer-registrations`. Phần lớn là S2/S3 chưa làm — **không phải lỗi**, nhưng
cũng có nghĩa là các màn đó mới chỉ chạy được trên mock.

**Danh sách: mảng thuần hay `{ items }`?** Backend không nhất quán, nên mỗi lời gọi phải chọn đúng
helper. Đo trên API đang chạy (23/10/2026):

| Trả **mảng thuần** → dùng `get<T[]>` | Trả **`{ items }`** → dùng `getAll<T>` |
| --- | --- |
| `/promotions`, `/categories`, `/warehouses`, `/regions`, `/sales-groups`, `/inventory`, `/goods-receipts`, `/transit-tables/history` | `/products`, `/retailers`, `/users`, `/orders` |

Dùng `getAll` cho một endpoint trả mảng thuần thì nó đọc `.items` của mảng, nhận `undefined`, và màn
hình **rỗng không báo lỗi gì**. Đây là lỗi đã xảy ra hai lần (lịch sử bảng vận chuyển, rồi khuyến
mãi), nên kiểm shape thật trước khi tin `tsc`.

Khi sửa một feature cho khớp backend, **sửa cả mock theo shape thật** rồi mới đóng việc; mock trả
shape cũ thì `tsc` vẫn xanh mà màn hình gãy lúc chạy.

## F95: đóng đợt phân bổ

Màn `allocation` hiển thị nút `Đóng đợt` cho Admin khi run đã `Approved`. Nút gửi `expectedVersion`
và ghi chú tùy chọn tới `POST /allocation-runs/{runId}/close`; sau khi thành công query được refresh
để trạng thái `Closed` và báo cáo bất biến được hiển thị lại. Portal không cho đóng các run chưa duyệt.

Màn complaint hiển thị SKU, batch/tem, số lượng dự kiến–thực nhận, giá cuối và khoản điều chỉnh đọc
từ `ReceiptDiscrepancyItem`; Portal không tự tính lại giá từ bảng khuyến mãi.
Admin/Operator chọn rõ Duyệt hoặc Từ chối và ghi lý do; Portal không đánh dấu đã hoàn tiền, vì phần đó thuộc F101.

## Lệch contract Portal ↔ Backend

Portal dựng trên mock trước khi backend có, nên hai bên đặt tên và chọn khóa độc lập. Đo ngày
23/10/2026 bằng cách gọi API thật: **89/128 lời gọi trong `features/*/api.ts` trả `404`**.

Danh sách đầy đủ từng chỗ, chia theo cách xử lý (sai kiểu khóa / khác tên / backend chưa có), cùng
bẫy "mảng thuần vs `{ items }`": [docs/contract-gaps.md](docs/contract-gaps.md).

## Lưu ý khi nối API thật

Kiểu dữ liệu trong `features/*/types.ts` đang khớp với mock handler. Khi backend chạy, sinh type từ Swagger (`npx openapi-typescript http://localhost:5080/swagger/v1/swagger.json -o src/shared/api/schema.d.ts`) rồi đối chiếu từng feature; chỗ nào lệch thì sửa một phía cho thống nhất (ưu tiên giữ tên trường của backend).
