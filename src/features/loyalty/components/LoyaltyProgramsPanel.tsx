import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { errorMessage } from '@/shared/api/errors';
import { Button, Card, Chip, DataTable, Fields, Modal, type Column } from '@/shared/ui';
import { formatInstantDateTime, formatMoney, formatNumber } from '@/shared/lib';
import { usePrograms, useProgramRetailers, useSetProgramActive } from '../hooks';
import { programStatus } from '../programForm';
import type { LoyaltyProgram } from '../types';
import { ProgramDialog } from './ProgramDialog';

export function LoyaltyProgramsPanel() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { user } = useAuth();
  const mayManage = can(user, 'loyalty.manage');
  const query = usePrograms();
  const change = useSetProgramActive();
  const [editing, setEditing] = useState<{ program?: LoyaltyProgram } | null>(null);
  const [detail, setDetail] = useState<LoyaltyProgram | null>(null);
  const [confirm, setConfirm] = useState<LoyaltyProgram | null>(null);
  const columns: Column<LoyaltyProgram>[] = [
    { key: 'code', header: 'Mã', text: (p) => p.code, width: '110px' },
    { key: 'name', header: 'Tên chương trình', text: (p) => p.name },
    { key: 'rate', header: 'Quy đổi', text: (p) => `${formatMoney(p.spendAmountPerPoint)} = 1 điểm` },
    { key: 'retailers', header: 'Retailer áp dụng', text: (p) => `${p.retailerIds.length} retailer` },
    { key: 'period', header: 'Hiệu lực (VN)', text: (p) => `${formatInstantDateTime(p.startAt)} – ${formatInstantDateTime(p.endAt)}` },
    { key: 'status', header: 'Trạng thái', text: (p) => programStatus(p, now),
      render: (p) => <Chip tone={p.isActive && Date.parse(p.endAt) >= now ? 'ok' : 'warn'}>{programStatus(p, now)}</Chip> },
  ];

  return <>
    <DataTable stateKey="programs" title="Chương trình loyalty" rows={query.data}
      loading={query.isLoading} error={query.error} columns={columns}
      rowKey={(p) => p.id} searchPlaceholder="Mã hoặc tên chương trình…"
      emptyText="Chưa có chương trình loyalty phù hợp."
      actions={<>
        <Button size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>Tải lại chương trình</Button>
        {mayManage && <Button variant="primary" onClick={() => setEditing({})}>+ Tạo chương trình</Button>}
      </>}
      onRowClick={setDetail} rowActionsWidth={mayManage ? '260px' : '90px'}
      rowActions={(p) => <>
        <Button size="sm" onClick={() => setDetail(p)}>Xem</Button>
        {mayManage && <>
          <Button size="sm" onClick={() => setEditing({ program: p })}>Sửa</Button>
          <Button size="sm" disabled={change.isPending || (!p.isActive && Date.parse(p.endAt) < now)}
            onClick={() => { change.reset(); setConfirm(p); }}>
            {p.isActive ? 'Tạm dừng' : 'Kích hoạt'}
          </Button>
        </>}
      </>} />
    {detail && <Modal open width={720} title={`${detail.code} · ${detail.name}`} onClose={() => setDetail(null)}>
      <Card><Fields cols={2} items={[
        { label: 'Trạng thái', value: programStatus(detail, now) },
        { label: 'Quy đổi', value: `${formatMoney(detail.spendAmountPerPoint)} = 1 điểm` },
        { label: 'Điểm tối thiểu đổi quà', value: formatNumber(detail.minimumRedeemPoints) },
        { label: 'Hiệu lực từ (VN)', value: formatInstantDateTime(detail.startAt) },
        { label: 'Hiệu lực đến (VN)', value: formatInstantDateTime(detail.endAt) },
        { label: 'Điểm hết hạn (VN)', value: detail.pointsExpireAt ? formatInstantDateTime(detail.pointsExpireAt) : 'Không đặt hạn' },
        { label: 'Retailer áp dụng', value: `${detail.retailerIds.length} retailer` },
        { label: 'Mô tả', value: detail.description || '—' },
      ]} /></Card>
      <ProgramAudience ids={detail.retailerIds} />
    </Modal>}
    {mayManage && editing && <ProgramDialog program={editing.program} onClose={() => setEditing(null)} />}
    {mayManage && confirm && <Modal open title={confirm.isActive ? 'Tạm dừng chương trình' : 'Kích hoạt chương trình'}
      onClose={() => { if (!change.isPending) setConfirm(null); }}
      footer={<>
        <Button disabled={change.isPending} onClick={() => setConfirm(null)}>Hủy</Button>
        <Button variant="primary" loading={change.isPending} onClick={() => {
          change.mutate({ id: confirm.id, active: !confirm.isActive }, {
            onSuccess: () => { setConfirm(null); setDetail(null); },
          });
        }}>Xác nhận</Button>
      </>}>
      <p>{confirm.code} · {confirm.name}</p>
      <p>{confirm.isActive ? 'Ngừng áp dụng chương trình cho các lần đánh giá tiếp theo.'
        : 'Chương trình chỉ có hiệu lực trong khoảng thời gian đã cấu hình.'}</p>
      {change.error && <div className="callout callout-danger">{errorMessage(change.error)}</div>}
    </Modal>}
  </>;
}

function ProgramAudience({ ids }: { ids: string[] }) {
  const query = useProgramRetailers();
  const retailers = query.data;
  return <div>
    <h3>Retailer áp dụng</h3>
    {query.isLoading && <p>Đang tải thông tin retailer…</p>}
    {query.error && <div className="callout callout-danger">
      {errorMessage(query.error)} <Button size="sm" onClick={() => void query.refetch()}>Tải lại retailer</Button>
    </div>}
    {!query.isLoading && !query.error && retailers && <ul>
      {ids.map((id) => {
        const retailer = retailers.find((r) => r.id === id);
        return <li key={id}>{retailer ? `${retailer.code} · ${retailer.name}` : `Không tìm thấy thông tin retailer (${id})`}</li>;
      })}
    </ul>}
  </div>;
}
