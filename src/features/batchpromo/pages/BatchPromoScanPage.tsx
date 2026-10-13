import { useState } from 'react';
import { Button, Callout, Card, FormField, Input, PageHeader } from '@/shared/ui';
import { useToast } from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import { scanLabel, useDiscountSuggestions } from '../hooks';
import { DiscountDialog } from '../components/DiscountDialog';
import type { DiscountSuggestion, LabelInfo } from '../types';

/** "Quét tem batch": identify a batch from its label (or type a batch code) and create its HSD discount. */
export function BatchPromoScanPage() {
  const toast = useToast();
  const suggestions = useDiscountSuggestions();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState<LabelInfo | null>(null);
  const [match, setMatch] = useState<DiscountSuggestion | null>(null);
  const [open, setOpen] = useState(false);

  const find = async () => {
    const value = code.trim();
    if (!value) return toast.show('Nhập mã tem (TEM-000205) hoặc mã batch.');
    let batchCode = value;
    setLabel(null);
    if (/^TEM-/i.test(value)) {
      try {
        const l = await scanLabel(value.toUpperCase());
        setLabel(l);
        batchCode = l.batchCode;
      } catch (e) {
        toast.error(e);
        return;
      }
    }
    const s = suggestions.data?.find((x) => x.batchCode === batchCode) ?? null;
    setMatch(s);
    if (!s) toast.show('Không tìm thấy batch còn hạn và còn hàng với mã này.');
  };

  return (
    <>
      <PageHeader back="/batchpromo" title="Quét tem batch" subtitle="Thủ kho / Admin quét tem để chọn nhanh batch cần giảm giá theo HSD." />
      <Card>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="spacer"><FormField label="Mã tem hoặc mã batch"><Input value={code} placeholder="TEM-000205 hoặc WH-TA-SKU001-31102026" onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void find()} /></FormField></div>
          <Button variant="primary" onClick={() => void find()}>Tìm batch</Button>
        </div>
      </Card>
      {label && <Callout tone="info">Tem {label.code} thuộc phiếu điều chuyển {label.transferCode}: {label.qty} thùng {label.productName}, HSD {formatDate(label.expiry)}.</Callout>}
      {match && (
        <Card title={match.batchCode} actions={<Button variant="primary" onClick={() => setOpen(true)}>Tạo giảm giá</Button>}>
          <span>{match.productName} · {match.warehouseName} · HSD {formatDate(match.expiry)} · còn {match.remainingPct}% ({match.remainingDays} ngày) · khả dụng {match.available} thùng · gợi ý giảm {match.suggestedPct}%.</span>
        </Card>
      )}
      <DiscountDialog items={open && match ? [match] : null} onClose={() => setOpen(false)} />
    </>
  );
}
