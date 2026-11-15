import { useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { Button, Callout, Card, Chip, Fields, FormDialog } from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import { useRetailerEligibility, useUpdateCreditTerms } from '../hooks';
import type { Retailer, RetailerReceivable } from '../types';

interface CreditTermsCardProps {
  retailer: Retailer;
  receivables: RetailerReceivable[];
}

export function CreditTermsCard({ retailer, receivables }: CreditTermsCardProps) {
  const { user } = useAuth();
  const mayReview = can(user, 'retailers.review');
  const [configOpen, setConfigOpen] = useState(false);
  const updateCredit = useUpdateCreditTerms();

  const eligibilityQuery = useRetailerEligibility(retailer.id ?? retailer.code);
  const eligibility = eligibilityQuery.data;

  // Outstanding used debt and overdue items
  const activeReceivables = receivables.filter((r) => r.status !== 'Paid' && r.status !== 'Cancelled');
  const usedDebt = activeReceivables.reduce(
    (sum, r) => sum + (r.outstandingAmount ?? r.outstanding ?? 0),
    0
  );
  const overdueItems = receivables.filter((r) => r.status === 'Overdue');
  const overdueCount = overdueItems.length;
  const overdueAmount = overdueItems.reduce(
    (sum, r) => sum + (r.outstandingAmount ?? r.outstanding ?? 0),
    0
  );

  const hasCreditPermission = Number(retailer.creditTermDays) > 0;

  // Evaluate eligibility reasons
  const fallbackReasons: string[] = [];
  if (retailer.status !== 'Active') {
    fallbackReasons.push('tài khoản không hoạt động');
  }
  if (!hasCreditPermission) {
    fallbackReasons.push('chưa được cấp kỳ hạn công nợ');
  }
  if (overdueCount > 0) {
    fallbackReasons.push('có khoản quá hạn');
  }

  const isEligible = eligibility?.isEligible ?? (fallbackReasons.length === 0);
  const reasons = (eligibility?.reasons && eligibility.reasons.length > 0)
    ? eligibility.reasons
    : fallbackReasons;

  return (
    <Card
      title="Điều kiện mua công nợ"
      actions={
        mayReview ? (
          <Button size="sm" onClick={() => setConfigOpen(true)}>
            Cấu hình điều kiện công nợ
          </Button>
        ) : undefined
      }
    >
      <div className="stack" style={{ gap: '16px' }}>
        <Fields
          cols={3}
          items={[
            {
              label: 'Quyền mua công nợ',
              value: hasCreditPermission ? (
                <Chip tone="ok">Được cấp công nợ</Chip>
              ) : (
                <Chip tone="warn">Không cho phép (chỉ trả trước)</Chip>
              ),
            },
            {
              label: 'Kỳ hạn thanh toán',
              value: retailer.creditTermDays
                ? `${retailer.creditTermDays} ngày`
                : 'Chỉ trả trước (0 ngày)',
            },
            {
              label: 'Hạn mức công nợ',
              value: '— (Kiểm soát theo kỳ hạn và chặn quá hạn)',
            },
            {
              label: 'Dư nợ hiện tại',
              value: formatMoney(usedDebt),
            },
            {
              label: 'Khoản quá hạn',
              value:
                overdueCount > 0 ? (
                  <span style={{ color: 'var(--c-danger, #d32f2f)', fontWeight: 600 }}>
                    {overdueCount} đơn ({formatMoney(overdueAmount)})
                  </span>
                ) : (
                  'Không có'
                ),
            },
            {
              label: 'Đủ điều kiện mua công nợ',
              value: isEligible ? (
                <Chip tone="ok">Đủ điều kiện</Chip>
              ) : (
                <Chip tone="danger">Chưa đủ điều kiện</Chip>
              ),
            },
          ]}
        />

        {!isEligible && (
          <div className="stack" style={{ gap: '8px' }}>
            {reasons.length > 0 && (
              <div className="small muted" style={{ color: 'var(--c-danger, #d32f2f)' }}>
                <b>Lý do chưa đủ điều kiện:</b> {reasons.join('; ')}
              </div>
            )}
            <Callout tone="info">
              Khách hàng hiện chưa đủ điều kiện mua công nợ. Có thể lựa chọn thanh toán trước.
            </Callout>
          </div>
        )}

        <Callout tone="neutral">
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            <b>Quy tắc tính hạn thanh toán & snapshot kỳ hạn:</b>
            <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
              <li>
                <b>Mốc tính hạn:</b> Bắt đầu tính từ ngày <b>nhận đủ hàng</b> (hoặc ngày giải quyết xong khiếu nại nếu có), <b>không tính từ thời điểm đặt đơn</b>.
              </li>
              <li>
                <b>Công thức:</b> <code>Ngày đến hạn = Ngày nhận đủ hàng + Kỳ hạn công nợ ({retailer.creditTermDays || 0} ngày)</code>.
              </li>
              <li>
                <b>Snapshot độc lập:</b> Mỗi đơn hàng lưu snapshot kỳ hạn công nợ riêng tại thời điểm đặt. Việc cập nhật kỳ hạn của điểm bán sau này không làm thay đổi hạn thanh toán của các đơn đã tạo trước đó.
              </li>
            </ul>
          </div>
        </Callout>
      </div>

      {configOpen && (
        <FormDialog
          open
          width={560}
          columns={1}
          title={`Cấu hình điều kiện công nợ · ${retailer.code}`}
          subtitle={retailer.name}
          submitLabel="Lưu cấu hình"
          initial={{
            creditTermDays: String(retailer.creditTermDays ?? 0),
            reason: '',
          }}
          fields={[
            {
              key: 'creditTermDays',
              label: 'Kỳ hạn thanh toán công nợ',
              type: 'select',
              required: true,
              options: [
                { value: '0', label: 'Không cho phép / chỉ trả trước (0 ngày)' },
                { value: '7', label: '7 ngày (tính từ khi nhận hàng đủ)' },
                { value: '14', label: '14 ngày (tính từ khi nhận hàng đủ)' },
                { value: '30', label: '30 ngày (tính từ khi nhận hàng đủ)' },
              ],
            },
            {
              key: 'reason',
              label: 'Lý do phê duyệt / cập nhật',
              type: 'textarea',
              placeholder: 'Nhập lý do thay đổi kỳ hạn công nợ cho điểm bán...',
            },
          ]}
          note="Quyền mua công nợ sẽ được áp dụng cho các đơn hàng tạo mới tiếp theo. Các đơn hàng cũ vẫn giữ nguyên snapshot kỳ hạn ban đầu."
          onClose={() => setConfigOpen(false)}
          onSubmit={async (v) => {
            await updateCredit.mutateAsync({
              retailerId: retailer.id ?? retailer.code,
              creditTermDays: Number(v.creditTermDays) as 0 | 7 | 14 | 30,
              reason: v.reason || undefined,
            });
            setConfigOpen(false);
          }}
        />
      )}
    </Card>
  );
}
