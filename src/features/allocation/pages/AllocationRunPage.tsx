import { useState } from 'react';
import {
  Button,
  Callout,
  Chip,
  FormDialog,
  Input,
  PageHeader,
  QueryState,
  SimpleTable,
  Stat,
  Tabs,
  type Tone,
} from '@/shared/ui';
import { formatMoney, formatNumber } from '@/shared/lib';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { useApprovePlan, useAllocationRun, usePlanVersions, useRequestRecalculation } from '../hooks';
import { PlanOrderDetail } from '../components/PlanOrderDetail';
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

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Admin approves one plan version: the allocation and its price together.
 *
 * There is no per-batch editing. Approving a hand-picked mixture would produce a plan the engine
 * never scored and nobody could reproduce; if the proposal is wrong the answer is to ask for a
 * recalculation with a reason, which supersedes this version rather than editing it.
 *
 * Nothing approves itself. A proposal past its reminder is still a proposal, and no stock is held
 * until someone decides.
 */
export function AllocationRunPage() {
  const [businessDate, setBusinessDate] = useState(today());
  const runQuery = useAllocationRun(businessDate);
  const versionsQuery = usePlanVersions(runQuery.data?.id);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const approve = useApprovePlan();
  const recalculate = useRequestRecalculation();

  const versions = versionsQuery.data ?? [];
  // The live one: a superseded version stays readable, but only one is open for a decision.
  const live = versions.find((v) => v.status === 'AwaitingApproval') ?? versions[0];
  const decidable = live?.status === 'AwaitingApproval';

  return (
    <>
      <PageHeader
        title="Duyệt phương án đợt"
        subtitle="Đợt 12:00 đề xuất phân bổ và giá cho cả ngày. Duyệt là duyệt cả hai; hệ thống không tự duyệt sau hạn."
        actions={
          <Input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
        }
      />

      <QueryState query={runQuery}>
        {(run) => (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <Stat label="Đợt" value={run.runCode} note={`Chốt ${formatInstantDateTime(run.cutoffAt)}`} />
              <Stat label="Đơn trong đợt" value={formatNumber(run.orderCount)} />
              <Stat
                label="Đơn đủ hàng"
                value={formatNumber(live?.fulfilledOrderCount ?? 0)}
                note={live ? `bản ${live.versionNumber}` : undefined}
              />
              <Stat label="Đơn thiếu hàng" value={formatNumber(live?.shortOrderCount ?? 0)} />
              <Stat label="Tổng tiền phương án" value={formatMoney(live?.totalFinalAmount)} />
            </div>

            {run.failureReason && <Callout tone="danger">{run.failureReason}</Callout>}

            <QueryState query={versionsQuery}>
              {() =>
                !live ? (
                  <Callout tone="info">Đợt này chưa có phương án nào được trình duyệt.</Callout>
                ) : (
                  <>
                    <div
                      className="card"
                      style={{ padding: '12px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <strong>Phương án bản {live.versionNumber}</strong>
                      <Chip tone={VERSION_STATUS[live.status].tone}>{VERSION_STATUS[live.status].label}</Chip>
                      <span style={{ fontSize: 13 }}>Định giá lúc {formatInstantDateTime(live.pricedAt)}</span>
                      {live.approvedAt && (
                        <span style={{ fontSize: 13 }}>Duyệt lúc {formatInstantDateTime(live.approvedAt)}</span>
                      )}
                      <span style={{ flex: 1 }} />
                      {decidable && (
                        <>
                          <Button onClick={() => setRecalcOpen(true)}>Yêu cầu tính lại</Button>
                          <Button
                            variant="primary"
                            loading={approve.isPending}
                            onClick={() => approve.mutate({ versionId: live.id, expectedVersion: live.version })}
                          >
                            Duyệt phương án
                          </Button>
                        </>
                      )}
                    </div>

                    {live.recalculationReason && (
                      <Callout tone="info">Lý do yêu cầu tính lại: {live.recalculationReason}</Callout>
                    )}

                    <Callout tone={decidable ? 'warn' : 'neutral'}>
                      {decidable
                        ? 'Chưa giữ hàng. Khi duyệt, hệ thống giữ tồn theo đúng bản này rồi mới phát hành phiếu soạn theo từng kho. Không sửa batch tùy ý: nếu phương án chưa đúng, hãy yêu cầu tính lại kèm lý do.'
                        : 'Bản này không còn mở để quyết định. Bản được duyệt là bản duy nhất chuyển sang giữ tồn.'}
                    </Callout>

                    {versions.length > 1 && (
                      <Tabs
                        variant="pills"
                        value={live.id}
                        onChange={() => undefined}
                        items={versions.map((v) => ({
                          key: v.id,
                          label: `Bản ${v.versionNumber} · ${VERSION_STATUS[v.status].label}`,
                        }))}
                      />
                    )}

                    <SimpleTable
                      columns={[
                        { header: 'Ưu tiên', cell: (o: RunOrder) => `#${formatNumber(o.priorityRank)}`, width: '90px' },
                        { header: 'Đơn', cell: (o: RunOrder) => <strong>{o.orderCode}</strong> },
                        { header: 'Số dòng', cell: (o: RunOrder) => formatNumber(o.lines.length) },
                        {
                          header: 'Kết quả',
                          cell: (o: RunOrder) => <Chip tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Chip>,
                        },
                        {
                          header: '',
                          cell: (o: RunOrder) => (
                            <Button onClick={() => setOpenOrderId(openOrderId === o.id ? null : o.id)}>
                              {openOrderId === o.id ? 'Đóng' : 'Xem SKU / batch'}
                            </Button>
                          ),
                          width: '160px',
                        },
                      ]}
                      rows={run.orders.slice().sort((a, b) => a.priorityRank - b.priorityRank)}
                      empty="Đợt này không nhận đơn nào trước giờ chốt."
                    />

                    {openOrderId && (
                      <PlanOrderDetail
                        order={run.orders.find((o) => o.id === openOrderId) as RunOrder}
                        allocations={live.allocations}
                        prices={live.prices}
                      />
                    )}

                    <FormDialog
                      open={recalcOpen}
                      title={`Yêu cầu tính lại đợt ${run.runCode}`}
                      subtitle="Bản hiện tại được giữ nguyên để đối chiếu; hệ thống tính lại và trình một bản mới."
                      fields={[{ key: 'reason', label: 'Lý do', type: 'textarea', required: true, span: 1 }]}
                      initial={{ reason: '' }}
                      submitLabel="Gửi yêu cầu"
                      columns={1}
                      onClose={() => setRecalcOpen(false)}
                      onSubmit={async (values) => {
                        await recalculate.mutateAsync({
                          versionId: live.id,
                          expectedVersion: live.version,
                          reason: String(values.reason),
                        });
                        setRecalcOpen(false);
                      }}
                      note="Lý do được lưu cùng phiên bản, nên người duyệt sau đọc được vì sao bản trước bị trả lại."
                    />
                  </>
                )
              }
            </QueryState>
          </>
        )}
      </QueryState>
    </>
  );
}
