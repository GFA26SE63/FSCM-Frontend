import { useEffect } from 'react';
import { useLocation } from '@/shared/router/compat';

const appScheme = 'fscm://payos/return';

/** Public PayOS return/cancel fallback. No session is required because PayOS
 * supplies only display status; authoritative settlement remains the webhook. */
export function PayOsCallbackPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const cancelled = params.get('cancel') === 'true' || params.get('status') === 'CANCELLED';
  const paid = params.get('status') === 'PAID';
  const title = paid ? 'Thanh toán thành công' : cancelled ? 'Đã hủy thanh toán' : 'Đã nhận kết quả thanh toán';
  const detail = paid
    ? 'Hệ thống đang đồng bộ xác nhận từ PayOS. Bạn có thể quay lại ứng dụng để xem kết quả.'
    : cancelled
      ? 'Giao dịch đã được hủy. Bạn có thể quay lại ứng dụng để tiếp tục.'
      : 'Bạn có thể quay lại ứng dụng và kiểm tra lại trạng thái thanh toán.';
  const deepLink = `${appScheme}${location.search}`;

  useEffect(() => {
    const timer = window.setTimeout(() => { window.location.href = deepLink; }, 700);
    return () => window.clearTimeout(timer);
  }, [deepLink]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f8f7' }}>
      <section style={{ maxWidth: 440, width: '100%', padding: 32, borderRadius: 20, background: '#fff', textAlign: 'center', boxShadow: '0 8px 30px #163c3120' }}>
        <div style={{ fontSize: 40 }}>{paid ? '✓' : cancelled ? '×' : 'i'}</div>
        <h1 style={{ margin: '12px 0 8px', fontSize: 24, color: '#173d34' }}>{title}</h1>
        <p style={{ margin: 0, color: '#5e6b66', lineHeight: 1.5 }}>{detail}</p>
        <button type="button" onClick={() => { window.location.href = deepLink; }} style={{ marginTop: 24, width: '100%', border: 0, borderRadius: 10, padding: '13px 16px', background: '#0f6b5c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Quay lại ứng dụng FSCM
        </button>
        <p style={{ margin: '16px 0 0', fontSize: 13, color: '#78837f' }}>Nếu ứng dụng không tự mở, hãy mở FSCM và chọn “Kiểm tra”.</p>
      </section>
    </main>
  );
}
