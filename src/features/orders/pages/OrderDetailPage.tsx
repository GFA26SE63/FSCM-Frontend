import { useState } from 'react';

import {
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
import { useOrderSales } from '../orderSales';
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
    Sku: 'SKU riêng của nhà bán lẻ',
    Category: 'Danh mục của nhà bán lẻ',
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
          {' '}phần lô hàng ·{' '}
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
        empty="Chưa có giá chính thức theo lô hàng."
        columns={[
          {
            header: 'Kho / lô hàng',
            width: '240px',
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
                  HSD còn khi nhận dự kiến:{' '}
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
            Tổng giá theo lô hàng
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

function OrderBody({
  order,
}: {
  order: OrderDetail;
}) {
  const { user } = useAuth();
  const { salesNameOf } = useOrderSales([order.createdByUserId]);

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
              Điều kiện/giá máy chủ
              khác bản tạm tính đã lưu trên máy.
              Giá dự kiến ngoại tuyến:{' '}
              {formatMoney(
                order.offlineEstimatedAmount,
              )}.
            </Callout>
          )}

          {!reconciled && (
            <Callout tone="danger">
              Tổng giá chính thức
              không khớp tổng các
              phần giá theo lô hàng.
              Cần đối soát trước khi thu.
            </Callout>
          )}

          <Card title="Thông tin đơn hàng">
            <Fields
              cols={3}
              items={[
                {
                  label:
                    'Nhà bán lẻ',
                  value:
                    `${order.retailerName} (${order.retailerCode})`,
                },
                {
                  label:
                    'Địa chỉ giao',
                  value:
                    order.deliveryAddress || '—',
                },
                {
                  label:
                    'Ngày yêu cầu nhận',
                  value:
                    order.requestedDeliveryDate
                      ? formatDate(
                          order.requestedDeliveryDate,
                        )
                      : '—',
                },
                {
                  label: 'Nguồn',
                  value:
                    order.source === 'Offline'
                      ? 'Offline'
                      : 'Online',
                },
                {
                  label:
                    'Thanh toán',
                  value:
                    order.paymentMethod
                      ? paymentLabel(
                          order.paymentMethod,
                          order.creditTermDays,
                        )
                      : '—',
                },
                {
                  label:
                    'Kỳ hạn chốt lúc đặt đơn',
                  value:
                    order.paymentMethod === 'Credit' && order.creditTermDays != null
                      ? `${order.creditTermDays} ngày`
                      : '—',
                },
                {
                  label:
                    'Hạn thanh toán',
                  value:
                    order.paymentMethod === 'Credit'
                      ? (order.payment?.dueDate
                          ? formatDate(order.payment.dueDate)
                          : (order.creditTermDays != null
                              ? `Sau khi nhận đủ + ${order.creditTermDays} ngày`
                              : '—'))
                      : '—',
                },
                {
                  label:
                    'Lần phân bổ',
                  value:
                    order.allocationRunCode ??
                    order.allocationRunId ??
                    '—',
                },
                {
                  label:
                    'Kết quả phân bổ',
                  value:
                    statusLabel('allocation', order.allocationResult ?? order.allocationState ?? '—'),
                },
                {
                  label:
                    'Người đặt đơn',
                  value:
                    salesNameOf(order.createdByUserId) || '—',
                },
              ]}
            />
          </Card>

          <Card
            title="Giá dự kiến và giá chính thức"
            flush
          >
            <div style={{ padding: '12px 16px 0 16px' }}>
              <p className="muted small" style={{ margin: 0 }}>
                * Khuyến mãi thương mại tự động áp dụng chương trình có mức chiết khấu cao nhất cho từng SKU (không cộng dồn giữa các CTKM thương mại). Chiết khấu HSD được tính thêm theo từng phần lô phân bổ thực tế bên dưới.
              </p>
            </div>
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
                    'KM thương mại',
                  align: 'right',
                  cell: (line) => (
                    <>
                      −{formatMoney(
                        line.ordinaryPromotionDiscountAmount,
                      )}
                      <br />
                      <span className="muted small">
                        {line.ordinaryPromotion
                          ? `${line.ordinaryPromotion.name} (−${line.ordinaryPromotion.discountPercent}%)`
                          : 'Không có'}
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
                    'Yêu cầu HSD tối thiểu · nguồn',
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
                    ? 'Chưa có kết quả phân bổ'
                    : formatMoney(
                        order.officialAmount,
                      )}
                </b>
              </span>
            </div>
          </Card>

          <Card
            title="Chi tiết giá theo SKU / lô hàng"
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
                    statusLabel('shipment', item.shipmentStatus ?? '—'),
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
