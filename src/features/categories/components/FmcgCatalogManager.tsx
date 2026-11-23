import { useEffect, useState } from 'react';
import { Button, Callout, Card } from '@/shared/ui';
import { categoryApi } from '../api';
import type { FmcgCategoryCatalogVersion } from '../types';

const template = JSON.stringify({ categories: [{ name: 'Đồ uống', description: 'Nước uống đóng chai, nước giải khát và đồ uống tiêu dùng nhanh.' }] }, null, 2);

export function FmcgCatalogManager() {
  const [json, setJson] = useState(template);
  const [history, setHistory] = useState<FmcgCategoryCatalogVersion[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
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
  const file = async (value?: File) => { if (value) setJson(await value.text()); };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'danh-muc-fmcg.json'; a.click(); URL.revokeObjectURL(a.href); };
  return <Card title="Danh mục FMCG chuẩn (chỉ Admin)">
    <p className="muted">Tải file JSON hoặc dán nội dung. Cấu hình này độc lập với danh mục sản phẩm trong database.</p>
    <input type="file" accept="application/json,.json" onChange={e => void file(e.target.files?.[0])} />
    <textarea className="inp" rows={12} value={json} onChange={e => setJson(e.target.value)} aria-label="JSON danh mục FMCG" />
    <div className="row-wrap"><Button loading={saving} variant="primary" onClick={() => void save()}>Lưu phiên bản mới</Button><Button onClick={download}>Tải JSON hiện tại</Button><span className="muted">{history.length ? `${history.length} phiên bản · đang dùng v${history.find(x => x.isActive)?.version ?? '—'}` : 'Chưa có phiên bản'}</span></div>
    {message && <Callout tone={message.startsWith('Đã') ? 'ok' : 'danger'}>{message}</Callout>}
  </Card>;
}
