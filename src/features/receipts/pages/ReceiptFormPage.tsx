import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import {
  Button,
  Callout,
  Card,
  FormField,
  Input,
  PageHeader,
  SearchSelect,
  Select,
} from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import { useCreateReceipt, useReceiptLookups } from '../hooks';

interface FormLine {
  productId: string;
  sku: string;
  productionDate: string;
  expirationDate: string;
  quantity: string;
  sourceLotCode: string;
}

const createBlankLine = (): FormLine => ({
  productId: '',
  sku: '',
  productionDate: '',
  expirationDate: '',
  quantity: '',
  sourceLotCode: '',
});

export function ReceiptFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { warehouses, products } = useReceiptLookups();
  const createMutation = useCreateReceipt();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [rows, setRows] = useState<FormLine[]>([createBlankLine()]);
  const [tried, setTried] = useState(false);

  const isAdmin = user?.role === 'Admin';
  const isOperator = user?.role === 'Operator';
  const isKeeper = user?.role === 'WarehouseKeeper';

  // Active warehouses according to real backend schema (supports isActive boolean or status Active)
  const activeWarehouses = useMemo(
    () => (warehouses.data ?? []).filter((w) => w.isActive || w.status === 'Active'),
    [warehouses.data],
  );

  // Authorize warehouses for current actor: Admin/Operator see all active warehouses;
  // WarehouseKeeper only sees warehouses assigned to them.
  const authorizedWarehouses = useMemo(() => {
    if (isAdmin || isOperator) {
      return activeWarehouses;
    }

    if (isKeeper) {
      const assignedIds = new Set(
        (user?.scope?.warehouseIds ?? []).map((id) => id.toLowerCase()),
      );
      const assignedCode = user?.warehouseCode?.toLowerCase();
      const scopeWarehouses = user?.scopeLabels?.warehouses ?? [];
      const scopeCodes = new Set(scopeWarehouses.map((s) => s.code.toLowerCase()));
      const scopeIds = new Set(scopeWarehouses.map((s) => s.id.toLowerCase()));

      return activeWarehouses.filter((w) => {
        const idLower = w.id.toLowerCase();
        const codeLower = w.code.toLowerCase();
        const isKeeperMatch =
          Array.isArray(w.keepers) &&
          w.keepers.some(
            (k) => user?.id && k.userId.toLowerCase() === user.id.toLowerCase(),
          );

        return (
          assignedIds.has(idLower) ||
          scopeIds.has(idLower) ||
          (assignedCode && codeLower === assignedCode) ||
          scopeCodes.has(codeLower) ||
          isKeeperMatch
        );
      });
    }

    return [];
  }, [isAdmin, isOperator, isKeeper, activeWarehouses, user]);

  const contextualWh = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('warehouseId') || params.get('warehouse') || params.get('warehouseCode') || '';
  }, [location.search]);

  // Handle warehouse selection:
  // - Starts with '' (no automatic selection) unless explicitly provided via navigation context.
  // - Preserves user's valid selection during unrelated form updates.
  // - Clears selection if the previously selected warehouse is no longer available.
  useEffect(() => {
    if (authorizedWarehouses.length === 0) {
      setSelectedWarehouseId('');
      return;
    }

    setSelectedWarehouseId((prev) => {
      // 1. If user already made a valid selection, preserve it
      if (prev && authorizedWarehouses.some((w) => w.id === prev)) {
        return prev;
      }

      // 2. If navigated from a specific context (e.g. ?warehouseId=... or ?warehouse=WH-...), preselect if authorized
      if (contextualWh) {
        const matched = authorizedWarehouses.find(
          (w) =>
            w.id.toLowerCase() === contextualWh.toLowerCase() ||
            w.code.toLowerCase() === contextualWh.toLowerCase(),
        );
        if (matched) {
          return matched.id;
        }
      }

      // 3. Otherwise: do NOT auto-select any warehouse; require explicit user choice
      return '';
    });
  }, [authorizedWarehouses, contextualWh]);

  const publishedProducts = useMemo(
    () => (products.data ?? []).filter((p) => p.status === 'Published'),
    [products.data],
  );

  const currentWarehouse = authorizedWarehouses.find((w) => w.id === selectedWarehouseId);
  const currentWarehouseCode = currentWarehouse?.code || '';

  const updateRow = (index: number, patch: Partial<FormLine>) => {
    setRows((currentRows) =>
      currentRows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const handleProductChange = (index: number, productId: string) => {
    const prod = publishedProducts.find((p) => p.id === productId);
    updateRow(index, {
      productId,
      sku: prod?.sku || '',
    });
  };

  const getRowError = (r: FormLine): string | null => {
    if (!r.productId) return 'Vui lòng chọn sản phẩm.';
    if (!r.productionDate) return 'Vui lòng nhập ngày sản xuất.';
    if (!r.expirationDate) return 'Vui lòng nhập hạn sử dụng.';
    if (r.productionDate > r.expirationDate) {
      return 'Ngày sản xuất phải trước hoặc bằng hạn sử dụng.';
    }
    const qtyNum = Number(r.quantity);
    if (!qtyNum || qtyNum <= 0) return 'Số lượng nhập phải lớn hơn 0.';
    return null;
  };

  const hasRowErrors = rows.some((r) => getRowError(r) !== null);
  const isFormValid = Boolean(selectedWarehouseId) && rows.length > 0 && !hasRowErrors;

  const handleSubmit = async () => {
    setTried(true);
    if (!isFormValid) return;

    try {
      const payload = {
        warehouseId: selectedWarehouseId,
        lines: rows.map((r) => ({
          productId: r.productId,
          quantity: Number(r.quantity),
          productionDate: r.productionDate,
          expirationDate: r.expirationDate,
          sourceLotCode: r.sourceLotCode.trim() || null,
        })),
      };

      const result = await createMutation.mutateAsync(payload);
      navigate(`/receipts/${result.receiptCode || result.id}`);
    } catch {
      // Error handled by useApiMutation
    }
  };

  return (
    <>
      <PageHeader
        back="/receipts"
        title="Tạo phiếu nhập kho"
        subtitle="Tiếp nhận hàng từ nhà sản xuất. Mỗi dòng hàng sẽ được đối soát và tạo hoặc gộp batch khi được duyệt."
      />

      <Card title="Thông tin chung">
        <div className="form-grid cols-2">
          <FormField
            label="Kho nhận hàng"
            required
            error={tried && !selectedWarehouseId ? 'Vui lòng chọn kho nhận hàng.' : undefined}
          >
            {warehouses.isLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 38,
                  padding: '0 12px',
                  fontSize: 13,
                  color: 'var(--c-muted, #666)',
                  background: 'var(--c-surface-2, #F8F9FA)',
                  borderRadius: 6,
                  border: '1px solid var(--c-border, #E2E8F0)',
                }}
              >
                <span className="spinner spinner-sm" /> Đang tải danh sách kho...
              </div>
            ) : warehouses.isError ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: 38,
                  padding: '0 12px',
                  background: '#FEF2F2',
                  borderRadius: 6,
                  border: '1px solid #FCA5A5',
                }}
              >
                <span style={{ color: '#B42318', fontSize: 13 }}>
                  Không thể tải danh sách kho. Vui lòng thử lại.
                </span>
                <Button size="sm" type="button" onClick={() => warehouses.refetch()}>
                  Thử lại
                </Button>
              </div>
            ) : authorizedWarehouses.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 38,
                  padding: '0 12px',
                  fontSize: 13,
                  borderRadius: 6,
                  background: isKeeper ? '#FEF2F2' : 'var(--c-surface-2, #F8F9FA)',
                  border: isKeeper ? '1px solid #FCA5A5' : '1px solid var(--c-border, #E2E8F0)',
                  color: isKeeper ? '#B42318' : 'var(--c-muted, #666)',
                  fontWeight: 500,
                }}
              >
                {isKeeper
                  ? 'Bạn chưa được phân công kho để nhập hàng.'
                  : 'Hiện không có kho phù hợp để nhập hàng.'}
              </div>
            ) : (
              <Select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                placeholder="Chọn kho..."
                options={authorizedWarehouses.map((w) => ({
                  value: w.id,
                  label: `${w.code} · ${w.name}`,
                }))}
              />
            )}
          </FormField>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              fontSize: 13,
              color: 'var(--c-muted, #666)',
            }}
          >
            Phiếu tạo mới sẽ ở trạng thái <b>Chờ duyệt</b>. Tồn kho vật lý chỉ tăng sau khi phiếu được kiểm tra và phê duyệt.
          </div>
        </div>
      </Card>

      <Card
        title="Danh sách dòng hàng nhập"
        actions={
          <Button size="sm" onClick={() => setRows((r) => [...r, createBlankLine()])}>
            + Thêm dòng
          </Button>
        }
      >
        <div className="stack-sm">
          {rows.map((r, i) => {
            const err = tried ? getRowError(r) : null;
            return (
              <div
                key={i}
                style={{
                  border: '1px solid var(--c-border, #E2E8F0)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  background: '#ffffff',
                }}
              >
                <div
                  className="form-grid"
                  style={{
                    gridTemplateColumns: '2fr 1.2fr 1.2fr 0.9fr 1fr auto',
                    alignItems: 'end',
                    gap: 12,
                  }}
                >
                  <FormField label="Sản phẩm / SKU" required>
                    <SearchSelect
                      value={r.productId}
                      onChange={(productId) => handleProductChange(i, productId)}
                      options={publishedProducts.map((p) => ({
                        value: p.id,
                        label: `${p.sku} · ${p.name}`,
                      }))}
                      placeholder="Chọn sản phẩm..."
                    />
                  </FormField>

                  <FormField label="Ngày sản xuất (NSX)" required>
                    <Input
                      type="date"
                      value={r.productionDate}
                      onChange={(e) => updateRow(i, { productionDate: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Hạn sử dụng (HSD)" required>
                    <Input
                      type="date"
                      value={r.expirationDate}
                      onChange={(e) => updateRow(i, { expirationDate: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Số lượng (thùng)" required>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="0"
                      value={r.quantity}
                      onChange={(e) => updateRow(i, { quantity: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Lô NSX">
                    <Input
                      placeholder="Ví dụ: LOT-2026-A"
                      value={r.sourceLotCode}
                      onChange={(e) => updateRow(i, { sourceLotCode: e.target.value })}
                    />
                  </FormField>

                  <Button
                    size="sm"
                    variant="danger"
                    disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    style={{ marginBottom: 4 }}
                  >
                    Xóa
                  </Button>
                </div>

                {err && (
                  <div style={{ color: 'var(--c-danger, #B42318)', fontSize: 12.5, marginTop: 6, fontWeight: 500 }}>
                    {err}
                  </div>
                )}

                {currentWarehouseCode && r.sku && r.expirationDate && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--c-muted, #666)' }}>
                    Mã batch dự kiến khi duyệt: <b>{IdFormat.batch(currentWarehouseCode, r.sku, r.expirationDate)}</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {tried && !isFormValid && (
        <Callout tone="danger">
          Vui lòng kiểm tra lại thông tin. Đảm bảo đã chọn kho nhận hàng và hoàn tất các dòng hàng với số lượng hợp lệ.
        </Callout>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <Button onClick={() => navigate('/receipts')}>Hủy</Button>
        <Button
          variant="primary"
          loading={createMutation.isPending}
          disabled={!isFormValid || createMutation.isPending}
          onClick={handleSubmit}
        >
          Tạo phiếu nhập
        </Button>
      </div>
    </>
  );
}
