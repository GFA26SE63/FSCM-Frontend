import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Button, Callout, Card, Modal } from '@/shared/ui';
import { categoryApi } from '../api';
import type { FmcgCategoryCatalogVersion } from '../types';

const template = JSON.stringify({ categories: [{ name: 'Đồ uống', description: 'Nước uống đóng chai, nước giải khát và đồ uống tiêu dùng nhanh.' }] }, null, 2);

export function FmcgCatalogManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState(template);
  const [history, setHistory] = useState<FmcgCategoryCatalogVersion[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const load = async () => {
    const [current, versions] = await Promise.all([categoryApi.getFmcgCatalog(), categoryApi.getFmcgCatalogHistory()]);
    if (current.document.categories.length) setJson(JSON.stringify(current.document, null, 2));
    setHistory(versions);
  };
  useEffect(() => { void load().catch(e => setMessage(e instanceof Error ? e.message : 'Không tải được cấu hình.')); }, []);
  const save = async () => {
    setMessage(''); setSaving(true);
    try {
      const parsed = JSON.parse(json) as { categories?: Array<{ name?: string; description?: string }> };
      if (!Array.isArray(parsed.categories) || !parsed.categories.length || parsed.categories.some(x => !x.name?.trim() || !x.description?.trim())) throw new Error('JSON phải có categories không rỗng; mỗi phần tử cần name và description.');
      await categoryApi.saveFmcgCatalog({ categories: parsed.categories.map(x => ({ name: x.name!.trim(), description: x.description!.trim() })) });
      setMessage('Đã lưu và kích hoạt phiên bản cấu hình FMCG mới.'); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'JSON không hợp lệ.'); } finally { setSaving(false); }
  };
  const readFile = async (value?: File) => {
    if (!value) return;
    if (!value.name.toLowerCase().endsWith('.json') && value.type !== 'application/json') {
      setMessage('Vui lòng chọn tệp JSON hợp lệ.');
      return;
    }
    setMessage('');
    setJson(await value.text());
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files?.[0]);
  };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'danh-muc-fmcg.json'; a.click(); URL.revokeObjectURL(a.href); };
  const activeVersion = history.find((version) => version.isActive)?.version;

  return <>
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 20, minHeight: 46 }}>
        <div>
          <div className="sec" style={{ marginBottom: 8 }}>Danh mục FMCG chuẩn</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Cập nhật bộ danh mục chuẩn dùng để kiểm tra tính phù hợp của danh mục sản phẩm.
            {history.length > 0 && ` ${history.length} phiên bản · đang dùng v${activeVersion ?? '—'}.`}
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>Upload file</Button>
      </div>
    </Card>

    <Modal
      open={open}
      title="Cập nhật danh mục FMCG chuẩn"
      subtitle="Tải lên một tệp JSON mới hoặc chỉnh sửa nội dung cấu hình hiện tại."
      width={760}
      onClose={() => setOpen(false)}
      footer={<><Button onClick={download}>Tải JSON hiện tại</Button><Button variant="primary" loading={saving} onClick={() => void save()}>Lưu phiên bản mới</Button></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {message && <Callout tone={message.startsWith('Đã') ? 'ok' : 'danger'}>{message}</Callout>}
        <input ref={inputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={event => void readFile(event.target.files?.[0])} />
        <div
          onDragEnter={event => { event.preventDefault(); setDragging(true); }}
          onDragOver={event => event.preventDefault()}
          onDragLeave={event => { if (event.currentTarget === event.target) setDragging(false); }}
          onDrop={handleDrop}
          style={{ border: `1px dashed ${dragging ? '#0F5E55' : '#B8C2BC'}`, background: dragging ? '#F0F8F5' : '#F8FAF8', borderRadius: 8, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
        >
          <div><div style={{ fontWeight: 600, marginBottom: 3 }}>Kéo thả tệp JSON vào đây</div><div className="muted" style={{ fontSize: 13 }}>hoặc chọn tệp từ thiết bị của bạn</div></div>
          <Button onClick={() => inputRef.current?.click()}>Choose File</Button>
        </div>
        <label htmlFor="fmcg-catalog-json" style={{ fontWeight: 600, fontSize: 13 }}>Nội dung danh mục hiện tại</label>
        <textarea id="fmcg-catalog-json" className="inp" rows={15} value={json} onChange={event => setJson(event.target.value)} aria-label="JSON danh mục FMCG" style={{ resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.5 }} />
      </div>
    </Modal>
  </>;
}
