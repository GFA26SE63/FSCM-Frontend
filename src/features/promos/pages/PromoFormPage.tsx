import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Checkbox, FormField, Input, PageHeader, Select } from '@/shared/ui';
import { addDays, toIsoDate } from '@/shared/lib';
import { useCreatePromo, usePromoLookups } from '../hooks';
import type { PromoType } from '../types';

interface Rule { sku: string; minQty: string; pct: string }

/** "Tạo khuyến mãi": per-SKU rules, or a product group with one total minimum and one shared %. */
export function PromoFormPage() {
  const navigate = useNavigate();
  const { products, retailers } = usePromoLookups();
  const create = useCreatePromo();
  const today = toIsoDate(new Date());
  const [name, setName] = useState('');
  const [type, setType] = useState<PromoType>('PerSku');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [rules, setRules] = useState<Rule[]>([{ sku: '', minQty: '', pct: '' }]);
  const [groupSkus, setGroupSkus] = useState<string[]>([]);
  const [groupMin, setGroupMin] = useState('');
  const [groupPct, setGroupPct] = useState('');
  const [scope, setScope] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  const prods = (products.data ?? []).filter((p) => p.status === 'Published');
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Bắt buộc nhập.';
  if (to < from) errors.to = 'Ngày kết thúc phải sau ngày bắt đầu.';
  if (type === 'PerSku' && rules.some((r) => !r.sku || !(Number(r.minQty) > 0) || !(Number(r.pct) > 0 && Number(r.pct) < 100))) errors.rules = 'Mỗi dòng cần SKU, số lượng tối thiểu > 0 và % giảm trong (0, 100).';
  if (type === 'Group' && (groupSkus.length < 2 || !(Number(groupMin) > 0) || !(Number(groupPct) > 0 && Number(groupPct) < 100))) errors.group = 'Chọn ít nhất 2 sản phẩm, số lượng tối thiểu và % giảm chung.';
  const bad = Object.keys(errors).length > 0;

  const upd = (i: number, p: Partial<Rule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const toggle = (list: string[], set: (v: string[]) => void, v: string, on: boolean) => set(on ? [...list, v] : list.filter((x) => x !== v));

  const submit = async () => {
    setTried(true);
    if (bad) return;
    const p = await create.mutateAsync({
      name, type, validFrom: from, validTo: to, retailerCodes: scope,
      rules: type === 'PerSku' ? rules.map((r) => ({ sku: r.sku, minQty: Number(r.minQty), discountPct: Number(r.pct) })) : [],
      groupSkus: type === 'Group' ? groupSkus : [], groupMinQty: Number(groupMin) || 0, groupDiscountPct: Number(groupPct) || 0,
    });
    navigate(`/promos/${p.code}`);
  };

  return (
    <>
      <PageHeader back="/promos" title="Tạo khuyến mãi" subtitle="Mã KM-xxx do hệ thống cấp. Mỗi dòng hàng chỉ nhận một khuyến mãi tốt nhất." />
      <Card title="Thông tin chung">
        <div className="form-grid">
          <FormField label="Tên chương trình" required error={tried ? errors.name : null} span={3}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Mua nhiều giảm sâu tháng 10" /></FormField>
          <FormField label="Loại"><Select value={type} onChange={(e) => setType(e.target.value as PromoType)} options={[{ value: 'PerSku', label: 'Theo từng SKU' }, { value: 'Group', label: 'Nhóm sản phẩm' }]} /></FormField>
          <FormField label="Hiệu lực từ"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></FormField>
          <FormField label="Hiệu lực đến" error={tried ? errors.to : null}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></FormField>
        </div>
      </Card>
      {type === 'PerSku' ? (
        <Card title="Quy tắc theo SKU" actions={<Button size="sm" onClick={() => setRules((r) => [...r, { sku: '', minQty: '', pct: '' }])}>+ Thêm dòng</Button>}>
          <div className="stack-sm">
            {rules.map((r, i) => (
              <div key={i} className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr auto', alignItems: 'end' }}>
                <FormField label="SKU"><Select value={r.sku} placeholder="— Chọn SKU —" onChange={(e) => upd(i, { sku: e.target.value })} options={prods.map((p) => ({ value: p.sku, label: `${p.sku} · ${p.name}` }))} /></FormField>
                <FormField label="Mua tối thiểu (thùng)"><Input inputMode="numeric" value={r.minQty} onChange={(e) => upd(i, { minQty: e.target.value })} /></FormField>
                <FormField label="% giảm"><Input inputMode="numeric" value={r.pct} onChange={(e) => upd(i, { pct: e.target.value })} /></FormField>
                <Button size="sm" variant="danger" disabled={rules.length === 1} onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}>Xóa</Button>
              </div>
            ))}
          </div>
          {tried && errors.rules && <Callout tone="danger">{errors.rules}</Callout>}
        </Card>
      ) : (
        <Card title="Quy tắc nhóm sản phẩm">
          <div className="stack-sm">
            <div className="row-wrap">{prods.map((p) => <Checkbox key={p.sku} label={`${p.sku} · ${p.name}`} checked={groupSkus.includes(p.sku)} onChange={(v) => toggle(groupSkus, setGroupSkus, p.sku, v)} />)}</div>
            <div className="form-grid cols-2">
              <FormField label="Tổng tối thiểu của nhóm (thùng)"><Input inputMode="numeric" value={groupMin} onChange={(e) => setGroupMin(e.target.value)} /></FormField>
              <FormField label="% giảm chung"><Input inputMode="numeric" value={groupPct} onChange={(e) => setGroupPct(e.target.value)} /></FormField>
            </div>
            {tried && errors.group && <Callout tone="danger">{errors.group}</Callout>}
          </div>
        </Card>
      )}
      <Card title="Khách hàng áp dụng">
        <div className="stack-sm">
          <span className="muted small">Không chọn retailer nào = áp dụng cho tất cả.</span>
          <div className="row-wrap">{(retailers.data ?? []).filter((r) => r.status === 'Active').map((r) => <Checkbox key={r.code} label={`${r.name} (${r.code})`} checked={scope.includes(r.code)} onChange={(v) => toggle(scope, setScope, r.code, v)} />)}</div>
        </div>
      </Card>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={() => navigate('/promos')}>Hủy</Button>
        <Button variant="primary" loading={create.isPending} onClick={submit}>Tạo khuyến mãi</Button>
      </div>
    </>
  );
}
