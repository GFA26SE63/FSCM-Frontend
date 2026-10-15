import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, FormField, Input, PageHeader, Select } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import { useCreateReceipt, useReceiptLookups } from '../hooks';

interface Row { sku: string; expiry: string; qty: string; labels: string; lot: string }
const blank = (sku = ''): Row => ({ sku, expiry: '', qty: '', labels: '1', lot: '' });

/** "Tạo phiếu nhập": warehouse + rows (SKU, HSD, thùng, số tem). Batch code is previewed with IdFormat.batch. */
export function ReceiptFormPage() {
  const navigate = useNavigate();
  const { warehouses, products } = useReceiptLookups();
  const create = useCreateReceipt();
  const [warehouseCode, setWarehouse] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [tried, setTried] = useState(false);

  const whs = (warehouses.data ?? []).filter((w) => w.status === 'Active');
  const prods = (products.data ?? []).filter((p) => p.status === 'Published');
  const wh = warehouseCode || whs[0]?.code || '';
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const rowErr = (r: Row) => (!r.sku ? 'Chọn SKU' : !r.expiry ? 'Nhập HSD' : !(Number(r.qty) > 0) ? 'Số thùng phải > 0' : null);
  const invalid = rows.some(rowErr);

  const submit = async () => {
    setTried(true);
    if (invalid || !wh) return;
    const r = await create.mutateAsync({ warehouseCode: wh, note, lines: rows.map((x) => ({ sku: x.sku, expiry: x.expiry, qty: Number(x.qty), labels: Number(x.labels) || 1, lot: x.lot })) });
    navigate(`/receipts/${r.code}`);
  };

  return (
    <>
      <PageHeader back="/receipts" title="Tạo phiếu nhập kho" subtitle="Mỗi dòng sinh một batch; trùng kho-SKU-HSD thì cộng vào batch hiện có." />
      <Card title="Thông tin phiếu">
        <div className="form-grid cols-2">
          <FormField label="Kho nhận" required><Select value={wh} onChange={(e) => setWarehouse(e.target.value)} options={whs.map((w) => ({ value: w.code, label: `${w.code} · ${w.name}` }))} /></FormField>
          <FormField label="Ghi chú"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Nhập lô NSX tháng 9" /></FormField>
        </div>
      </Card>
      <Card title="Dòng hàng nhập" actions={<Button size="sm" onClick={() => setRows((r) => [...r, blank()])}>+ Thêm dòng</Button>}>
        <div className="stack-sm">
          {rows.map((r, i) => (
            <div key={i} className="form-grid" style={{ gridTemplateColumns: '2fr 1.2fr 0.8fr 0.7fr 1fr auto', alignItems: 'end' }}>
              <FormField label="SKU" error={tried ? rowErr(r) : null}>
                <Select value={r.sku} placeholder="— Chọn SKU —" onChange={(e) => update(i, { sku: e.target.value })} options={prods.map((p) => ({ value: p.sku, label: `${p.sku} · ${p.name}` }))} />
              </FormField>
              <FormField label="Hạn sử dụng"><Input type="date" value={r.expiry} onChange={(e) => update(i, { expiry: e.target.value })} /></FormField>
              <FormField label="Số thùng"><Input inputMode="numeric" value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} /></FormField>
              <FormField label="Số tem"><Input inputMode="numeric" value={r.labels} onChange={(e) => update(i, { labels: e.target.value })} /></FormField>
              <FormField label="Lô NSX"><Input value={r.lot} onChange={(e) => update(i, { lot: e.target.value })} /></FormField>
              <Button size="sm" variant="danger" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Xóa</Button>
              {r.sku && r.expiry && <span className="muted small" style={{ gridColumn: '1 / -1' }}>Batch: <b>{IdFormat.batch(wh, r.sku, r.expiry)}</b></span>}
            </div>
          ))}
        </div>
      </Card>
      {tried && invalid && <Callout tone="danger">Vui lòng hoàn tất các dòng hàng còn thiếu thông tin.</Callout>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={() => navigate('/receipts')}>Hủy</Button>
        <Button variant="primary" loading={create.isPending} onClick={submit}>Tạo phiếu nhập</Button>
      </div>
    </>
  );
}
