import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  Button,
  Callout,
  Card,
  ConfirmDialog,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
} from '@/shared/ui';
import { formatCases, formatDate, formatDateTime } from '@/shared/lib';
import { useApproveReceipt, useReceipt } from '../hooks';

export function ReceiptDetailPage() {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useReceipt(code);
  const approveMutation = useApproveReceipt();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const canApprove = can(user, 'receipts.approve');

  return (
    <QueryState query={query}>
      {(receipt) => {
        const isPending = receipt.status === 'Pending';
        const isReceived = receipt.status === 'Received';

        const lines = receipt.lines ?? [];
        const batchLines = lines.filter((line) => Boolean(line.batchId));

        const totalQuantity = lines.reduce(
          (sum, line) => sum + (line.receivedQuantity || 0),
          0,
        );

        const handleApprove = async () => {
          try {
            await approveMutation.mutateAsync(receipt.id);
            await Promise.all([
              query.refetch(),
              queryClient.refetchQueries({ queryKey: ['batches'] }),
              queryClient.refetchQueries({ queryKey: ['inventory'] }),
            ]);
            setConfirmOpen(false);
          } catch {
            // Error handled by useApiMutation
          }
        };

        return (
          <>
            <PageHeader
              back="/receipts"
              title={`Phiếu nhập ${receipt.receiptCode}`}
              subtitle={receipt.warehouseName || receipt.warehouseCode}
              chips={<StatusChip domain="receipt" value={receipt.status} />}
              actions={
                isPending && canApprove ? (
                  <Button
                    variant="primary"
                    loading={approveMutation.isPending}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Duyệt & ghi sổ kho
                  </Button>
                ) : undefined
              }
            />

            <Card title="Thông tin phiếu nhập">
              <Fields
                cols={3}
                items={[
                  {
                    label: 'Kho nhận',
                    value: receipt.warehouseName || receipt.warehouseCode,
                  },
                  {
                    label: 'Thời gian tạo',
                    value: formatDateTime(receipt.createdAt),
                  },
                  {
                    label: 'Trạng thái phiếu',
                    value: <StatusChip domain="receipt" value={receipt.status} />,
                  },
                  {
                    label: 'Ghi sổ tồn kho',
                    value: isReceived ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                          fontSize: 13,
                          color: '#027A48',
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#12B76A',
                          }}
                        />
                        Đã ghi nhận tồn kho vật lý
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 500,
                          fontSize: 13,
                          color: 'var(--c-muted, #666)',
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#94A3B8',
                          }}
                        />
                        Chưa ghi nhận (Chờ duyệt)
                      </span>
                    ),
                  },
                  {
                    label: 'Thời gian ghi sổ kho',
                    value: receipt.receivedAt
                      ? formatDateTime(receipt.receivedAt)
                      : '—',
                  },
                  {
                    label: 'Người tạo phiếu',
                    value: receipt.createdByUserId,
                  },
                  {
                    label: 'Người phê duyệt',
                    value: receipt.approvedByUserId || '—',
                  },
                  {
                    label: 'Thời gian duyệt',
                    value: receipt.approvedAt
                      ? formatDateTime(receipt.approvedAt)
                      : '—',
                  },
                  {
                    label: 'Phiên bản',
                    value: `v${receipt.version}`,
                  },
                  {
                    label: 'Số dòng hàng',
                    value: `${lines.length} dòng`,
                  },
                  {
                    label: 'Tổng số lượng',
                    value: formatCases(totalQuantity),
                  },
                ]}
              />
            </Card>

            <Card title="Chi tiết dòng hàng nhập" flush>
              <SimpleTable
                rows={lines}
                columns={[
                  {
                    header: 'SKU',
                    width: '120px',
                    cell: (line) => <span className="bold">{line.sku}</span>,
                  },
                  {
                    header: 'Sản phẩm',
                    cell: (line) => line.productName,
                  },
                  {
                    header: 'Lô NSX',
                    width: '130px',
                    cell: (line) => line.sourceLotCode || '—',
                  },
                  {
                    header: 'Ngày sản xuất',
                    width: '120px',
                    cell: (line) => formatDate(line.productionDate),
                  },
                  {
                    header: 'Hạn sử dụng',
                    width: '120px',
                    cell: (line) => formatDate(line.expirationDate),
                  },
                  {
                    header: 'Số lượng',
                    width: '110px',
                    align: 'right',
                    cell: (line) => formatCases(line.receivedQuantity),
                  },
                  {
                    header: 'Lô hàng (Batch)',
                    width: '240px',
                    cell: (line) =>
                      line.batchId ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Link
                            to={`/batches/${encodeURIComponent(line.batchId)}`}
                            style={{ fontWeight: 600, color: 'var(--c-primary, #14655B)' }}
                          >
                            {line.batchCode ?? line.batchId}
                          </Link>
                          <span style={{ fontSize: 11.5, color: '#027A48', fontWeight: 500 }}>
                            Đã liên kết batch
                          </span>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>
                          Chưa tạo batch (chờ duyệt)
                        </span>
                      ),
                  },
                  {
                    header: 'Tồn kho vật lý',
                    width: '150px',
                    cell: (line) =>
                      isReceived && line.batchId ? (
                        <span style={{ color: '#027A48', fontWeight: 600, fontSize: 12.5 }}>
                          +{formatCases(line.receivedQuantity)} (Đã ghi sổ)
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>Chưa cộng kho</span>
                      ),
                  },
                ]}
              />
            </Card>

            {isPending && (
              <div style={{ marginTop: 12 }}>
                <Callout tone="info">
                  Phiếu nhập đang ở trạng thái <b>Chờ duyệt</b>. Số lượng chưa được ghi nhận vào kho và chưa khởi tạo mã lô hàng. Khi được phê duyệt bởi người có thẩm quyền, hệ thống sẽ tự động cập nhật số lượng vào tồn kho thực tế và quản lý theo lô hàng tương ứng.
                </Callout>
              </div>
            )}

            {isReceived && (
              <div style={{ marginTop: 12 }}>
                {batchLines.length === lines.length && lines.length > 0 ? (
                  <Callout tone="ok">
                    Phiếu nhập đã được phê duyệt và ghi sổ tồn kho thành công. Nhấn vào mã lô hàng để xem chi tiết lô và thực hiện sinh tem QR.
                  </Callout>
                ) : (
                  <Callout tone="warn">
                    Phiếu đã duyệt nhưng một số dòng hàng đang chờ hệ thống cập nhật mã lô hàng. Vui lòng làm mới trang hoặc kiểm tra lại thông tin tồn kho.
                  </Callout>
                )}
              </div>
            )}

            <ConfirmDialog
              open={confirmOpen}
              title="Xác nhận duyệt phiếu nhập kho"
              confirmLabel={approveMutation.isPending ? 'Đang duyệt…' : 'Duyệt & ghi sổ kho'}
              onConfirm={handleApprove}
              onClose={() => {
                if (!approveMutation.isPending) setConfirmOpen(false);
              }}
              message={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0 }}>
                    Xác nhận duyệt phiếu nhập kho <b>{receipt.receiptCode}</b>?
                  </p>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--c-muted, #555)',
                      padding: '8px 12px',
                      background: 'var(--c-surface-2, #F8F9FA)',
                      borderRadius: 6,
                      lineHeight: 1.6,
                    }}
                  >
                    <div>Kho nhận: <b>{receipt.warehouseName || receipt.warehouseCode}</b></div>
                    <div>Số dòng hàng: <b>{lines.length}</b></div>
                    <div>Tổng số lượng: <b>{formatCases(totalQuantity)}</b></div>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-muted, #666)' }}>
                    Khi duyệt phiếu, hệ thống sẽ chính thức ghi nhận số lượng vào <b>tồn kho thực tế</b> và khởi tạo hoặc cập nhật các lô hàng tương ứng.
                  </p>
                </div>
              }
            />
          </>
        );
      }}
    </QueryState>
  );
}
