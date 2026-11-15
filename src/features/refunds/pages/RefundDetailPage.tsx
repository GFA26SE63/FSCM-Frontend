import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useNavigate, useParams } from '@/shared/router/compat';
import { Button, Callout, Card, Fields, FormDialog, Modal, PageHeader, QueryState } from '@/shared/ui';
import { formatDateTime, formatMoney, toIsoDateTime, vietnamDateTimeToIso } from '@/shared/lib';
import { refundApi } from '../api';
import { useEvidenceUrl, useRefund, useSubmitRefundEvidence, useVerifyRefund } from '../hooks';
import type { Refund } from '../types';
import { RefundStatusChip } from './RefundsPage';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function RefundDetailPage() {
  const { id = '' } = useParams();
  const query = useRefund(id);
  return (
    <QueryState query={query}>
      {(refund) => <RefundDetail refund={refund} />}
    </QueryState>
  );
}

function RefundDetail({ refund }: { refund: Refund }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mayManage = can(user, 'refunds.manage');
  const mayVerify = can(user, 'refunds.verify');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const verify = useVerifyRefund();

  const canSubmit = mayManage && (refund.status === 'PendingRefund' || refund.status === 'EvidenceRejected');
  const submittedByMe = !!user && refund.submittedByUserId === user.id;
  const canVerify = mayVerify && refund.status === 'AwaitingVerification' && !submittedByMe;

  return (
    <>
      <PageHeader
        back="/refunds"
        title={`Hồ sơ hoàn · ${refund.orderCode}`}
        subtitle={refund.recipient}
        chips={<RefundStatusChip status={refund.status} />}
        actions={
          <>
            {canSubmit && (
              <Button variant="primary" onClick={() => setEvidenceOpen(true)}>
                {refund.status === 'EvidenceRejected' ? 'Nộp lại bằng chứng' : 'Nhập giao dịch & gửi kiểm tra'}
              </Button>
            )}
            {canVerify && (
              <Button variant="primary" onClick={() => setVerifyOpen(true)}>
                Xác minh
              </Button>
            )}
          </>
        }
      />

      {refund.status === 'Refunded' ? (
        <Callout tone="ok">Khoản hoàn đã được Admin xác minh là đã chuyển.</Callout>
      ) : (
        <Callout tone="info">
          Chưa có khoản nào được xác nhận là đã chuyển. Hồ sơ chỉ thành “Đã hoàn” sau khi Admin xác minh bằng chứng chuyển tiền.
        </Callout>
      )}
      {refund.status === 'AwaitingVerification' && mayVerify && submittedByMe && (
        <Callout tone="warn">Bạn là người nộp bằng chứng này nên không được tự xác minh. Cần một Admin khác.</Callout>
      )}
      {refund.status === 'EvidenceRejected' && (
        <Callout tone="danger">
          <b>Admin đã trả bằng chứng:</b> {refund.verificationNote ?? '—'}. Nghĩa vụ hoàn vẫn còn, hãy nộp lại bằng chứng đúng.
        </Callout>
      )}

      <Card title="Hồ sơ">
        <Fields
          cols={3}
          items={[
            {
              label: 'Đơn hàng',
              value: (
                <a
                  href={`/orders/${refund.salesOrderId}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(`/orders/${refund.salesOrderId}`);
                  }}
                >
                  {refund.orderCode}
                </a>
              ),
            },
            { label: 'Số tiền hồ sơ', value: formatMoney(refund.amount) },
            { label: 'Người nhận', value: refund.recipient },
            { label: 'Lý do', value: refund.reason },
            {
              label: 'Nguồn',
              value: refund.receiptDiscrepancyId ? (
                <a
                  href="/complaints"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate('/complaints');
                  }}
                >
                  Khiếu nại {refund.receiptDiscrepancyId.slice(0, 8)}
                </a>
              ) : (
                'Không gắn khiếu nại'
              ),
            },
            { label: 'Tạo lúc', value: formatDateTime(refund.createdAt) },
          ]}
        />
      </Card>

      <Card title="Tình hình hoàn của đơn">
        <Fields
          cols={3}
          items={[
            { label: 'Đã thu', value: formatMoney(refund.confirmedAmount) },
            { label: 'Phải thu sau điều chỉnh', value: formatMoney(refund.adjustedAmount) },
            { label: 'Phải hoàn (đã thu − phải thu)', value: formatMoney(Math.max(0, refund.confirmedAmount - refund.adjustedAmount)) },
            { label: 'Đã hoàn (đã xác minh)', value: formatMoney(refund.refundedAmount) },
            { label: 'Đang có hồ sơ mở', value: formatMoney(refund.pendingRefundAmount) },
            { label: 'Còn phải hoàn', value: <b>{formatMoney(refund.refundDueAmount)}</b> },
          ]}
        />
      </Card>

      <Card title="Giao dịch thực chuyển & bằng chứng">
        {refund.transactionReference ? (
          <>
            <Fields
              cols={3}
              items={[
                { label: 'Thời điểm chuyển', value: refund.transferredAt ? formatDateTime(refund.transferredAt) : '—' },
                { label: 'Mã giao dịch', value: refund.transactionReference },
                { label: 'Nộp lúc', value: refund.submittedAt ? formatDateTime(refund.submittedAt) : '—' },
                { label: 'Xác minh lúc', value: refund.verifiedAt ? formatDateTime(refund.verifiedAt) : '—' },
                { label: 'Ghi chú xác minh', value: refund.verificationNote ?? '—' },
              ]}
            />
            <EvidencePreview reference={refund.evidenceReference} />
          </>
        ) : (
          <p className="muted">Chưa có giao dịch nào được nhập.</p>
        )}
      </Card>

      <EvidenceModal refund={refund} open={evidenceOpen} onClose={() => setEvidenceOpen(false)} />

      <FormDialog
        open={verifyOpen}
        width={560}
        columns={1}
        title={`Xác minh hoàn tiền · ${refund.orderCode}`}
        submitLabel="Xác nhận quyết định"
        initial={{ decision: 'approve', note: '' }}
        fields={[
          {
            key: 'decision',
            type: 'select',
            required: true,
            label: 'Quyết định',
            options: [
              { value: 'approve', label: 'Bằng chứng đúng: xác nhận đã hoàn' },
              { value: 'reject', label: 'Bằng chứng sai: trả lại để nộp lại' },
            ],
          },
          {
            key: 'note',
            type: 'textarea',
            label: 'Ghi chú (bắt buộc khi trả lại)',
            validate: (value, values) => (values.decision === 'reject' && !String(value ?? '').trim() ? 'Cần nêu lý do trả lại.' : false),
          },
        ]}
        onClose={() => setVerifyOpen(false)}
        onSubmit={async (values) => {
          await verify.mutateAsync({
            id: refund.id,
            expectedVersion: refund.version,
            approved: values.decision === 'approve',
            note: values.note ?? '',
            operationKey: crypto.randomUUID(),
          });
          setVerifyOpen(false);
        }}
      />
    </>
  );
}

function EvidencePreview({ reference }: { reference: string | null }) {
  const isImage = !!reference && reference.startsWith('blob:');
  const url = useEvidenceUrl(reference);
  if (!reference) return null;
  if (!isImage) return <p className="small">Tham chiếu: {reference}</p>;
  if (url.isLoading) return <p className="muted small">Đang tải ảnh bằng chứng…</p>;
  if (!url.data) return <Callout tone="warn">Không mở được ảnh bằng chứng.</Callout>;
  return (
    <div style={{ marginTop: 10 }}>
      <a href={url.data} target="_blank" rel="noreferrer">
        <img src={url.data} alt="Bằng chứng chuyển tiền" style={{ maxWidth: 360, maxHeight: 360, borderRadius: 8, border: '1px solid var(--c-border, #ddd)' }} />
      </a>
      <p className="muted small" style={{ margin: '4px 0 0' }}>Liên kết ảnh có hạn ngắn, tải lại trang để lấy liên kết mới.</p>
    </div>
  );
}

function EvidenceModal({ refund, open, onClose }: { refund: Refund; open: boolean; onClose: () => void }) {
  const submit = useSubmitRefundEvidence();
  const [transferredAt, setTransferredAt] = useState(toIsoDateTime(new Date()));
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (selected: File | null) => {
    setError(null);
    if (selected && !IMAGE_TYPES.includes(selected.type)) {
      setFile(null);
      setError('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (selected && selected.size > MAX_IMAGE_BYTES) {
      setFile(null);
      setError('Ảnh vượt quá 10 MB.');
      return;
    }
    setFile(selected);
  };

  const send = async () => {
    setError(null);
    if (!reference.trim()) return setError('Cần nhập mã giao dịch.');
    if (!file) return setError('Cần chọn ảnh bằng chứng chuyển tiền.');
    let transferredInstant: string;
    try { transferredInstant = vietnamDateTimeToIso(transferredAt); }
    catch { return setError('Nhập ngày và giờ chuyển hợp lệ.'); }
    if (Date.parse(transferredInstant) > Date.now()) return setError('Thời điểm chuyển không được ở tương lai.');
    setBusy(true);
    try {
      const uploaded = await refundApi.uploadEvidence(file);
      await submit.mutateAsync({
        id: refund.id,
        expectedVersion: refund.version,
        transferredAt: transferredInstant,
        transactionReference: reference.trim(),
        evidenceReference: uploaded.reference,
        operationKey: crypto.randomUUID(),
      });
      setFile(null);
      setReference('');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gửi được bằng chứng.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      width={560}
      title={`Bằng chứng chuyển tiền · ${refund.orderCode}`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button variant="primary" loading={busy} onClick={() => void send()}>Gửi Admin xác minh</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Callout tone="info">Nhập thông tin khoản tiền đã thực sự chuyển. Hệ thống không tự chuyển tiền.</Callout>
        <label className="fld">
          <span className="fl">Thời điểm chuyển (giờ Việt Nam) *</span>
          <input className="inp" type="datetime-local" value={transferredAt} max={toIsoDateTime(new Date())} onChange={(event) => setTransferredAt(event.target.value)} />
        </label>
        <label className="fld">
          <span className="fl">Mã giao dịch *</span>
          <input className="inp" value={reference} maxLength={100} onChange={(event) => setReference(event.target.value)} />
        </label>
        <label className="fld">
          <span className="fl">Ảnh bằng chứng (JPG, PNG, WebP, tối đa 10 MB) *</span>
          <input className="inp" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => pick(event.target.files?.[0] ?? null)} />
        </label>
        {file && <p className="muted small" style={{ margin: 0 }}>Đã chọn: {file.name} ({Math.round(file.size / 1024)} KB)</p>}
        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}
