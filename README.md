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

Feature ↔ menu: dashboard · orders (chi tiết + **Giải thích phân bổ B1–B4** + chi phí giao ước tính) · debts (công nợ một phần, thu một lần) · picking · receipts · whtransfer · **rotation (Luân chuyển cận hạn: đề xuất, bảng điểm từng kho ứng viên, duyệt / sửa SL / bỏ qua)** · **fleet (Xe & người giao)** · batches · batchpromo · disposal · promos · retailers · loyalty · gifts · redeem · regions · categories · products (nháp / publish / inactive / clone) · warehouses · users (không tạo Admin) · kpi · complaints · config (trọng số phân bổ, trọng số luân chuyển, Dmax, **bảng vận chuyển dùng chung**, tỷ lệ điểm).

## Contract FE ↔ BE: chỗ đã khớp và chỗ chưa

Portal được dựng như prototype trên mock trước khi backend có; hai bên thiết kế độc lập. Đối chiếu
toàn bộ lời gọi trong `features/*/api.ts` với bảng route backend (23/10/2026): **70/128 lời gọi
chưa có route khớp**. Phần lớn là tính năng S2/S3 backend chưa làm, nhưng một phần là **lệch thiết
kế** và sẽ gãy ngay khi tắt mock:

| Portal gọi | Backend thực có |
|---|---|
| `GET /batches`, `/batches/{code}` | `GET /inventory`, `/inventory/batches/{batchId}` |
| `POST /products/{sku}/clone` | *(không có)* — gần nhất là `/products/{id}/replacement` |
| `GET /areas`, `/sales-staff` | `/regions`, `/sales-groups`, `/territory-assignments/sales` |
| `GET /retailer-registrations` + approve/reject | `POST /retailers/{id}/submit-review`, `/review` |
| `GET /retailers/{code}/mlor` | `GET /retailers/{id}/mlor-resolution` |
| `PUT /retailers/{code}` | `PUT /retailers/{id}/declaration` |

**Khóa định danh là lệch hệ thống nhất:** Portal địa chỉ hoá bằng mã nghiệp vụ (`DH-001024`,
`SKU001`), backend bằng GUID. Mỗi màn nối API thật đều phải thêm `id` vào DTO và đổi route param —
`orders` và `promos` đã làm, phần còn lại thì chưa.

Khi sửa một feature cho khớp backend, **sửa cả mock theo shape thật** rồi mới đóng việc; mock trả
shape cũ thì `tsc` vẫn xanh mà màn hình gãy lúc chạy.

## Lưu ý khi nối API thật

Kiểu dữ liệu trong `features/*/types.ts` đang khớp với mock handler. Khi backend chạy, sinh type từ Swagger (`npx openapi-typescript http://localhost:5080/swagger/v1/swagger.json -o src/shared/api/schema.d.ts`) rồi đối chiếu từng feature; chỗ nào lệch thì sửa một phía cho thống nhất (ưu tiên giữ tên trường của backend).
