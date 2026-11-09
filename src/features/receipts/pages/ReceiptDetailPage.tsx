import { useState } from 'react';

import {
  Link,
  useParams,
} from '@/shared/router/compat';

import {
  Card,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
} from '@/shared/ui';

import {
  formatCases,
  formatDate,
  formatDateTime,
} from '@/shared/lib';

import { QrLabelsPanel } from '@/features/qr-labels';

import { useReceipt } from '../hooks';

function receiptStatusText(status: string): string {
  const labels: Record<string, string> = {
    Draft: 'Nháp',
    Pending: 'Chờ duyệt',
    PendingApproval: 'Chờ duyệt',
    Approved: 'Đã duyệt',
    Received: 'Đã nhập kho',
    Posted: 'Đã ghi nhận',
    Rejected: 'Đã từ chối',
    Cancelled: 'Đã hủy',
  };

  return labels[status] ?? status;
}

export function ReceiptDetailPage() {
  const { code = '' } = useParams();
  const query = useReceipt(code);

  const [selection, setSelection] = useState<{
    receiptId: string;
    batchId: string;
  } | null>(null);

  return (
    <QueryState query={query}>
      {(receipt) => {
        const batchLines = receipt.lines.filter(
          (line) => Boolean(line.batchId),
        );

        const selectedLine =
          (
            selection?.receiptId === receipt.id
              ? batchLines.find(
                  (line) => line.batchId === selection.batchId,
                )
              : undefined
          ) ?? batchLines[0];

        const totalQuantity = receipt.lines.reduce(
          (sum, line) => sum + line.receivedQuantity,
          0,
        );

        return (
          <>
            <PageHeader
              back="/receipts"
              title={`Phiếu nhập ${receipt.receiptCode}`}
              subtitle={receipt.warehouseName}
              chips={
                <span className="chip">
                  {receiptStatusText(receipt.status)}
                </span>
              }
            />

            <Card title="Thông tin">
              <Fields
                cols={3}
                items={[
                  {
                    label: 'Kho nhận',
                    value: receipt.warehouseName,
                  },
                  {
                    label: 'Thời gian tạo',
                    value: formatDateTime(receipt.createdAt),
                  },
                  {
                    label: 'Thời gian nhập',
                    value: receipt.receivedAt
                      ? formatDateTime(receipt.receivedAt)
                      : '—',
                  },
                  {
                    label: 'Người tạo (ID)',
                    value: receipt.createdByUserId,
                  },
                  {
                    label: 'Thời gian duyệt',
                    value: receipt.approvedAt
                      ? formatDateTime(receipt.approvedAt)
                      : '—',
                  },
                  {
                    label: 'Tổng số lượng',
                    value: formatCases(totalQuantity),
                  },
                ]}
              />
            </Card>

            <Card title="Chi tiết nhập hàng" flush>
              <SimpleTable
                rows={receipt.lines}
                columns={[
                  {
                    header: 'SKU',
                    cell: (line) => line.sku,
                  },
                  {
                    header: 'Sản phẩm',
                    cell: (line) => line.productName,
                  },
                  {
                    header: 'Batch',
                    cell: (line) =>
                      line.batchId ? (
                        <Link
                          to={`/batches/${encodeURIComponent(line.batchId)}`}
                          style={{ fontWeight: 600 }}
                        >
                          {line.batchCode ?? line.batchId}
                        </Link>
                      ) : (
                        <span className="muted">
                          Chưa tạo batch
                        </span>
                      ),
                  },
                  {
                    header: 'NSX',
                    cell: (line) =>
                      formatDate(line.productionDate),
                  },
                  {
                    header: 'HSD',
                    cell: (line) =>
                      formatDate(line.expirationDate),
                  },
                  {
                    header: 'Lô NSX',
                    cell: (line) =>
                      line.sourceLotCode || '—',
                  },
                  {
                    header: 'Số lượng',
                    align: 'right',
                    cell: (line) =>
                      formatCases(line.receivedQuantity),
                  },
                  {
                    header: 'Tem QR',
                    cell: (line) => (
                      <button
                        type="button"
                        className="btn"
                        disabled={!line.batchId}
                        onClick={() => {
                          if (!line.batchId) return;

                          setSelection({
                            receiptId: receipt.id,
                            batchId: line.batchId,
                          });
                        }}
                      >
                        Xem tem
                      </button>
                    ),
                  },
                ]}
              />
            </Card>

            {selectedLine?.batchId ? (
              <QrLabelsPanel
                batchId={selectedLine.batchId}
                batchCode={
                  selectedLine.batchCode ?? undefined
                }
              />
            ) : (
              <Card title="Tem QR">
                <p className="muted">
                  Phiếu chưa có batch để tra cứu tem QR.
                </p>
              </Card>
            )}
          </>
        );
      }}
    </QueryState>
  );
}