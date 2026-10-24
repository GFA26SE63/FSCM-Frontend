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

Feature ↔ menu: dashboard · orders (chi tiết + **Giải thích phân bổ B1–B4** đọc từ trace thật của đợt + chi phí giao ước tính) · **allocation (Duyệt phương án đợt: tổng đơn đủ/thiếu, mở từng SKU/batch, duyệt hoặc yêu cầu tính lại)** · debts (công nợ một phần, thu một lần) · picking · receipts · whtransfer · **rotation (Luân chuyển cận hạn: đề xuất, bảng điểm từng kho ứng viên, duyệt / sửa SL / bỏ qua)** · **fleet (Xe & người giao)** · batches · batchpromo · disposal · promos · retailers · loyalty · gifts · redeem · regions · categories · products (nháp / publish / inactive / clone) · warehouses · users (không tạo Admin) · kpi · complaints · config (trọng số phân bổ, trọng số luân chuyển, Dmax, **bảng vận chuyển dùng chung**, tỷ lệ điểm).

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

## Duyệt phương án đợt (allocation)

Màn Admin duyệt một **phiên bản phương án** của đợt 12:00. Vài điều dễ làm sai khi sửa màn này:

- **Duyệt là duyệt cả phân bổ và giá**, cùng một phiên bản. Không có sửa batch từng dòng: duyệt một
  hỗn hợp tự chọn sẽ tạo ra phương án mà engine chưa từng chấm điểm và không ai tái lập được. Phương
  án chưa đúng thì **yêu cầu tính lại kèm lý do** — bản mới thay thế bản cũ, không sửa đè lên.
- **Không có tự duyệt.** Quá hạn nhắc vẫn chỉ là đề xuất, và **chưa giữ hàng** cho tới khi có người
  quyết định. Đừng thêm bất kỳ hành vi tự động nào vào màn này.
- **Hạn còn lúc nhận phải đứng cạnh ngưỡng MLOR.** Cặp số đó mới là lý do một batch hợp lệ; thiếu
  một trong hai thì con số còn lại vô nghĩa.
- `allocations` và `prices` của một phiên bản **key giống nhau** (dòng đợt + batch). Ghép theo cặp
  đó, đừng ghép theo thứ tự mảng.
- Đơn thiếu hàng được **ghi là thiếu**; lượng tạm của cả đơn trả về quỹ chung cho các đơn phía sau.
  Đợt không tự từ chối đơn.

Mock dựng đợt từ chính các đơn mẫu và trace của chúng, nên hình dạng dữ liệu đúng nhưng **không phải
engine thật**: nó không rút từ một quỹ chung. Quyết định duyệt / yêu cầu tính lại giữ trong bộ nhớ
phiên trình duyệt, mất khi reload. Định danh đợt và phiên bản là hash của ngày nghiệp vụ, nên mock
dò ngược bằng cách quét một khoảng ngày có giới hạn; server thật thì tra thẳng.

## Lưu ý khi nối API thật

Kiểu dữ liệu trong `features/*/types.ts` đang khớp với mock handler. Khi backend chạy, sinh type từ Swagger (`npx openapi-typescript http://localhost:5080/swagger/v1/swagger.json -o src/shared/api/schema.d.ts`) rồi đối chiếu từng feature; chỗ nào lệch thì sửa một phía cho thống nhất (ưu tiên giữ tên trường của backend).
