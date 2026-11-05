import { useState } from 'react';

import {
  useNavigate,
  useParams,
} from '@/shared/router/compat';
import {
  useAuth,
} from '@/shared/auth/AuthContext';
import {
  can,
} from '@/shared/auth/permissions';
import {
  Button,
  Callout,
  Card,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
} from '@/shared/ui';
import {
  formatCases,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
  formatPercent,
  paymentLabel,
  statusLabel,
} from '@/shared/lib';
import { useOrder } from '../hooks';
import {
  AllocationTraceDialog,
} from '../components/AllocationTraceDialog';
import {
  OrderActions,
} from '../components/OrderActions';
import {
  hasReconciledOfficialTotal,
  officialFragmentTotal,
} from '../priceBreakdown';
import type {
  OrderDetail,
  OrderLine,
  OrderLineMlor,
} from '../types';

const MLOR_SOURCES:
  Record<
    OrderLineMlor['sourceScope'],
    string
  > = {
    Sku: 'SKU riêng của retailer',
    Category: 'Category của retailer',
    Default: 'Mặc định sản phẩm',
  };

function PriceBreakdown({
  line,
}: {
  line: OrderLine;
}) {
  return (
    <details
      open={
        line.allocationFragments
          .length > 0
      }
      style={{
        borderTop:
          '1px solid var(--c-border)',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          padding: '12px 16px',
        }}
      >
        <b>
          Dòng {line.lineNumber}
          {' · '}{line.sku}
          {' · '}{line.productName}
        </b>
        {' '}
        <span className="muted">
          —{' '}
          {
            line.allocationFragments
              .length
          }
          {' '}phần batch ·{' '}
          {formatMoney(
            line.officialNetAmount ??
              line.indicativeNetAmount,
          )}
        </span>
      </summary>

      <SimpleTable
        compact
        rows={
          line.allocationFragments
        }
        empty="Chưa có giá chính thức theo batch."
        columns={[
          {
            header: 'Kho / batch',
            cell: (item) => (
              <>
                {item.warehouseCode}
                <br />
                <b>
                  {item.batchCode}
                </b>
                <br />
                <span className="muted small">
                  HSD{' '}
                  {formatDate(
                    item.batchExpirationDate,
                  )}
                </span>
              </>
            ),
          },
          {
            header: 'Lượng',
            align: 'right',
            cell: (item) =>
              formatCases(
                item.quantity,
              ),
          },
          {
            header:
              'Giá niêm yết',
            align: 'right',
            cell: (item) =>
              formatMoney(
                item.listUnitPrice,
              ),
          },
          {
            header: 'KM thường',
            align: 'right',
            cell: (item) => (
              <>
                −{formatMoney(
                  item.ordinaryPromotionDiscountPerUnit,
                )}
                <br />
                <span className="muted small">
                  Cơ sở{' '}
                  {formatMoney(
                    item.baseUnitPrice,
                  )}
                </span>
              </>
            ),
          },
          {
            header:
              'HSD tại mốc giá',
            align: 'right',
            cell: (item) => (
              <>
                {formatPercent(
                  item.remainingShelfLifePercent,
                  2,
                )}
                <br />
                <span className="muted small">
                  ETA còn{' '}
                  {formatHours(
                    item.remainingLifeHoursAtArrival,
                  )}
                </span>
              </>
            ),
          },
          {
            header:
              'Quy tắc giảm HSD',
            cell: (item) => (
              <>
                {item.discountRuleId ==
                null
                  ? 'Không khớp bậc giảm'
                  : [
                      item.discountRuleScope,
                      item.discountRuleCode,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                <br />
                <span className="muted small">
                  v{
                    item.discountRuleVersion
                  }
                  {' · '}
                  {item.discountReason}
                </span>
              </>
            ),
          },
          {
            header: 'Giảm HSD',
            align: 'right',
            cell: (item) => (
              <>
                −{formatMoney(
                  item.shelfLifeDiscountPerUnit,
                )}
                <br />
                <span className="muted small">
                  {item.discountType ??
                    'Không giảm'}
                  {item.discountValue ==
                  null
                    ? ''
                    : ` · ${item.discountValue}`}
                </span>
              </>
            ),
          },
          {
            header: 'Giá cuối',
            align: 'right',
            cell: (item) => (
              <>
                <b>
                  {formatMoney(
                    item.finalUnitPrice,
                  )}
                </b>
                <br />
                <span className="muted small">
                  {formatMoney(
                    item.netAmount,
                  )}
                </span>
              </>
            ),
          },
        ]}
      />

      {line.allocationFragments
        .length > 0 && (
        <div
          className="kv"
          style={{
            padding:
              '10px 16px',
          }}
        >
          <span className="muted">
            Tổng giá theo batch
            của dòng
          </span>
          <b>
            {formatMoney(
              officialFragmentTotal(
                line,
              ),
            )}
          </b>
        </div>
      )}
    </details>
  );
}

function WorkflowLinks({
  order,
}: {
  order: OrderDetail;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (
    !can(user, 'allocation.view')
  ) {
    return null;
  }

  return (
    <div className="row-wrap">
      {order.allocationRunId && (
        <Button
          onClick={() =>
            navigate('/allocation')
          }
        >
          Giám sát phân bổ
        </Button>
      )}

      {order.warehouseProgress.some(
        (item) =>
          item.pickingListId,
      ) && (
        <Button
          onClick={() =>
            navigate('/runpicking')
          }
        >
          Theo dõi soạn hàng
        </Button>
      )}

      {order.officialAmount !=
        null && (
        <Button
          onClick={() =>
            navigate('/debts')
          }
        >
          Thanh toán / công nợ
        </Button>
      )}
    </div>
  );
}

function OrderBody({
  order,
}: {
  order: OrderDetail;
}) {
  const { user } = useAuth();

  const [trace, setTrace] =
    useState(false);

  const canViewTrace = can(
    user,
    'allocation.view',
  );

  const reconciled =
    hasReconciledOfficialTotal(
      order,
    );

  return (
    <OrderActions>
      {({
        buttons,
        dialogs,
      }) => (
        <>
          <PageHeader
            back="/orders"
            title={
              `Đơn ${order.orderCode}`
            }
            subtitle={
              `${order.retailerName} · ${order.retailerCode} · tạo ${formatDateTime(order.createdAt)}`
            }
            chips={
              <StatusChip
                domain="order"
                value={
                  order.status
                }
              />
            }
            actions={
              <div className="row-wrap">
                {canViewTrace && (
                  <Button
                    onClick={() =>
                      setTrace(true)
                    }
                  >
                    Giải thích phân bổ
                  </Button>
                )}

                {buttons(
                  {
                    id: order.id,
                    orderCode:
                      order.orderCode,
                    status:
                      order.status,
                    version:
                      order.version,
                  },
                  'md',
                )}
              </div>
            }
          />

          {order.rejectionReason && (
            <Callout tone="danger">
              <b>
                Lý do xử lý:
              </b>
              {' '}
              {order.rejectionReason}
            </Callout>
          )}

          {order.hasOfflineDifference && (
            <Callout tone="warn">
              Điều kiện/giá server
              khác snapshot offline.
              Giá dự kiến offline:{' '}
              {formatMoney(
                order.offlineEstimatedAmount,
              )}.
            </Callout>
          )}

          {!reconciled && (
            <Callout tone="danger">
              Tổng giá chính thức
              không khớp tổng các
              phần giá theo batch.
              Cần đối soát trước khi thu.
            </Callout>
          )}

          <Card title="Thông tin đơn hàng">
            <Fields
              cols={3}
              items={[
                {
                  label:
                    'Retailer',
                  value:
                    `${order.retailerName} (${order.retailerCode})`,
                },
                {
                  label:
                    'Địa chỉ giao',
                  value:
                    order.deliveryAddress,
                },
                {
                  label:
                    'Ngày yêu cầu nhận',
                  value:
                    formatDate(
                      order.requestedDeliveryDate,
                    ),
                },
                {
                  label: 'Nguồn',
                  value:
                    order.source ===
                    'Offline'
                      ? 'Offline gửi thủ công'
                      : 'Sales tạo online',
                },
                {
                  label:
                    'Thanh toán',
                  value:
                    paymentLabel(
                      order.paymentMethod,
                      order.creditTermDays,
                    ),
                },
                {
                  label:
                    'Lần phân bổ',
                  value:
                    order.allocationRunCode ??
                    order.allocationRunId ??
                    'Chưa có mã lần xử lý',
                },
                {
                  label:
                    'Kết quả phân bổ',
                  value:
                    order.allocationResult ??
                    order.allocationState,
                },
                {
                  label:
                    'Người tạo',
                  value:
                    order.createdByUserId,
                },
              ]}
            />
          </Card>

          <Card
            title="Giá dự kiến và giá chính thức"
            flush
          >
            <SimpleTable
              rows={order.lines}
              columns={[
                {
                  header: '#',
                  width: '40px',
                  cell: (line) =>
                    line.lineNumber,
                },
                {
                  header:
                    'SKU / sản phẩm',
                  cell: (line) => (
                    <>
                      <b>
                        {line.sku}
                      </b>
                      <br />
                      <span className="muted small">
                        {line.productName}
                      </span>
                    </>
                  ),
                },
                {
                  header: 'SL',
                  align: 'right',
                  cell: (line) =>
                    formatCases(
                      line.quantity,
                    ),
                },
                {
                  header:
                    'Giá niêm yết',
                  align: 'right',
                  cell: (line) =>
                    formatMoney(
                      line.unitPrice,
                    ),
                },
                {
                  header:
                    'KM thường',
                  align: 'right',
                  cell: (line) => (
                    <>
                      −{formatMoney(
                        line.discountAmount,
                      )}
                      <br />
                      <span className="muted small">
                        {line.ordinaryPromotion
                          ?.code ??
                          'Không có'}
                      </span>
                    </>
                  ),
                },
                {
                  header:
                    'Giá dự kiến',
                  align: 'right',
                  cell: (line) =>
                    formatMoney(
                      line.indicativeNetAmount,
                    ),
                },
                {
                  header:
                    'Giá chính thức',
                  align: 'right',
                  cell: (line) =>
                    line.officialNetAmount ==
                    null
                      ? 'Chưa chốt'
                      : formatMoney(
                          line.officialNetAmount,
                        ),
                },
                {
                  header:
                    'MLOR · nguồn',
                  cell: (line) => (
                    <>
                      {formatPercent(
                        line.mlor
                          .minimumLifeRatio *
                          100,
                        1,
                      )}

                      {line.mlor
                        .minimumLifeHours !=
                        null && (
                        <>
                          {' · ≥ '}
                          {formatHours(
                            line.mlor
                              .minimumLifeHours,
                          )}
                        </>
                      )}

                      <br />
                      <span className="muted small">
                        {
                          MLOR_SOURCES[
                            line.mlor
                              .sourceScope
                          ]
                        }
                        {' · v'}
                        {
                          line.mlor
                            .sourceVersion
                        }
                      </span>
                    </>
                  ),
                },
              ]}
            />

            <div
              className="kv"
              style={{
                padding:
                  '12px 16px',
              }}
            >
              <span>
                Dự kiến:{' '}
                <b>
                  {formatMoney(
                    order.indicativeAmount,
                  )}
                </b>
              </span>

              <span>
                Chính thức:{' '}
                <b>
                  {order.officialAmount ==
                  null
                    ? 'Chưa có kết quả allocation'
                    : formatMoney(
                        order.officialAmount,
                      )}
                </b>
              </span>
            </div>
          </Card>

          <Card
            title="Chi tiết giá theo SKU / batch"
            flush
          >
            {order.lines.map(
              (line) => (
                <PriceBreakdown
                  key={line.id}
                  line={line}
                />
              ),
            )}
          </Card>

          <Card
            title="Tiến độ theo kho"
            flush
          >
            <SimpleTable
              rows={
                order.warehouseProgress
              }
              empty="Chưa phát sinh phần giao theo kho."
              columns={[
                {
                  header: 'Kho',
                  cell: (item) =>
                    item.warehouseCode,
                },
                {
                  header:
                    'Phiếu soạn',
                  cell: (item) =>
                    item.pickingCode ??
                    '—',
                },
                {
                  header:
                    'Trạng thái soạn',
                  cell: (item) =>
                    item.pickingStatus ??
                    '—',
                },
                {
                  header:
                    'Phần giao',
                  cell: (item) =>
                    item.shipmentCode ??
                    '—',
                },
                {
                  header:
                    'Trạng thái giao',
                  cell: (item) =>
                    item.shipmentStatus ??
                    '—',
                },
                {
                  header:
                    'Dự kiến',
                  align: 'right',
                  cell: (item) =>
                    formatCases(
                      item.plannedQuantity,
                    ),
                },
                {
                  header:
                    'Đã soạn',
                  align: 'right',
                  cell: (item) =>
                    formatCases(
                      item.pickedQuantity,
                    ),
                },
                {
                  header:
                    'Đã nhận',
                  align: 'right',
                  cell: (item) =>
                    formatCases(
                      item.receivedQuantity,
                    ),
                },
              ]}
            />
          </Card>

          <Card title="Nghiệp vụ liên quan">
            <WorkflowLinks
              order={order}
            />
          </Card>

          <Card title="Lịch sử xử lý">
            <div className="timeline">
              {[...order.history]
                .reverse()
                .map(
                  (
                    event,
                    index,
                  ) => (
                    <div
                      className="timeline-item"
                      key={
                        `${event.changedAt}-${index}`
                      }
                    >
                      <span className="t">
                        {formatDateTime(
                          event.changedAt,
                        )}
                      </span>

                      <span>
                        {statusLabel(
                          'order',
                          event.toStatus,
                        )}

                        {event.reason
                          ? ` · ${event.reason}`
                          : ''}
                      </span>
                    </div>
                  ),
                )}
            </div>
          </Card>

          {dialogs}

          {canViewTrace && (
            <AllocationTraceDialog
              order={order}
              open={trace}
              onClose={() =>
                setTrace(false)
              }
            />
          )}
        </>
      )}
    </OrderActions>
  );
}

export function OrderDetailPage() {
  const {
    orderId = '',
  } = useParams();

  const query =
    useOrder(orderId);

  return (
    <QueryState query={query}>
      {(order) => (
        <OrderBody
          order={order}
        />
      )}
    </QueryState>
  );
}