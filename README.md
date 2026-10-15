# FSCM Portal – React 18 + TypeScript + Vite

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

## Cấu trúc (feature-based)

```
src/
├─ app/            App, providers (React Query, Auth, Toast), router, routes.tsx (một nguồn cho route + menu + quyền theo vai trò), layout, Login/NotFound
├─ shared/
│  ├─ api/         http.ts (axios /api/v1 + Bearer + ProblemDetails → ApiError), types chung, mock/ (adapter trong trình duyệt)
│  │  └─ mock/     fixtures (dữ liệu prototype), handlers/<module> (giống REST của backend), engines/ (allocation, rotation, transit, pricing – cùng công thức với backend)
│  ├─ auth/        AuthContext, guards (RequireAuth/RequireRole), roles, tokenStore, Entra config
│  ├─ hooks/       useApiMutation (toast + invalidate), useOpenState
│  ├─ lib/         format tiền/ngày, mã ID, nhãn trạng thái (UI label ↔ code)
│  └─ ui/          Button, Card, DataTable (search + filter + paging), Modal/Drawer, FormDialog, StatusChip, Tabs, StepSection…
└─ features/<feature>/   api.ts · hooks.ts (React Query) · types.ts · pages/ · components/ · index.ts
```

Feature ↔ menu: dashboard · orders (chi tiết + **Giải thích phân bổ B1–B4** + chi phí giao ước tính) · debts (công nợ một phần, thu một lần) · picking · receipts · whtransfer · **rotation (Luân chuyển cận hạn: đề xuất, bảng điểm từng kho ứng viên, duyệt / sửa SL / bỏ qua)** · **fleet (Xe & người giao)** · batches · batchpromo · disposal · promos · retailers · loyalty · gifts · redeem · regions · categories · products (nháp / publish / inactive / clone) · warehouses · users (không tạo Admin) · kpi · complaints · config (trọng số phân bổ, trọng số luân chuyển, Dmax, **bảng vận chuyển dùng chung**, tỷ lệ điểm).

Thêm màn mới: tạo `features/<x>/` theo mẫu trên, export page trong `index.ts`, thêm một dòng vào `APP_ROUTES` trong `app/routes.tsx` (key, nhãn menu, vai trò).

## Lưu ý khi nối API thật

Kiểu dữ liệu trong `features/*/types.ts` đang khớp với mock handler. Khi backend chạy, sinh type từ Swagger (`npx openapi-typescript http://localhost:5080/swagger/v1/swagger.json -o src/shared/api/schema.d.ts`) rồi đối chiếu từng feature; chỗ nào lệch thì sửa một phía cho thống nhất (ưu tiên giữ tên trường của backend).
