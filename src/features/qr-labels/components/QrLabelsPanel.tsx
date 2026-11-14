import { useState } from 'react';

import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { formatDate, formatDateTime } from '@/shared/lib';
import { Modal } from '@/shared/ui';
import { useBatchQrLabels } from '../hooks';

import { LabelPrintDialog } from './LabelPrintDialog';
import type { BatchForQrGeneration } from './GenerateQrDialog';
import {
  isPrintableLabel,
  labelStatusText,
  type PrintTarget,
  type QrLabel,
} from '../types';

interface Props {
  batchId: string;
  batchCode?: string;
  /** Kept for API compatibility with callers; not needed now that labels are auto-generated. */
  batch?: BatchForQrGeneration | null;
}

function AuthorizedQrLabelsPanel({
  batchId,
  batchCode,
  ownerId,
}: Props & { ownerId: string }) {
  const { user } = useAuth();
  const [target, setTarget] = useState<PrintTarget | null>(null);
  const [detailLabel, setDetailLabel] = useState<QrLabel | null>(null);

  const query = useBatchQrLabels(ownerId, batchId);

  const labels = query.data ?? [];

  const printableCount = labels.filter(isPrintableLabel).length;

  // QR labels are generated automatically for every received carton when the goods receipt is
  // approved, so this panel only lists, prints and inspects them (no manual generation).
  const canPrint = can(user, 'qr.print');

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
            Mã QR lô hàng{batchCode ? ` · ${batchCode}` : ''}
          </h2>

          <div className="muted small">
            Tem QR được tự sinh cho toàn bộ hàng khi duyệt phiếu nhập kho. In lại dùng mã tem hiện có, không tạo thêm hàng tồn.
            {' '}Tem đã tách giữ số lượng ban đầu để lưu lịch sử; chỉ dùng và in các tem con mới.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >

          {canPrint && (
            <button
              type="button"
              className="btn"
              disabled={
                !batchId ||
                query.isFetching ||
                !!query.error ||
                printableCount === 0
              }
              title={
                printableCount === 0
                  ? 'Chưa có tem QR có thể in'
                  : 'Xem và in toàn bộ tem QR của lô hàng'
              }
              onClick={() => {
                setTarget({ kind: 'batch', batchId });
              }}
            >
              Xem / in cả batch
            </button>
          )}

          <button
            type="button"
            className="btn"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Đang tải…' : 'Tải lại'}
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
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: '#F8FAFC',
            borderRadius: 8,
            border: '1px dashed #CBD5E1',
          }}
        >
          <p
            className="muted"
            style={{ margin: '0 0 12px 0', fontSize: 14 }}
          >
            Chưa có mã QR cho lô hàng này. Tem QR sẽ được tự sinh khi phiếu nhập kho của lô được duyệt.
          </p>
        </div>
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
                      {label.parentQrCode && <div className="muted small">Tách từ {label.parentQrCode}</div>}
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
                      <span
                        className={`chip ${
                          label.status === 'Available'
                            ? 'tone-ok'
                            : label.status === 'Invalidated'
                              ? 'tone-danger'
                              : 'tone-warn'
                        }`}
                      >
                        {labelStatusText(label.status)}
                      </span>
                    </td>

                    <td>{formatDateTime(label.generatedAt)}</td>

                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {canPrint && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={!printable || query.isFetching}
                            title={
                              printable
                                ? 'Xem bản in của tem hiện có'
                                : 'Tem đã hết hiệu lực; hãy in các tem con thay thế'
                            }
                            onClick={() => {
                              setTarget({
                                kind: 'label',
                                qrCode: label.qrCode,
                              });
                            }}
                          >
                            Xem / In
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setDetailLabel(label)}
                          title="Xem chi tiết mã QR"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Print / Preview Dialog */}
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

      {/* QR Details Modal */}
      {detailLabel && (
        <Modal
          open
          title={`Chi tiết mã QR · ${detailLabel.qrCode}`}
          subtitle="Thông tin dữ liệu mã QR chính thức từ hệ thống."
          onClose={() => setDetailLabel(null)}
          width={640}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              {canPrint && isPrintableLabel(detailLabel) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const code = detailLabel.qrCode;
                    setDetailLabel(null);
                    setTarget({ kind: 'label', qrCode: code });
                  }}
                >
                  In nhãn QR
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => setDetailLabel(null)}
              >
                Đóng
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px 16px',
                background: '#F8FAFC',
                padding: '14px',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                fontSize: 13,
              }}
            >
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Mã tem (QR Code):
                </span>
                <strong style={{ fontFamily: 'monospace' }}>{detailLabel.qrCode}</strong>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Trạng thái tem:
                </span>
                <strong>{labelStatusText(detailLabel.status)}</strong>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Lô hàng:
                </span>
                <span>{detailLabel.batchCode}</span>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Kho lưu trữ:
                </span>
                <span>{detailLabel.warehouseCode}</span>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Sản phẩm:
                </span>
                <span>{detailLabel.sku} · {detailLabel.productName}</span>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Số lượng:
                </span>
                <strong>{detailLabel.quantity.toLocaleString('vi-VN')} thùng</strong>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Hạn sử dụng:
                </span>
                <span>{formatDate(detailLabel.expirationDate)}</span>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                  Thời điểm sinh mã:
                </span>
                <span>{formatDateTime(detailLabel.generatedAt)}</span>
              </div>
              {detailLabel.parentQrCode && (
                <div>
                  <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                    Mã tem cha:
                  </span>
                  <span style={{ fontFamily: 'monospace' }}>{detailLabel.parentQrCode}</span>
                </div>
              )}
              {detailLabel.rootQrCode && (
                <div>
                  <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>
                    Mã tem gốc:
                  </span>
                  <span style={{ fontFamily: 'monospace' }}>{detailLabel.rootQrCode}</span>
                </div>
              )}
            </div>

            <div>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                Nội dung mã hóa (QR Payload):
              </span>
              <div
                style={{
                  padding: '10px 12px',
                  background: '#F1F5F9',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  wordBreak: 'break-all',
                  border: '1px solid #CBD5E1',
                  color: '#0F172A',
                }}
              >
                {detailLabel.qrPayload || detailLabel.qrCode}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function QrLabelsPanel(props: Props) {
  const { user } = useAuth();

  if (
    !user ||
    !can(user, 'qr.view')
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
