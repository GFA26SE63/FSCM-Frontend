import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';

export function PalletCamera({ disabled, onScan, target = 'pallet' }: { disabled: boolean; onScan: (code: string) => Promise<void>; target?: 'pallet' | 'thùng' }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  function stop() {
    generation.current++;
    controls.current?.stop(); controls.current = null;
    setActive(false);
  }
  useEffect(() => () => { generation.current++; controls.current?.stop(); }, []);
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera cần HTTPS và trình duyệt hỗ trợ camera.'); return; }
    setError(''); setActive(true);
    const current = ++generation.current;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (current !== generation.current || !video.current) return;
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, video.current!, (result, _error, scanner) => {
        if (!result || current !== generation.current) return;
        generation.current++; scanner.stop(); controls.current = null; setActive(false);
        void onScan(result.getText());
      });
      if (current !== generation.current) scanner.stop();
      else controls.current = scanner;
    } catch {
      if (current !== generation.current) return;
      stop(); setError('Không mở được camera. Cho phép truy cập camera trong trình duyệt rồi thử lại.');
    }
  }
  return <div className="pallet-camera">
    <p>Đưa QR trên {target} thực tế vào camera. Quét chỉ đối chiếu và ghi nhận lần quét; chưa cộng tồn.</p>
    <video ref={video} muted playsInline hidden={!active} aria-label={`Camera quét QR ${target}`} style={{ width: '100%', maxWidth: 480, borderRadius: 8 }} />
    {error && <p role="alert">{error}</p>}
    {active ? <button className="btn" onClick={stop}>Dừng camera</button>
      : <button className="btn btn-primary" disabled={disabled} onClick={() => void start()}>Quét QR {target} bằng camera</button>}
  </div>;
}
