import { useEffect, useState } from 'react';
import { Button, Callout, Chip, FormField, Input, SimpleTable } from '@/shared/ui';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { usePublishRunSchedule } from '../hooks';
import type { RunSchedule, ScheduleMilestone } from '../types';

type Key = ScheduleMilestone['key'];

const ORDER: Key[] = [
  'sales_submission_advice',
  'order_review_reminder',
  'allocation_run',
  'plan_approval_reminder',
  'plan_approval_deadline',
];

const FIELD_LABEL: Record<Key, string> = {
  sales_submission_advice: 'Khuyến nghị Sales gửi đơn trước',
  order_review_reminder: 'Nhắc duyệt đơn còn chờ',
  allocation_run: 'Giờ chốt đợt (thực tế)',
  plan_approval_reminder: 'Nhắc duyệt phương án',
  plan_approval_deadline: 'Hạn Admin duyệt phương án',
};

const FIELD_HINT: Record<Key, string> = {
  sales_submission_advice: 'Chỉ là khuyến nghị. Đơn nhận sau mốc này mà trước giờ chốt vẫn vào đợt.',
  order_review_reminder: 'Phải trước giờ chốt — sau đó thì không còn kịp duyệt để vào đợt.',
  allocation_run: 'Đợt lấy các đơn đã nhận và đã duyệt trước mốc này. ETA cũng tính từ đây.',
  plan_approval_reminder: 'Phải nằm giữa giờ chốt và hạn duyệt, nếu không thì chẳng nhắc ai điều gì.',
  plan_approval_deadline: 'Mốc mong đợi có quyết định. Quá hạn hệ thống không tự duyệt.',
};

/** "HH:mm:ss" from the server, "HH:mm" in the input. */
const toInput = (localTime: string) => localTime.slice(0, 5);
const minutes = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

/**
 * The run day on one screen: when Sales are advised to have sent, when the cutoff actually closes
 * the run, and when a decision on the proposal is expected.
 *
 * The times are published as one document because they only mean anything against each other, and
 * the same validation runs here and on the server — a reminder after the thing it reminds about is
 * not a smaller mistake for having been typed in the portal.
 */
export function RunScheduleSection({ current }: { current: RunSchedule }) {
  const byKey = (key: Key) => current.milestones.find((m) => m.key === key);
  const initial = () =>
    Object.fromEntries(ORDER.map((key) => [key, toInput(byKey(key)?.localTime ?? '')])) as Record<Key, string>;

  const [draft, setDraft] = useState<Record<Key, string>>(initial);
  const [intervalHours, setIntervalHours] = useState(current.allocationIntervalHours || 3);
  const publish = usePublishRunSchedule();
  useEffect(() => {
    setDraft(initial());
    setIntervalHours(current.allocationIntervalHours || 3);
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (key: Key) => minutes(draft[key]);
  const errors: string[] = [];
  if (ORDER.some((key) => Number.isNaN(at(key)))) {
    errors.push('Mọi mốc phải là giờ hợp lệ dạng HH:mm.');
  } else {
    const forward = (from: number, to: number) => (to - from + 1440) % 1440;
    if (forward(at('allocation_run'), at('plan_approval_deadline')) === 0) {
      errors.push('Hạn duyệt phương án phải sau giờ chốt.');
    }
    if (forward(at('sales_submission_advice'), at('allocation_run')) === 0) {
      errors.push('Khuyến nghị gửi đơn phải trước giờ chốt.');
    }
    if (forward(at('order_review_reminder'), at('allocation_run')) === 0) {
      errors.push('Nhắc duyệt đơn phải trước giờ chốt.');
    }
    if (forward(at('allocation_run'), at('plan_approval_reminder')) >= forward(at('allocation_run'), at('plan_approval_deadline'))) {
      errors.push('Nhắc duyệt phương án phải nằm giữa giờ chốt và hạn duyệt.');
    }
    if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 24 || 24 % intervalHours !== 0) {
      errors.push('Chu kỳ phải là ước số nguyên của 24 giờ (ví dụ: 1, 2, 3, 4, 6, 8, 12).');
    }
  }

  const submit = () =>
    publish.mutate({
      timeZone: current.timeZone,
      salesSubmissionAdviceLocalTime: draft.sales_submission_advice,
      orderReviewReminderLocalTime: draft.order_review_reminder,
      allocationRunLocalTime: draft.allocation_run,
      allocationIntervalHours: intervalHours,
      planApprovalMinutes: (at('plan_approval_deadline') - at('allocation_run') + 1440) % 1440,
      planApprovalReminderLocalTime: draft.plan_approval_reminder,
      planApprovalDeadlineLocalTime: draft.plan_approval_deadline,
      preparationMinutes: current.preparationMinutes,
      bufferMinutes: current.bufferMinutes,
      dispatchSlotsLocalTime: current.dispatchSlotsLocalTime,
    });

  return (
    <div className="stack">
      <Callout tone="info">
        Hệ thống chạy lặp lại mỗi <strong>{intervalHours} giờ</strong>, bắt đầu từ giờ chốt gốc. ETA báo cho khách cũng tính từ mốc chạy kế tiếp. Đổi lịch có hiệu
        lực từ lần chạy sau. <strong>Quá hạn duyệt, hệ thống không tự duyệt phương án</strong> — quyết định muộn
        vẫn phải do người duyệt, và ETA của phương án đó cần được kiểm lại.
      </Callout>

      <div className="form-grid cols-2">
        <FormField label="Chu kỳ chạy allocation (giờ)" hint="Chọn 3 để chạy tại 00:00, 03:00, 06:00… mỗi ngày.">
          <Input type="number" min={1} max={24} value={intervalHours} onChange={(e) => setIntervalHours(Number(e.target.value))} />
        </FormField>
        {ORDER.map((key) => (
          <FormField key={key} label={FIELD_LABEL[key]} hint={FIELD_HINT[key]}>
            <Input type="time" value={draft[key]} onChange={(e) => setDraft((s) => ({ ...s, [key]: e.target.value }))} />
          </FormField>
        ))}
      </div>

      {errors.length > 0 && (
        <Callout tone="danger">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Callout>
      )}

      <SimpleTable
        columns={[
          { header: 'Mốc', cell: (m: ScheduleMilestone) => m.label },
          { header: 'Giờ', cell: (m: ScheduleMilestone) => toInput(m.localTime) },
          {
            header: `Ngày ${current.businessDate.split('-').reverse().join('/')}`,
            cell: (m: ScheduleMilestone) => formatInstantDateTime(m.at),
          },
          {
            header: 'Tính chất',
            cell: (m: ScheduleMilestone) =>
              m.isAdvisory ? <Chip tone="info">Khuyến nghị</Chip> : <Chip tone="neutral">Mốc thực thi</Chip>,
          },
        ]}
        rows={ORDER.map((key) => byKey(key)).filter((m): m is ScheduleMilestone => !!m)}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button variant="primary" disabled={errors.length > 0} loading={publish.isPending} onClick={submit}>
          Lưu lịch chạy đợt
        </Button>
        <span style={{ fontSize: 12.5, opacity: 0.75 }}>
          Bản {current.scheduleVersion} · mỗi {current.allocationIntervalHours || 3} giờ · múi giờ {current.timeZone}
        </span>
      </div>
    </div>
  );
}
