import { FormDialog } from '@/shared/ui';
import { addDays, formatDate, toIsoDate } from '@/shared/lib';
import { useCreateBatchDiscount } from '../hooks';
import type { DiscountSuggestion } from '../types';

/** Create "Giảm giá theo HSD" (KMB) for one or more batches with a common validity period. */
export function DiscountDialog({ items, onClose }: { items: DiscountSuggestion[] | null; onClose: () => void }) {
  const create = useCreateBatchDiscount();
  if (!items?.length) return null;
  const today = toIsoDate(new Date());
  const single = items.length === 1;
  return (
    <FormDialog
      open
      width={640}
      title={single ? `Tạo giảm giá theo HSD · ${items[0].batchCode}` : `Tạo giảm giá theo HSD · ${items.length} batch`}
      submitLabel="Tạo giảm giá"
      note={single ? undefined : `Batch: ${items.map((i) => i.batchCode).join(', ')}. Mỗi batch dùng % gợi ý theo bậc HSD còn lại.`}
      initial={{ discountPct: items[0].suggestedPct || '', validFrom: today, validTo: addDays(today, 14) }}
      fields={[
        ...(single ? [{ key: 'info', type: 'info' as const, label: 'Batch', span: 2 as const, info: () => `${items[0].productName} · HSD ${formatDate(items[0].expiry)} · còn ${items[0].remainingPct}% (${items[0].remainingDays} ngày) · ${items[0].available} thùng` }] : []),
        ...(single ? [{ key: 'discountPct', type: 'number' as const, required: true, label: '% giảm giá', hint: `Gợi ý theo bậc: ${items[0].suggestedPct}%`, validate: (v: unknown) => (Number(v) <= 0 || Number(v) >= 100 ? '% giảm phải nằm trong (0, 100).' : undefined) }] : []),
        { key: 'validFrom', type: 'date', required: true, label: 'Hiệu lực từ' },
        { key: 'validTo', type: 'date', required: true, label: 'Hiệu lực đến', validate: (v, all) => (String(v) < String(all.validFrom) ? 'Ngày kết thúc phải sau ngày bắt đầu.' : undefined) },
      ]}
      onClose={onClose}
      onSubmit={async (v) => {
        await create.mutateAsync({
          items: items.map((i) => ({ batchCode: i.batchCode, discountPct: single ? Number(v.discountPct) : i.suggestedPct || 10 })),
          validFrom: v.validFrom,
          validTo: v.validTo,
        });
        onClose();
      }}
    />
  );
}
