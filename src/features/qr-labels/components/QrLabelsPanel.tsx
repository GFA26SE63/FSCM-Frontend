import { useState } from 'react';

import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { formatDate, formatDateTime } from '@/shared/lib';
import { Modal } from '@/shared/ui';
import { useBatchQrLabels, useBatchInventory } from '../hooks';

import { LabelPrintDialog } from './LabelPrintDialog';
import { GenerateQrDialog, type BatchForQrGeneration } from './GenerateQrDialog';
import {
  isPrintableLabel,
  labelStatusText,
  type PrintTarget,
  type QrLabel,
} from '../types';

interface Props {
  batchId: string;
  batchCode?: string;
  batch?: BatchForQrGeneration | null;
}

function AuthorizedQrLabelsPanel({
  batchId,
  batchCode,
  batch,
  ownerId,
}: Props & { ownerId: string }) {
  const { user } = useAuth();
  const [target, setTarget] = useState<PrintTarget | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailLabel, setDetailLabel] = useState<QrLabel | null>(null);

  const query = useBatchQrLabels(ownerId, batchId);
  const batchQuery = useBatchInventory(batchId, !batch);

  const labels = query.data ?? [];

  const printableCount = labels.filter(isPrintableLabel).length;

  const resolvedBatch: BatchForQrGeneration = batch || (batchQuery.data ? {
    batchId: batchQuery.data.batchId,
    batchCode: batchQuery.data.batchCode || batchCode || '',
    sku: batchQuery.data.sku,
    productName: batchQuery.data.productName,
    warehouseId: batchQuery.data.warehouseId,
    warehouseCode: batchQuery.data.warehouseCode,
    warehouseName: batchQuery.data.warehouseName,
    expirationDate: batchQuery.data.expirationDate,
    onHandQuantity: batchQuery.data.onHandQuantity,
    availableQuantity: batchQuery.data.availableQuantity,
    expiryStatus: batchQuery.data.expiryStatus,
  } : {
    batchId,
    batchCode: batchCode || '',
    sku: labels[0]?.sku || '',
    productName: labels[0]?.productName || '',
    warehouseCode: labels[0]?.warehouseCode,
    expirationDate: labels[0]?.expirationDate,
  });

  const isKeeper = user?.role === 'WarehouseKeeper';
  const assignedWhIds = user?.scope?.warehouseIds ?? [];
  const assignedWhCode = user?.warehouseCode;

  const isWarehouseScoped =
    !isKeeper ||
    (resolvedBatch.warehouseId ? assignedWhIds.includes(resolvedBatch.warehouseId) : false) ||
    (resolvedBatch.warehouseCode ? resolvedBatch.warehouseCode === assignedWhCode : false) ||
    assignedWhIds.length === 0;

  const canGenerate = can(user, 'qr.generate') && isWarehouseScoped;

  const canPrint = can(user, 'qr.print');

  const isDisposed = batch?.expiryStatus === 'Disposed' || resolvedBatch.expiryStatus === 'Disposed';

  const batchInfo: BatchForQrGeneration = resolvedBatch;

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
          {canGenerate && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={isDisposed || query.isFetching || batchQuery.isFetching}
              title={
                isDisposed
                  ? 'Lô hàng đã bị tiêu hủy nên không thể sinh mã QR.'
                  : 'Tạo tem QR mới cho lô hàng'
              }
              onClick={() => setGenerateOpen(true)}
            >
              Sinh mã QR
            </button>
          )}

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
            Chưa có mã QR cho lô hàng này.
          </p>
          {canGenerate && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={isDisposed}
              onClick={() => setGenerateOpen(true)}
            >
              Sinh mã QR
            </button>
          )}
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
                                : 'Tem đã bị vô hiệu hóa'
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

      {/* Generate QR Dialog */}
      {generateOpen && (
        <GenerateQrDialog
          open={generateOpen}
          batch={batchInfo}
          existingCount={labels.length}
          onClose={() => setGenerateOpen(false)}
          onPrintExisting={() => setTarget({ kind: 'batch', batchId })}
        />
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
