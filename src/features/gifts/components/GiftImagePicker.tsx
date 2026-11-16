import { useEffect, useId, useRef, useState } from 'react';
import { giftImageError } from '../imageUpload';

interface Props {
  file: File | null;
  imageUrl: string;
  onFile: (file: File | null) => void;
  onUrl: (url: string) => void;
}

export function GiftImagePicker({ file, imageUrl, onFile, onUrl }: Props) {
  const id = useId();
  const [preview, setPreview] = useState(() => file ? URL.createObjectURL(file) : null);
  const blob = useRef(preview);
  const [error, setError] = useState('');
  useEffect(() => () => {
    if (blob.current) URL.revokeObjectURL(blob.current);
  }, []);

  const choose = (selected: File | null) => {
    setError('');
    if (selected) {
      const validation = giftImageError(selected);
      if (validation) { setError(validation); return; }
    }
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = selected ? URL.createObjectURL(selected) : null;
    setPreview(blob.current);
    onFile(selected);
  };
  const source = file ? preview : imageUrl;
  return <div style={{ display: 'grid', gap: 10 }}>
    <span className="fl">Ảnh quà</span>
    {source && <img src={source} alt="Ảnh quà xem trước" style={{ maxWidth: '100%', width: 180, height: 140, objectFit: 'contain', borderRadius: 8 }} />}
    <div className="row-wrap" style={{ gap: 10 }}>
      <label className="btn" htmlFor={id}>{file || imageUrl ? 'Chọn ảnh khác' : 'Chọn ảnh từ máy'}</label>
      <input id={id} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }}
        onChange={event => { const selected = event.target.files?.[0]; if (selected) choose(selected); event.target.value = ''; }} />
      {file && <button className="btn btn-sm" type="button" onClick={() => choose(null)}>Bỏ ảnh đã chọn</button>}
    </div>
    <span className="muted small">JPG, PNG hoặc WebP · tối đa 10 MB. Ảnh được tải lên khi bấm Lưu quà.</span>
    {file && <span className="small">{file.name}</span>}
    {error && <p role="alert" className="danger">{error}</p>}
    <details><summary>Dùng đường dẫn ảnh có sẵn</summary>
      <input className="inp" aria-label="URL ảnh có sẵn" value={imageUrl} placeholder="https://…"
        onChange={event => { choose(null); onUrl(event.target.value); }} />
    </details>
  </div>;
}
