import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from '@/shared/router/compat';
import {
  Button,
  Callout,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  FormField,
  PageHeader,
  QueryState,
  Select,
  useToast,
} from '@/shared/ui';
import { formatCases, formatDate, formatLockReason, formatMoney } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { toApiError } from '@/shared/api/errors';
import { useWarehouses } from '@/features/warehouses';
import { Check, Copy } from 'lucide-react';
import { useCreateDisposal, useDisposalCandidates } from '../hooks';
import type { DisposalMethod, DisposalReason } from '../types';

export function DisposalFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  // Read URL query parameters for prefilled batch
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const preselectedBatchCode = searchParams.get('batchCode') || searchParams.get('batchId') || '';
  const preselectedWhId = searchParams.get('warehouseId') || '';

  const isKeeper = user?.role === 'WarehouseKeeper';
  const assignedWhIds = useMemo(() => user?.scope?.warehouseIds ?? [], [user]);
  const assignedWhCode = user?.warehouseCode;

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(preselectedWhId || 'all');
  const [reason, setReason] = useState<DisposalReason>('Hết hạn sử dụng');
  const [method, setMethod] = useState<DisposalMethod>('Tiêu hủy tại kho');
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedBatchCode, setCopiedBatchCode] = useState<string | null>(null);

  // Real backend queries: warehouses list and candidate expired/locked batches
  const { data: warehouses = [] } = useWarehouses();
  const candidatesQuery = useDisposalCandidates();
  const createMutation = useCreateDisposal();

  // Prefill when query data arrives
  useEffect(() => {
    if (preselectedBatchCode && !picked.includes(preselectedBatchCode)) {
      setPicked((prev) => [...prev, preselectedBatchCode]);
    }
  }, [preselectedBatchCode, picked]);

  // Filter candidates by warehouse keeper scope
  const availableCandidates = useMemo(() => {
    const list = candidatesQuery.data ?? [];
    const keeperWhCode = assignedWhCode ? assignedWhCode.toLowerCase() : null;
    if (!isKeeper || (assignedWhIds.length === 0 && !keeperWhCode)) {
      return list;
    }
    return list.filter(
      (c) =>
        (assignedWhIds.length > 0 && assignedWhIds.includes(c.warehouseId)) ||
        (keeperWhCode &&
          (c.warehouseCode.toLowerCase() === keeperWhCode ||
            c.warehouseName.toLowerCase().includes(keeperWhCode))),
    );
  }, [candidatesQuery.data, isKeeper, assignedWhIds, assignedWhCode]);

  // Warehouse options for dropdown: ONLY warehouses containing relevant expired/locked inventory
  const warehouseOptions = useMemo(() => {
    // 1. Identify all warehouses having candidate expired or locked batches in available candidates
    const relevantWhMap = new Map<string, { code: string; name: string }>();
    availableCandidates.forEach((c) => {
      const id = c.warehouseId || c.warehouseCode;
      if (id) {
        relevantWhMap.set(id, {
          code: c.warehouseCode,
          name: c.warehouseName || c.warehouseCode,
        });
      }
    });

    // 2. Match against real active warehouses
    const activeWarehouses = warehouses.filter((w) => w.status === 'Active');
    const matched = new Map<string, string>();

    activeWarehouses.forEach((w) => {
      const wId = w.id || w.code;
      const isRelevant =
        (w.id && relevantWhMap.has(w.id)) ||
        (w.code &&
          availableCandidates.some(
            (c) => c.warehouseCode.toLowerCase() === w.code.toLowerCase(),
          ));

      if (isRelevant && wId) {
        matched.set(wId, `${w.code} · ${w.name}`);
      }
    });

    // Backfill any warehouse present in candidates that might not be in activeWarehouses list
    relevantWhMap.forEach((info, id) => {
      if (!matched.has(id)) {
        matched.set(id, `${info.code} · ${info.name}`);
      }
    });

    // If no eligible warehouses exist, show appropriate empty state option
    if (matched.size === 0) {
      return [{ value: 'all', label: 'Không có kho nào có hàng cần hủy' }];
    }

    const options = [
      { value: 'all', label: 'Tất cả kho' },
      ...Array.from(matched.entries()).map(([value, label]) => ({ value, label })),
    ];

    // If a preselected warehouse is not in matched list, preserve it as an option so user can see it has 0 items and switch
    if (
      selectedWarehouseId !== 'all' &&
      !options.some((o) => o.value === selectedWarehouseId)
    ) {
      options.push({
        value: selectedWarehouseId,
        label: `Kho đã chọn (0 lô cần hủy)`,
      });
    }

    return options;
  }, [availableCandidates, warehouses, selectedWarehouseId]);

  // Filtered rows based on selected warehouse
  const filteredRows = useMemo(() => {
    if (selectedWarehouseId === 'all') return availableCandidates;
    return availableCandidates.filter(
      (c) => c.warehouseId === selectedWarehouseId || c.warehouseCode === selectedWarehouseId,
    );
  }, [availableCandidates, selectedWarehouseId]);

  const togglePick = (code: string, on: boolean) => {
    setPicked((prev) => (on ? (prev.includes(code) ? prev : [...prev, code]) : prev.filter((x) => x !== code)));
  };

  const validSelectable = useMemo(
    () =>
      filteredRows
        .filter((r) => !r.isBlockedByReservation && r.eligibleQuantity > 0)
        .map((r) => r.batchCode),
    [filteredRows],
  );

  const allValidSelected =
    validSelectable.length > 0 && validSelectable.every((c) => picked.includes(c));

  const handleSelectAll = () => {
    if (allValidSelected) {
      setPicked((prev) => prev.filter((c) => !validSelectable.includes(c)));
    } else {
      setPicked((prev) => Array.from(new Set([...prev, ...validSelectable])));
    }
  };

  const pickedRows = useMemo(
    () => availableCandidates.filter((r) => picked.includes(r.batchCode)),
    [availableCandidates, picked],
  );

  const selQty = pickedRows.reduce((sum, r) => sum + r.eligibleQuantity, 0);
  const selVal = pickedRows.reduce((sum, r) => sum + r.value, 0);

  const blockedPickedCount = pickedRows.filter((r) => r.isBlockedByReservation).length;
  const hasErrors = picked.length === 0 || blockedPickedCount > 0;

  const selectedWarehouseLabel = useMemo(() => {
    if (selectedWarehouseId === 'all') {
      const distinctWhNames = Array.from(new Set(pickedRows.map((r) => r.warehouseName)));
      if (distinctWhNames.length === 1) return distinctWhNames[0];
      if (distinctWhNames.length > 1) return `${distinctWhNames.length} kho khác nhau`;
      return 'Tất cả kho';
    }
    const found = warehouseOptions.find((o) => o.value === selectedWarehouseId);
    return found ? found.label : selectedWarehouseId;
  }, [selectedWarehouseId, pickedRows, warehouseOptions]);

  const handleCopyBatchCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopiedBatchCode(code);
      toast.show(`Đã sao chép mã lô: ${code}`);
      setTimeout(() => setCopiedBatchCode(null), 2000);
    }).catch(() => {
      toast.show(`Mã lô: ${code}`);
    });
  };

  const handleOpenConfirm = () => {
    setTried(true);
    setSubmitError(null);
    if (hasErrors) return;
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitError(null);
      const targetWarehouseId =
        selectedWarehouseId !== 'all'
          ? selectedWarehouseId
          : pickedRows[0]?.warehouseId;

      const result = await createMutation.mutateAsync({
        warehouseId: targetWarehouseId,
        batchCodes: picked,
        batchIds: pickedRows.map((r) => r.batchId).filter(Boolean),
        reason,
        method,
      });

      setConfirmOpen(false);
      if (result && (result.id || result.code)) {
        navigate(`/disposal/${encodeURIComponent(result.id || result.code)}`);
      } else {
        navigate('/disposal');
      }
    } catch (err) {
      setConfirmOpen(false);
      const apiErr = toApiError(err);
      setSubmitError(apiErr.detail ? `${apiErr.title}: ${apiErr.detail}` : apiErr.title);
    }
  };

  return (
    <>
      <PageHeader
        back="/disposal"
        title="Lập phiếu hủy hàng (hết hạn / hỏng đã khóa)"
        subtitle="Chọn các lô hàng đã hết hạn hoặc có lượng hàng khóa cần xuất hủy."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top Info Card */}
        <Card title="Thông tin phiếu hủy">
          <div className="form-grid cols-4">
            <FormField label="Kho">
              <Select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                options={warehouseOptions}
              />
            </FormField>

            <FormField label="Lý do *">
              <Select
                value={reason}
                onChange={(e) => setReason(e.target.value as DisposalReason)}
                options={[
                  { value: 'Hết hạn sử dụng', label: 'Hết hạn sử dụng' },
                  { value: 'Hàng hỏng đã khóa', label: 'Hàng hỏng đã khóa' },
                ]}
              />
            </FormField>

            <FormField label="Hình thức xử lý">
              <Select
                value={method}
                onChange={(e) => setMethod(e.target.value as DisposalMethod)}
                options={[
                  { value: 'Tiêu hủy tại kho', label: 'Tiêu hủy tại kho' },
                  { value: 'Trả nhà cung cấp', label: 'Trả nhà cung cấp' },
                ]}
              />
            </FormField>

            <FormField label="Người lập">
              <input
                className="inp"
                value={user?.name || user?.email || 'Nhân viên kho'}
                readOnly
                disabled
              />
            </FormField>
          </div>
        </Card>

        {/* Candidate Batches Card */}
        <Card
          title="Lô hàng hết hạn hoặc đang bị khóa"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                Đã chọn <b>{picked.length}</b> lô · <b>{formatCases(selQty)}</b> ·{' '}
                <b>{formatMoney(selVal)}</b>
              </span>
              <Button
                size="sm"
                onClick={handleSelectAll}
                disabled={validSelectable.length === 0}
              >
                {allValidSelected
                  ? selectedWarehouseId === 'all'
                    ? 'Bỏ chọn tất cả'
                    : 'Bỏ chọn kho này'
                  : selectedWarehouseId === 'all'
                    ? 'Chọn tất cả'
                    : 'Chọn tất cả trong kho'}
              </Button>
            </div>
          }
        >
          <QueryState query={candidatesQuery}>
            {() => (
              <>
                {filteredRows.length === 0 ? (
                  <p className="muted" style={{ margin: '24px 0', textAlign: 'center' }}>
                    Không có lô hàng nào hết hạn hoặc bị khóa cần hủy.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="table" style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--c-border, #E5E7EB)' }}>
                          <th style={{ width: 44, textAlign: 'center', padding: '10px 8px' }}>
                            <Checkbox
                              label=""
                              checked={validSelectable.length > 0 && allValidSelected}
                              disabled={validSelectable.length === 0}
                              onChange={handleSelectAll}
                            />
                          </th>
                          <th style={{ width: 250, padding: '10px 12px' }}>Sản phẩm / SKU</th>
                          <th style={{ width: 140, padding: '10px 12px' }}>Kho</th>
                          <th style={{ width: 170, padding: '10px 12px' }}>Số lô</th>
                          <th style={{ width: 110, padding: '10px 12px' }}>Hạn sử dụng</th>
                          <th style={{ width: 160, padding: '10px 12px' }}>Tình trạng</th>
                          <th style={{ width: 140, textAlign: 'right', padding: '10px 12px' }}>Số lượng cần hủy</th>
                          <th style={{ width: 140, textAlign: 'right', padding: '10px 12px' }}>Giá trị ước tính</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((r) => {
                          const isChecked = picked.includes(r.batchCode);
                          const isBlocked = r.isBlockedByReservation;

                          return (
                            <tr
                              key={r.batchCode}
                              style={{
                                verticalAlign: 'middle',
                                opacity: isBlocked ? 0.65 : 1,
                                background: isChecked ? 'var(--c-surface-2, #F8FAFC)' : undefined,
                                borderBottom: '1px solid var(--c-border, #F1F5F9)',
                                cursor: isBlocked ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.15s ease',
                              }}
                              onClick={(e) => {
                                if (isBlocked) return;
                                if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) return;
                                togglePick(r.batchCode, !isChecked);
                              }}
                            >
                              <td style={{ textAlign: 'center', padding: '12px 8px' }} onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  label=""
                                  checked={isChecked}
                                  disabled={isBlocked}
                                  onChange={(v) => togglePick(r.batchCode, v)}
                                />
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 200 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--c-text-primary, #111827)', lineHeight: 1.35 }}>
                                    {r.productName}
                                  </span>
                                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--c-text-muted, #6B7280)' }}>
                                    {r.sku}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                {r.warehouseName || r.warehouseCode}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: 170 }}>
                                  <span
                                    style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      fontFamily: 'monospace',
                                      fontWeight: 600,
                                      cursor: 'help',
                                      flex: 1,
                                    }}
                                    title={r.batchCode}
                                  >
                                    {r.batchCode}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyBatchCode(r.batchCode, e)}
                                    title={copiedBatchCode === r.batchCode ? 'Đã sao chép' : 'Sao chép mã lô'}
                                    aria-label="Sao chép mã lô"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 3,
                                      cursor: 'pointer',
                                      color: copiedBatchCode === r.batchCode ? '#059669' : 'var(--c-text-muted, #9CA3AF)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      borderRadius: 4,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {copiedBatchCode === r.batchCode ? <Check size={14} /> : <Copy size={14} />}
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                {formatDate(r.expiry)}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {r.isBlockedByReservation ? (
                                  <div>
                                    <Chip
                                      tone="neutral"
                                      title={`Đang giữ ${formatCases(r.reservedQuantity)} cho đơn hàng`}
                                    >
                                      Đang giữ hàng
                                    </Chip>
                                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3 }}>
                                      Giữ {formatCases(r.reservedQuantity)} cho đơn
                                    </div>
                                  </div>
                                ) : r.daysOverdue > 0 ? (
                                  <div>
                                    <Chip tone="danger" title={`Quá hạn ${r.daysOverdue} ngày`}>
                                      Hết hạn
                                    </Chip>
                                    <div style={{ fontSize: 11, color: '#B42318', marginTop: 3, fontWeight: 500 }}>
                                      Quá hạn {r.daysOverdue} ngày
                                    </div>
                                  </div>
                                ) : r.isLocked ? (
                                  <div>
                                    <Chip tone="warn" title={r.lockReason ? `Lý do khóa: ${formatLockReason(r.lockReason)}` : undefined}>
                                      Đang khóa
                                    </Chip>
                                    {r.lockReason && (
                                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3 }}>
                                        {formatLockReason(r.lockReason)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <Chip tone="danger">Hết hạn</Chip>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {formatCases(r.eligibleQuantity)}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                {formatMoney(r.value)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </QueryState>
        </Card>

        {tried && blockedPickedCount > 0 && (
          <Callout tone="danger">
            Có lô hàng đang giữ hàng cho đơn hàng của khách. Vui lòng bỏ chọn hoặc xử lý đơn hàng trước khi xuất hủy để tránh âm kho.
          </Callout>
        )}

        {tried && picked.length === 0 && (
          <Callout tone="danger">Vui lòng chọn ít nhất một lô hàng để lập phiếu hủy.</Callout>
        )}

        {submitError && (
          <Callout tone="danger">
            {submitError}
          </Callout>
        )}

        {/* Footer Actions */}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button onClick={() => navigate('/disposal')}>Hủy</Button>
          <Button
            variant="primary"
            style={{ background: '#B42318', borderColor: '#B42318' }}
            disabled={picked.length === 0}
            loading={createMutation.isPending}
            onClick={handleOpenConfirm}
          >
            Xác nhận hủy ({picked.length} lô)
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog Before Submitting Write-off */}
      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận gửi phiếu hủy"
        confirmLabel="Xác nhận gửi phiếu"
        cancelLabel="Quay lại"
        danger
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        message={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <p style={{ margin: 0, color: 'var(--c-text-muted)' }}>
              Bạn có chắc chắn muốn gửi phiếu hủy cho các lô hàng đã chọn? Sau khi gửi, phiếu sẽ được chuyển đến người có thẩm quyền phê duyệt và cập nhật tồn kho.
            </p>
            <div
              style={{
                background: 'var(--c-surface-2)',
                padding: '12px 16px',
                borderRadius: 6,
                display: 'grid',
                gridTemplateColumns: '140px 1fr',
                gap: '8px 12px',
              }}
            >
              <span style={{ color: 'var(--c-text-muted)' }}>Kho xuất hủy:</span>
              <span style={{ fontWeight: 600 }}>{selectedWarehouseLabel}</span>

              <span style={{ color: 'var(--c-text-muted)' }}>Số lô đã chọn:</span>
              <span style={{ fontWeight: 600 }}>{picked.length} lô</span>

              <span style={{ color: 'var(--c-text-muted)' }}>Tổng số lượng:</span>
              <span style={{ fontWeight: 600, color: '#B42318' }}>{formatCases(selQty)}</span>

              <span style={{ color: 'var(--c-text-muted)' }}>Tổng giá trị:</span>
              <span style={{ fontWeight: 600 }}>{formatMoney(selVal)}</span>

              <span style={{ color: 'var(--c-text-muted)' }}>Lý do hủy:</span>
              <span>{reason}</span>

              <span style={{ color: 'var(--c-text-muted)' }}>Hình thức xử lý:</span>
              <span>{method}</span>
            </div>
          </div>
        }
      />
    </>
  );
}
