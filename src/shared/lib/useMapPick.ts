import { useEffect, useRef, type RefObject } from 'react';

type FrameRef = RefObject<HTMLIFrameElement | null>;

/**
 * Nhận tọa độ người dùng chọn trên bản đồ (iframe từ buildMapDoc).
 * Chỉ chấp nhận tin nhắn từ chính các iframe được truyền vào, để nhiều bản đồ
 * trên cùng một màn hình không ảnh hưởng lẫn nhau.
 */
export function useMapPickMessages(frames: FrameRef[], onPick: (lat: number, lng: number) => void) {
  const handler = useRef(onPick);
  const framesRef = useRef(frames);
  useEffect(() => {
    handler.current = onPick;
    framesRef.current = frames;
  });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; lat?: unknown; lng?: unknown } | null;
      if (!data || (data.type !== 'mapPick' && data.type !== 'fscm:pick-coords')) return;
      if (!framesRef.current.some((f) => f.current?.contentWindow && f.current.contentWindow === e.source)) return;
      const { lat, lng } = data;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      handler.current(lat, lng);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
}

/** Di chuyển ghim trên các bản đồ đang mở mà không tải lại bản đồ. */
export function postMapPoint(frames: FrameRef[], lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  for (const f of frames) {
    f.current?.contentWindow?.postMessage({ type: 'setPoint', lat, lng }, '*');
  }
}
