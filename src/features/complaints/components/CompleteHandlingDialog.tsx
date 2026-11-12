import { useState } from 'react';
import { FormDialog } from '@/shared/ui';
import { useCompleteRequestHandling } from '../hooks';
import type { Complaint } from '../types';

export function CompleteHandlingDialog({ claim, onClose }: { claim: Complaint; onClose: () => void }) {
  const complete = useCompleteRequestHandling();
  const [localNow] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,23));
  return <FormDialog open title={`Xác nhận xử lý thực tế · ${claim.code}`} columns={1} width={600}
    initial={{ quantity: claim.approvedQuantity ?? 0, at: localNow, note: '', evidence: '' }} submitLabel="Xác nhận xử lý hàng" onClose={onClose}
    fields={[
      {key:'quantity', type:'number', label:'Số thùng đã xử lý thực tế', required:true,
        validate: v => !Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > (claim.approvedQuantity ?? 0) ? 'Từ 0 đến số được duyệt, theo thùng nguyên.' : undefined},
      {key:'at', type:'datetime-local', step:'any', label:'Thời gian xử lý', required:true,
        validate: v => !Number.isFinite(new Date(String(v)).getTime()) || new Date(String(v)).getTime() > Date.now() ? 'Thời gian hợp lệ, không ở tương lai.' : undefined},
      {key:'note', type:'textarea', label:'Kết quả xử lý ngoài hệ thống', required:true},
      {key:'evidence', type:'text', label:'Bằng chứng / mã biên bản / đường dẫn', required:true},
      {key:'policy', type:'info', label:'Lưu ý', info: () => 'Tài chính theo số thùng thực tế và giá đã chốt, sau khi đơn giao đủ. Bước này không nhập hàng hỏng vào tồn bán được.'},
    ]} onSubmit={async v => { await complete.mutateAsync({id:claim.id, expectedVersion:claim.version ?? 0,
      actualQuantity:Number(v.quantity), completedAt:new Date(String(v.at)).toISOString(), note:String(v.note).trim(), evidenceReference:String(v.evidence).trim()}); onClose(); }} />;
}
