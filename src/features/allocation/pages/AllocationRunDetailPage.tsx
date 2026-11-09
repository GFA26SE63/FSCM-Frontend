import { useState } from 'react';
import { useParams } from '@/shared/router/compat';
import {
  Button, Callout, Chip, FormDialog, PageHeader, QueryState, SimpleTable, Stat, Tabs, type Tone,
} from '@/shared/ui';
import { formatMoney, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import {
  useIssuePicking, useAllocationRunDetail, useApprovePlan, useCloseAllocationRun, usePlanVersions, useRequestRecalculation,
} from '../hooks';
import { PlanOrderDetail } from '../components/PlanOrderDetail';
import { AllocationTraceDialog } from '@/features/orders/components/AllocationTraceDialog';
import type { PlanVersion, RunOrder } from '../types';

const VERSION_STATUS: Record<PlanVersion['status'], { tone: Tone; label: string }> = {
  AwaitingApproval: { tone: 'warn', label: 'Chờ duyệt' },
  Approved: { tone: 'success', label: 'Đã duyệt' },
  RecalculationRequested: { tone: 'info', label: 'Đã yêu cầu tính lại' },
  Superseded: { tone: 'neutral', label: 'Đã bị thay thế' },
};

const ORDER_STATUS: Record<RunOrder['status'], { tone: Tone; label: string }> = {
  Pending: { tone: 'neutral', label: 'Chưa xử lý' },
  Fulfilled: { tone: 'success', label: 'Đủ hàng' },
  Short: { tone: 'danger', label: 'Thiếu hàng' },
};

export function AllocationRunDetailPage() {
  const { id = '' } = useParams();
  const issuePicking = useIssuePicking();
  const runQuery = useAllocationRunDetail(id);
  const versionsQuery = usePlanVersions(id);
  const [selectedVersionId, setSelectedVersionId] = useState<string>();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [traceOrder, setTraceOrder] = useState<{ id: string; code: string } | null>(null);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const approve = useApprovePlan();
  const recalculate = useRequestRecalculation();
  const closeRun = useCloseAllocationRun();

  return (
    <QueryState query={runQuery}>
      {(run) => (
        <QueryState query={versionsQuery}>
          {(versions) => {
            const live = versions.find((version) => version.status === 'AwaitingApproval');
            const selected = versions.find((version) => version.id === selectedVersionId) ?? live ?? versions[0];
            const decidable = selected?.id === live?.id && selected?.status === 'AwaitingApproval';
            return (
              <>
                <PageHeader
                  back="/allocation"
                  title={run.runCode}
                  subtitle={`Đợt ngày ${run.businessDate} · bắt đầu ${formatInstantDateTime(run.startedAt)}`}
                  actions={selected && decidable ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button onClick={() => setRecalcOpen(true)}>Yêu cầu tính lại</Button>
                      <Button
                        variant="primary"
                        loading={approve.isPending}
                        onClick={() => approve.mutate({ versionId: selected.id, expectedVersion: selected.version })}
                      >
                        Duyệt phương án
                      </Button>
                    </div>
                  ) : run.status === 'Approved' ? (
                    <div className="row-wrap">
                      <Button variant="primary" loading={issuePicking.isPending} onClick={() => issuePicking.mutate(run.id)}>Sinh / bổ sung phiếu nhặt</Button>
                      <Button onClick={() => setCloseOpen(true)}>Đóng đợt</Button>
                    </div>
                  ) : undefined}
                />

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Stat label="Đơn trong đợt" value={formatNumber(run.orderCount)} />
                  <Stat label="Đơn đủ hàng" value={formatNumber(selected?.fulfilledOrderCount ?? 0)} note={selected ? `bản ${selected.versionNumber}` : undefined} />
                  <Stat label="Đơn thiếu hàng" value={formatNumber(selected?.shortOrderCount ?? 0)} />
                  <Stat label="Tổng tiền phương án" value={formatMoney(selected?.totalFinalAmount)} />
                </div>

                {run.failureReason && <Callout tone="danger">{run.failureReason}</Callout>}
                {!selected ? (
                  <Callout tone="info">Đợt này chưa có phương án nào được trình duyệt.</Callout>
                ) : (
                  <>
                    <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>Phương án bản {selected.versionNumber}</strong>
                      <Chip tone={VERSION_STATUS[selected.status].tone}>{VERSION_STATUS[selected.status].label}</Chip>
                      <span style={{ fontSize: 13 }}>Định giá lúc {formatInstantDateTime(selected.pricedAt)}</span>
                      {selected.approvedAt && <span style={{ fontSize: 13 }}>Duyệt lúc {formatInstantDateTime(selected.approvedAt)}</span>}
                    </div>

                    {versions.length > 1 && (
                      <Tabs
                        variant="pills"
                        value={selected.id}
                        onChange={setSelectedVersionId}
                        items={versions.map((version) => ({
                          key: version.id,
                          label: `Bản ${version.versionNumber} · ${VERSION_STATUS[version.status].label}`,
                        }))}
                      />
                    )}

                    {selected.recalculationReason && <Callout tone="info">Lý do tính lại: {selected.recalculationReason}</Callout>}
                    <Callout tone={decidable ? 'warn' : 'neutral'}>
                      {decidable
                        ? 'Chưa giữ hàng. Duyệt phương án sẽ giữ tồn theo đúng bản này và phát hành báo giá; chỉ tạo phiếu soạn sau khi SO đủ điều kiện thành PO.'
                        : 'Đây là bản chỉ đọc để đối chiếu. Chỉ bản chờ duyệt hiện hành mới được phê duyệt và giữ tồn.'}
                    </Callout>

                    <Callout tone="info">
                      Chọn <strong>Quá trình B1–B4</strong> ở từng đơn để xem hệ thống lọc batch, kiểm tra tuyến và MLOR,
                      chấm điểm, xếp hạng rồi lấy số lượng theo từng lượt. Các batch bị loại vẫn được hiển thị kèm lý do.
                    </Callout>

                    <SimpleTable
                      rows={run.orders.slice().sort((a, b) => a.priorityRank - b.priorityRank)}
                      empty="Đợt này không nhận đơn nào trước giờ chốt."
                      columns={[
                        { header: 'Ưu tiên', width: '90px', cell: (order: RunOrder) => `#${formatNumber(order.priorityRank)}` },
                        { header: 'Đơn', cell: (order: RunOrder) => <strong>{order.orderCode}</strong> },
                        { header: 'Số dòng', cell: (order: RunOrder) => formatNumber(order.lines.length) },
                        { header: 'Kết quả', cell: (order: RunOrder) => <Chip tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Chip> },
                        {
                          header: '', width: '300px', cell: (order: RunOrder) => (
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <Button onClick={() => setOpenOrderId(openOrderId === order.id ? null : order.id)}>
                                {openOrderId === order.id ? 'Đóng kết quả' : 'Kết quả batch'}
                              </Button>
                              <Button variant="primary" onClick={() => setTraceOrder({ id: order.salesOrderId, code: order.orderCode })}>
                                Quá trình B1–B4
                              </Button>
                            </div>
                          ),
                        },
                      ]}
                    />

                    {openOrderId && run.orders.some((order) => order.id === openOrderId) && (
                      <PlanOrderDetail
                        order={run.orders.find((order) => order.id === openOrderId) as RunOrder}
                        allocations={selected.allocations}
                        prices={selected.prices}
                      />
                    )}

                    <FormDialog
                      open={recalcOpen}
                      title={`Yêu cầu tính lại ${run.runCode}`}
                      fields={[{ key: 'reason', label: 'Lý do', type: 'textarea', required: true, span: 1 }]}
                      initial={{ reason: '' }}
                      submitLabel="Gửi yêu cầu"
                      columns={1}
                      onClose={() => setRecalcOpen(false)}
                      onSubmit={async (values) => {
                        await recalculate.mutateAsync({
                          versionId: selected.id, expectedVersion: selected.version, reason: String(values.reason),
                        });
                        setRecalcOpen(false);
                      }}
                    />
                    <FormDialog
                      open={closeOpen}
                      title={`Đóng đợt ${run.runCode}`}
                      fields={[{ key: 'reason', label: 'Ghi chú', type: 'textarea', required: false, span: 1 }]}
                      initial={{ reason: '' }}
                      submitLabel="Đóng đợt"
                      columns={1}
                      onClose={() => setCloseOpen(false)}
                      onSubmit={async (values) => {
                        await closeRun.mutateAsync({
                          runId: run.id, expectedVersion: run.version,
                          reason: String(values.reason ?? '').trim() || undefined,
                        });
                        setCloseOpen(false);
                      }}
                    />
                    {traceOrder && (
                      <AllocationTraceDialog
                        orderId={traceOrder.id}
                        code={traceOrder.code}
                        open
                        onClose={() => setTraceOrder(null)}
                      />
                    )}
                  </>
                )}
              </>
            );
          }}
        </QueryState>
      )}
    </QueryState>
  );
}
