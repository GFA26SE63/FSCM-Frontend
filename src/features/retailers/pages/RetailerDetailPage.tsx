import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Callout, Card, Fields, Input, PageHeader, QueryState, SimpleTable, StatusChip, Tabs } from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import { useRegistration, useRetailer, useRetailerLoyalty, useRetailerMlor, useRetailerReceivables, useSaveMlor } from '../hooks';
import { RegistrationActions } from '../components/RegistrationActions';
import { RetailerFormDialog } from '../components/RetailerFormDialog';
import type { Retailer } from '../types';

function MlorTab({ code }: { code: string }) {
  const query = useRetailerMlor(code);
  const save = useSaveMlor();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const bad = Object.values(edits).some((v) => !(Number(v) > 0 && Number(v) < 1));
  return (
    <QueryState query={query}>
      {(rows) => (
        <Card title="MLOR theo SKU" actions={<Button variant="primary" disabled={!Object.keys(edits).length || bad} loading={save.isPending} onClick={async () => { await save.mutateAsync({ code, items: Object.entries(edits).map(([sku, v]) => ({ sku, mlor: Number(v) })) }); setEdits({}); }}>Lưu MLOR</Button>} flush>
          <SimpleTable
            rows={rows}
            columns={[
              { header: 'SKU', width: '90px', cell: (r) => r.sku },
              { header: 'Sản phẩm', cell: (r) => r.productName },
              { header: 'Hạn dùng', align: 'right', cell: (r) => `${r.shelfLifeDays} ngày` },
              { header: 'm mặc định', align: 'right', cell: (r) => formatNumber(r.defaultMlor, 2) },
              { header: 'm của retailer (0–1)', width: '170px', align: 'right', cell: (r) => <Input className="inp-sm" inputMode="decimal" invalid={r.sku in edits && !(Number(edits[r.sku]) > 0 && Number(edits[r.sku]) < 1)} value={edits[r.sku] ?? String(r.mlor)} onChange={(e) => setEdits((s) => ({ ...s, [r.sku]: e.target.value.replace(',', '.') }))} /> },
              { header: 'MLOR (ngày)', align: 'right', cell: (r) => formatNumber(r.shelfLifeDays * Number(edits[r.sku] ?? r.mlor), 1) },
              { header: '', cell: (r) => (r.overridden ? <StatusChip value="Đã chỉnh" /> : null) },
            ]}
          />
        </Card>
      )}
    </QueryState>
  );
}

function DebtTab({ code }: { code: string }) {
  const rec = useRetailerReceivables(code);
  const loy = useRetailerLoyalty(code);
  return (
    <div className="stack">
      <Card title="Điểm loyalty">{loy.data ? `Số dư ${formatNumber(loy.data.balance)} điểm · đang giữ ${formatNumber(loy.data.held)} · khả dụng ${formatNumber(loy.data.available)}` : '—'}</Card>
      <Card title="Công nợ" flush>
        <QueryState query={rec}>
          {(rows) => (
            <SimpleTable
              rows={rows}
              empty="Retailer chưa có đơn công nợ."
              columns={[
                { header: 'Đơn hàng', cell: (r) => r.orderCode },
                { header: 'Hạn thanh toán', cell: (r) => formatDate(r.dueDate) },
                { header: 'Giá trị', align: 'right', cell: (r) => formatMoney(r.total) },
                { header: 'Còn phải thu', align: 'right', cell: (r) => formatMoney(r.outstanding) },
                { header: 'Trạng thái', cell: (r) => <StatusChip domain="receivable" value={r.status} /> },
              ]}
            />
          )}
        </QueryState>
      </Card>
    </div>
  );
}

function RetailerView({ r }: { r: Retailer }) {
  const [tab, setTab] = useState<'info' | 'mlor' | 'debt'>('info');
  const [edit, setEdit] = useState(false);
  return (
    <>
      <PageHeader back="/retailers" title={`${r.code} · ${r.name}`} subtitle={r.address} chips={<StatusChip domain="active" value={r.status} />} actions={<Button onClick={() => setEdit(true)}>Sửa</Button>} />
      <Tabs value={tab} onChange={setTab} items={[{ key: 'info', label: 'Thông tin' }, { key: 'mlor', label: 'MLOR' }, { key: 'debt', label: 'Công nợ & điểm' }]} />
      {tab === 'info' && (
        <Card>
          <Fields cols={3} items={[
            { label: 'Mã retailer', value: r.code }, { label: 'Tên điểm bán', value: r.name }, { label: 'Loại hình / quy mô', value: `${r.kind} · ${r.size}` },
            { label: 'Địa chỉ', value: r.address }, { label: 'Khu vực / nhóm Sales', value: `${r.areaName} · ${r.groupCode}` }, { label: 'Toạ độ', value: `${r.lat}, ${r.lng}` },
            { label: 'Liên hệ', value: `${r.contact} · ${r.phone}` }, { label: 'Diện tích / tủ mát', value: `${r.areaM2} m² · ${r.fridges} tủ` }, { label: 'Tần suất đặt', value: r.orderFrequency },
            { label: 'Doanh thu dự báo / tháng', value: formatMoney(r.forecastRevenue) }, { label: 'Sức mua', value: `${r.monthlyCapacity} thùng / tháng` }, { label: 'Nhóm tiềm năng', value: <StatusChip value={r.potentialClass} /> },
            { label: 'Kỳ hạn công nợ', value: r.creditTermDays ? `${r.creditTermDays} ngày` : 'Không công nợ' }, { label: 'Nguồn', value: r.source },
          ]} />
        </Card>
      )}
      {tab === 'mlor' && <MlorTab code={r.code} />}
      {tab === 'debt' && <DebtTab code={r.code} />}
      <RetailerFormDialog open={edit} retailer={r} onClose={() => setEdit(false)} />
    </>
  );
}

/** Route /retailers/:code – an 8-digit retailer, or a KB-xxxx registration. */
export function RetailerDetailPage() {
  const { code = '' } = useParams();
  const isReg = code.startsWith('KB-');
  const retailer = useRetailer(code, !isReg);
  const reg = useRegistration(code, isReg);
  if (!isReg) return <QueryState query={retailer}>{(r) => <RetailerView r={r} />}</QueryState>;
  return (
    <QueryState query={reg}>
      {(x) => (
        <>
          <PageHeader back="/retailers" title={`${x.code} · ${x.name}`} subtitle={`Khai báo bởi Sales ${x.salesName}`} chips={<StatusChip domain="registration" value={x.status} />} actions={x.status === 'Pending' ? <RegistrationActions code={x.code} size="md" /> : undefined} />
          {x.rejectReason && <Callout tone="danger"><b>Lý do từ chối:</b> {x.rejectReason}</Callout>}
          {x.retailerCode && <Callout tone="ok">Đã cấp mã retailer {x.retailerCode}.</Callout>}
          <Card>
            <Fields cols={3} items={[
              { label: 'Tên điểm bán', value: x.name }, { label: 'Địa chỉ', value: x.address }, { label: 'Khu vực', value: x.areaName },
              { label: 'Liên hệ', value: `${x.contact} · ${x.phone}` }, { label: 'Loại hình / quy mô', value: `${x.kind} · ${x.size}` }, { label: 'Nhóm tiềm năng (ước tính)', value: <StatusChip value={x.potentialClass} /> },
              { label: 'Doanh thu dự báo / tháng', value: formatMoney(x.forecastRevenue) }, { label: 'Sức mua', value: `${x.monthlyCapacity} thùng / tháng` }, { label: 'Khai báo lúc', value: formatDate(x.createdAt) },
            ]} />
          </Card>
        </>
      )}
    </QueryState>
  );
}
