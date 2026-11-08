import { useState } from 'react';

import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { formatDate, formatDateTime } from '@/shared/lib';
import { useBatchQrLabels } from '../hooks';

import { LabelPrintDialog } from './LabelPrintDialog';
import {
  isPrintableLabel,
  labelStatusText,
  type PrintTarget,
} from '../types';

interface Props {
  batchId: string;
  batchCode?: string;
}

function AuthorizedQrLabelsPanel({
  batchId,
  batchCode,
  ownerId,
}: Props & { ownerId: string }) {
  const [target, setTarget] = useState<PrintTarget | null>(null);

  const query = useBatchQrLabels(ownerId, batchId);

  const labels = query.data ?? [];

  const printableCount = labels.filter(
    isPrintableLabel,
  ).length;

  return (
    <section className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2 className="sec">
            Tem QR{batchCode ? ` · ${batchCode}` : ''}
          </h2>

          <div className="muted small">
            In lại dùng mã tem hiện có, không tạo thêm hàng tồn.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <button
            type="button"
            className="btn"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Đang tải…' : 'Tải lại'}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !batchId ||
              query.isFetching ||
              !!query.error ||
              printableCount === 0
            }
            onClick={() => {
              setTarget({ kind: 'batch', batchId });
            }}
          >
            Xem / in cả batch
          </button>
        </div>
      </div>

      {query.isPending ? (
        <p role="status">Đang tải danh sách tem…</p>
      ) : query.error ? (
        <div role="alert">
          <p>{errorMessage(query.error)}</p>
          <p className="muted small">
            Kiểm tra quyền truy cập kho hoặc thử tải lại.
          </p>
        </div>
      ) : labels.length === 0 ? (
        <p className="muted">
          Batch chưa có tem QR.
        </p>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mã tem</th>
                <th>Sản phẩm / batch</th>
                <th>Kho</th>
                <th style={{ textAlign: 'right' }}>Số lượng</th>
                <th>HSD</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {labels.map((label) => {
                const printable = isPrintableLabel(label);

                return (
                  <tr key={label.id}>
                    <td
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      {label.qrCode}
                    </td>

                    <td>
                      <div>
                        {label.sku} · {label.productName}
                      </div>
                      <div className="muted small">
                        {label.batchCode}
                      </div>
                    </td>

                    <td>{label.warehouseCode}</td>

                    <td style={{ textAlign: 'right' }}>
                      {label.quantity.toLocaleString('vi-VN')} thùng
                    </td>

                    <td>{formatDate(label.expirationDate)}</td>

                    <td>
                      {labelStatusText(label.status)}
                    </td>

                    <td>{formatDateTime(label.generatedAt)}</td>

                    <td>
                      <button
                        type="button"
                        className="btn"
                        disabled={!printable || query.isFetching}
                        title={
                          printable
                            ? 'Xem bản in của tem hiện có'
                            : 'Tem đã bị vô hiệu hóa'
                        }
                        onClick={() => {
                          setTarget({
                            kind: 'label',
                            qrCode: label.qrCode,
                          });
                        }}
                      >
                        Xem / in
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <LabelPrintDialog
          key={
            target.kind === 'label'
              ? `label:${target.qrCode}`
              : `batch:${target.batchId}`
          }
          ownerId={ownerId}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </section>
  );
}

export function QrLabelsPanel(props: Props) {
  const { user } = useAuth();

  if (
    !user ||
    !['Admin', 'Operator', 'WarehouseKeeper'].includes(user.role)
  ) {
    return null;
  }

  return (
    <AuthorizedQrLabelsPanel
      key={`${user.id}:${props.batchId}`}
      {...props}
      ownerId={user.id}
    />
  );
}