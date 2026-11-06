import { useRef, useState } from 'react';
import { Link, useParams } from '@/shared/router/compat';
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
import { formatCases, formatDate, formatDateTime, formatMoney } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { Check, Paperclip, Printer, Trash2, Upload, X } from 'lucide-react';
import {
  useApproveDisposal,
  useDeleteAttachment,
  useDisposal,
  useRejectDisposal,
  useUploadAttachment,
  useWriteOffAttachments,
} from '../hooks';
import type { Disposal, WriteOffAttachment } from '../types';

export function DisposalDetailPage() {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const canApprove = can(user, 'disposal.approve');

  const disposalQuery = useDisposal(code);
  const approveMutation = useApproveDisposal();
  const rejectMutation = useRejectDisposal();

  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);

  return (
    <QueryState query={disposalQuery}>
      {(disposal) => (
        <DisposalDetailContent
          disposal={disposal}
          canApprove={canApprove}
          confirmApproveOpen={confirmApproveOpen}
          setConfirmApproveOpen={setConfirmApproveOpen}
          confirmRejectOpen={confirmRejectOpen}
          setConfirmRejectOpen={setConfirmRejectOpen}
          onApprove={async () => {
            await approveMutation.mutateAsync(disposal.id || disposal.code);
            setConfirmApproveOpen(false);
          }}
          onReject={async () => {
            await rejectMutation.mutateAsync({
              id: disposal.id || disposal.code,
              reason: 'Kiểm tra lại số lượng thực tế',
            });
            setConfirmRejectOpen(false);
          }}
        />
      )}
    </QueryState>
  );
}

interface ContentProps {
  disposal: Disposal;
  canApprove: boolean;
  confirmApproveOpen: boolean;
  setConfirmApproveOpen: (open: boolean) => void;
  confirmRejectOpen: boolean;
  setConfirmRejectOpen: (open: boolean) => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

function DisposalDetailContent({
  disposal,
  canApprove,
  confirmApproveOpen,
  setConfirmApproveOpen,
  confirmRejectOpen,
  setConfirmRejectOpen,
  onApprove,
  onReject,
}: ContentProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isApproved = disposal.status === 'Disposed' || disposal.status === 'Đã tiêu hủy';
  const isPending =
    disposal.status === 'Pending' ||
    disposal.status === 'Chờ duyệt' ||
    disposal.status === 'Chờ Admin duyệt';
  const isRejected = disposal.status === 'Rejected' || disposal.status === 'Bị từ chối';

  // Attachments query & mutations
  const writeOffId = disposal.id || disposal.code;
  const attachmentsQuery = useWriteOffAttachments(writeOffId);
  const uploadMutation = useUploadAttachment(writeOffId);
  const deleteMutation = useDeleteAttachment(writeOffId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadMutation.mutateAsync(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePrintProtocol = () => {
    window.print();
  };

  return (
    <>
      <PageHeader
        back="/disposal"
        title={`Phiếu hủy ${disposal.code}`}
        subtitle={disposal.warehouseName}
        chips={<StatusChip domain="disposal" value={disposal.status} />}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isPending && canApprove && (
              <>
                <Button variant="danger" onClick={() => setConfirmRejectOpen(true)}>
                  <X size={15} style={{ marginRight: 6 }} />
                  Từ chối
                </Button>
                <Button variant="primary" onClick={() => setConfirmApproveOpen(true)}>
                  <Check size={15} style={{ marginRight: 6 }} />
                  Duyệt hủy
                </Button>
              </>
            )}

            {isApproved && (
              <Button onClick={handlePrintProtocol}>
                <Printer size={15} style={{ marginRight: 6 }} />
                In biên bản hủy
              </Button>
            )}
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Status Callout */}
        {isPending && (
          <Callout tone="warn">
            Phiếu hủy đang chờ Admin phê duyệt. Các batch liên quan bị chặn bán, tồn kho thực tế chưa trừ.
          </Callout>
        )}

        {isApproved && (
          <Callout tone="ok">
            Phiếu hủy đã được phê duyệt. Tồn kho thực tế đã trừ và lịch sử xuất hủy đã được ghi nhận.
          </Callout>
        )}

        {isRejected && (
          <Callout tone="danger">
            Phiếu hủy đã bị từ chối. {disposal.note ? `Lý do: ${disposal.note}` : ''}
          </Callout>
        )}

        {/* General Info Card */}
        <Card title="Thông tin phiếu hủy">
          <Fields
            cols={3}
            items={[
              { label: 'Mã phiếu', value: disposal.code },
              { label: 'Kho', value: disposal.warehouseName },
              { label: 'Thời gian lập', value: formatDateTime(disposal.createdAt) },
              { label: 'Người lập', value: disposal.createdBy },
              { label: 'Lý do', value: disposal.reason },
              { label: 'Hình thức xử lý', value: disposal.method },
              { label: 'Số lượng hàng hủy', value: formatCases(disposal.totalQty) },
              { label: 'Giá trị hàng hủy (giá bán)', value: formatMoney(disposal.totalValue) },
              {
                label: 'Trạng thái phê duyệt',
                value: isPending
                  ? 'Chờ Admin duyệt'
                  : isApproved
                  ? `Đã duyệt${disposal.approvedBy ? ` (${disposal.approvedBy})` : ''}`
                  : 'Bị từ chối',
              },
            ]}
          />
        </Card>

        {/* Batch Lines Table Card */}
        <Card
          title={
            isPending
              ? `Các batch đề nghị hủy (${disposal.lines.length} batch)`
              : `Các batch đã hủy (${disposal.lines.length} batch)`
          }
          flush
        >
          <SimpleTable
            rows={disposal.lines}
            empty="Không có batch nào trong phiếu hủy."
            columns={[
              {
                header: 'Batch ID',
                width: '200px',
                cell: (l) => (
                  <Link
                    to={`/batches/${encodeURIComponent(l.batchCode)}`}
                    style={{ fontWeight: 600, color: 'var(--c-primary)' }}
                  >
                    {l.batchCode}
                  </Link>
                ),
              },
              {
                header: 'SKU',
                width: '120px',
                cell: (l) => <span className="bold">{l.sku}</span>,
              },
              {
                header: 'Tên sản phẩm',
                cell: (l) => l.productName,
              },
              {
                header: 'HSD',
                width: '130px',
                cell: (l) => formatDate(l.expiry),
              },
              {
                header: 'Số lượng hủy',
                width: '130px',
                align: 'right',
                cell: (l) => formatCases(l.quantity),
              },
              {
                header: 'Tồn sau hủy',
                width: '130px',
                align: 'right',
                cell: () => (isPending ? <span className="muted">Chưa trừ</span> : '0 thùng'),
              },
            ]}
          />
        </Card>

        {/* Attachments / Evidence Card */}
        <Card
          title="Biên bản & Bằng chứng tiêu hủy"
          actions={
            <div>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
              />
              <Button
                size="sm"
                loading={uploadMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} style={{ marginRight: 6 }} />
                Tải lên biên bản
              </Button>
            </div>
          }
        >
          <SimpleTable<WriteOffAttachment>
            rows={attachmentsQuery.data ?? []}
            empty="Chưa có tệp đính kèm hoặc biên bản nào được tải lên."
            columns={[
              {
                header: 'Tên tệp',
                cell: (att) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Paperclip size={14} className="muted" />
                    {att.url ? (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontWeight: 600, color: 'var(--c-primary)' }}
                      >
                        {att.fileName || 'Tệp đính kèm'}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{att.fileName || 'Tệp đính kèm'}</span>
                    )}
                  </div>
                ),
              },
              {
                header: 'Thời gian tải lên',
                width: '180px',
                cell: (att) => formatDateTime(att.uploadedAt),
              },
              {
                header: 'Thao tác',
                width: '80px',
                align: 'right',
                cell: (att) => (
                  <Button
                    size="sm"
                    variant="danger"
                    title="Xóa tệp này"
                    loading={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutateAsync(att.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Approval Confirmation Dialog */}
      <ConfirmDialog
        open={confirmApproveOpen}
        title="Xác nhận duyệt phiếu xuất hủy"
        message={
          <div>
            <p style={{ margin: 0 }}>
              Bạn có chắc chắn muốn duyệt phiếu hủy <b>{disposal.code}</b> tại{' '}
              <b>{disposal.warehouseName}</b>?
            </p>
            <p className="muted small" style={{ marginTop: 8 }}>
              Sau khi duyệt, hệ thống sẽ trừ tồn kho thực tế của các batch tương ứng và ghi nhận lịch sử xuất hủy.
            </p>
          </div>
        }
        confirmLabel="Duyệt hủy"
        confirmVariant="primary"
        onClose={() => setConfirmApproveOpen(false)}
        onConfirm={onApprove}
      />

      {/* Reject Confirmation Dialog */}
      <ConfirmDialog
        open={confirmRejectOpen}
        title="Từ chối duyệt phiếu xuất hủy"
        message={
          <p style={{ margin: 0 }}>
            Xác nhận từ chối phiếu hủy <b>{disposal.code}</b>? Phiếu sẽ chuyển sang trạng thái bị từ chối và tồn kho được giữ nguyên.
          </p>
        }
        confirmLabel="Từ chối"
        danger
        onClose={() => setConfirmRejectOpen(false)}
        onConfirm={onReject}
      />
    </>
  );
}
