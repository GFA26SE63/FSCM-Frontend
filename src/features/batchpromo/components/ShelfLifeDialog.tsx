import { useState } from 'react';
import { Button, Callout, FormField, Input, Modal, SearchSelect, Select } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import { usePromoLookups } from '@/features/promos/hooks';
import { usePublishShelfLife } from '../hooks';
import type { ShelfLifeTier } from '../types';

const blank = (): ShelfLifeTier => ({ scope: 'Sku', productId: '', minRemainingPercent: 0, maxRemainingPercent: 20, discountType: 'Percent', discountValue: 10 });

export function ShelfLifeDialog({ initial, onClose }: { initial: ShelfLifeTier[]; onClose: () => void }) {
  const { products, categories } = usePromoLookups();
  const publish = usePublishShelfLife();
  const [tiers, setTiers] = useState<ShelfLifeTier[]>(initial.length ? initial.map((tier) => ({ ...tier, id: undefined })) : [blank()]);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const update = (index: number, patch: Partial<ShelfLifeTier>) => setTiers((items) => items.map((t, i) => i === index ? { ...t, ...patch } : t));
  const save = async () => {
    if (!date || !tiers.length || tiers.some((t) => !(t.scope === 'Sku' ? t.productId : t.productCategoryId) ||
      !Number.isFinite(t.minRemainingPercent) || !Number.isFinite(t.maxRemainingPercent) || !Number.isFinite(t.discountValue) ||
      t.minRemainingPercent < 0 || t.maxRemainingPercent > 100 || t.maxRemainingPercent <= t.minRemainingPercent ||
      t.discountValue <= 0 || (t.discountType === 'Percent' && t.discountValue >= 100))) {
      setError('Chọn sản phẩm hoặc nhóm hàng cho mỗi bậc. Khoảng HSD phải nằm trong 0–100%, mức giảm phải hợp lệ.'); return;
    }
    setError('');
    try {
      await publish.mutateAsync({ effectiveFrom: new Date(`${date}T00:00:00+07:00`).toISOString(), note: note || undefined, tiers });
      onClose();
    } catch { /* Keep inputs and display the mutation error. */ }
  };
  return <Modal open title="Publish bảng giảm theo HSD" width={900} onClose={onClose} footer={<>
    <Button disabled={publish.isPending} onClick={onClose}>Hủy</Button><Button variant="primary" loading={publish.isPending} onClick={save}>Publish</Button>
  </>}>
    <div className="stack-sm">
      <FormField label="Hiệu lực từ" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
      <FormField label="Ghi chú"><Input value={note} onChange={(e) => setNote(e.target.value)} /></FormField>
      {tiers.map((tier, i) => <div className="card stack-sm" style={{ padding: 16 }} key={i}>
        <div className="row"><strong className="spacer">Bậc {i + 1}</strong><Button size="sm" disabled={tiers.length === 1} onClick={() => setTiers((items) => items.filter((_, j) => i !== j))}>Xóa bậc</Button></div>
        <div className="form-grid cols-2">
          <FormField label="Phạm vi"><Select value={tier.scope} options={[{ value: 'Sku', label: 'Sản phẩm' }, { value: 'Category', label: 'Nhóm hàng' }]}
            onChange={(e) => update(i, { scope: e.target.value as ShelfLifeTier['scope'], productId: null, productCategoryId: null })} /></FormField>
          <FormField label={tier.scope === 'Sku' ? 'Sản phẩm' : 'Nhóm hàng'} required>
            <SearchSelect value={(tier.scope === 'Sku' ? tier.productId : tier.productCategoryId) ?? ''}
              options={tier.scope === 'Sku' ? (products.data ?? []).filter((p) => p.status === 'Published' || p.id === tier.productId).map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))
                : (categories.data ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))}
              onChange={(v) => update(i, tier.scope === 'Sku' ? { productId: v } : { productCategoryId: v })} />
          </FormField>
          <FormField label="HSD còn lại từ (%)"><Input type="number" min={0} max={100} value={tier.minRemainingPercent} onChange={(e) => update(i, { minRemainingPercent: e.target.valueAsNumber })} /></FormField>
          <FormField label="Đến dưới (%)"><Input type="number" min={0} max={100} value={tier.maxRemainingPercent} onChange={(e) => update(i, { maxRemainingPercent: e.target.valueAsNumber })} /></FormField>
          <FormField label="Kiểu giảm"><Select value={tier.discountType} options={[{ value: 'Percent', label: 'Phần trăm' }, { value: 'FixedPerUnit', label: 'Tiền / đơn vị' }]} onChange={(e) => update(i, { discountType: e.target.value as ShelfLifeTier['discountType'] })} /></FormField>
          <FormField label={tier.discountType === 'Percent' ? 'Mức giảm (%)' : 'Mức giảm (đ / đơn vị)'}><Input type="number" min={0} value={tier.discountValue} onChange={(e) => update(i, { discountValue: e.target.valueAsNumber })} /></FormField>
        </div>
      </div>)}
      <Button onClick={() => setTiers((items) => [...items, blank()])}>+ Thêm bậc giảm</Button>
      {(error || publish.error || products.error || categories.error) && <Callout tone="danger">{error || errorMessage(publish.error || products.error || categories.error)}</Callout>}
    </div>
  </Modal>;
}
