import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import { Input } from './FormField';
import { Modal } from './Modal';
import { buildMapDoc, type MapPoint } from '@/shared/lib/mapDoc';
import { forwardGeocode, reverseGeocode } from '@/shared/lib/geocoding';

export interface AddressLocationPickerProps {
  mode?: 'view' | 'edit';
  address?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  onAddressChange?: (address: string) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  entityKind?: 'wh' | 'central' | 'ret';
  entityName?: string;
  readOnly?: boolean;
  required?: boolean;
  height?: number | string;
  error?: string;
  addressError?: string;
  showCoordinatesInputs?: boolean;
  showExpandButton?: boolean;
  radiusKm?: number;
  label?: string;
}

/**
 * Shared address & interactive map location picker and viewer.
 * Reusable across Warehouse and Retailer management.
 *
 * Edit mode:
 * - Address text input with explicit "Định vị" action button.
 * - Typing updates input only, no geocoding or map reloading on keystroke.
 * - Clicking "Định vị" forward-geocodes address, moves pin, updates lat/lng.
 * - Map picking/dragging updates coordinates and performs reverse geocoding.
 * - Preserves coordinates if reverse geocoding fails.
 * - Number inputs for latitude & longitude.
 *
 * View mode:
 * - Centered on saved coordinates with entity marker.
 * - Displays "Chưa có vị trí trên bản đồ." when coordinates are missing.
 */
export function AddressLocationPicker({
  mode = 'edit',
  address = '',
  lat,
  lng,
  onAddressChange,
  onCoordinatesChange,
  entityKind = 'ret',
  entityName,
  readOnly = false,
  required = false,
  height = 280,
  error,
  addressError,
  showCoordinatesInputs = true,
  showExpandButton = true,
  radiusKm = 0,
  label = 'Địa chỉ chi tiết',
}: AddressLocationPickerProps) {
  const numLat = lat != null && lat !== '' ? Number(lat) : null;
  const numLng = lng != null && lng !== '' ? Number(lng) : null;
  const hasCoordinates =
    numLat != null &&
    numLng != null &&
    Number.isFinite(numLat) &&
    Number.isFinite(numLng) &&
    numLat !== 0 &&
    numLng !== 0;

  // View Mode
  if (mode === 'view') {
    return (
      <AddressLocationViewer
        address={address}
        lat={hasCoordinates ? numLat : null}
        lng={hasCoordinates ? numLng : null}
        entityKind={entityKind}
        entityName={entityName}
        height={height}
        radiusKm={radiusKm}
      />
    );
  }

  // Edit Mode
  return (
    <AddressLocationEditor
      address={address}
      lat={numLat}
      lng={numLng}
      onAddressChange={onAddressChange}
      onCoordinatesChange={onCoordinatesChange}
      entityKind={entityKind}
      entityName={entityName}
      readOnly={readOnly}
      required={required}
      height={height}
      error={error}
      addressError={addressError}
      showCoordinatesInputs={showCoordinatesInputs}
      showExpandButton={showExpandButton}
      radiusKm={radiusKm}
      label={label}
    />
  );
}

function AddressLocationViewer({
  address,
  lat,
  lng,
  entityKind = 'ret',
  entityName,
  height = 280,
  radiusKm = 0,
}: {
  address?: string;
  lat: number | null;
  lng: number | null;
  entityKind?: 'wh' | 'central' | 'ret';
  entityName?: string;
  height?: number | string;
  radiusKm?: number;
}) {
  const hasCoordinates = lat != null && lng != null && lat !== 0 && lng !== 0;

  const points = useMemo<MapPoint[]>(() => {
    if (!hasCoordinates) return [];
    return [
      {
        lat: lat!,
        lng: lng!,
        kind: entityKind,
        label: entityName || (entityKind === 'ret' ? 'Điểm bán' : 'Kho'),
        sub: address,
      },
    ];
  }, [hasCoordinates, lat, lng, entityKind, entityName, address]);

  const mapSrcDoc = useMemo(() => {
    if (!hasCoordinates) return '';
    return buildMapDoc({
      center: [lat!, lng!],
      points,
      radiusKm,
      zoom: 14,
      interactivePick: false,
    });
  }, [hasCoordinates, lat, lng, points, radiusKm]);

  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  return (
    <div className="address-location-viewer" style={{ width: '100%' }}>
      {hasCoordinates ? (
        <>
          <div
            style={{
              position: 'relative',
              height,
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid #CBD5E1',
              background: '#EEF2EC',
            }}
          >
            <iframe
              srcDoc={mapSrcDoc}
              title="Bản đồ vị trí đã lưu"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
              fontSize: 12,
              color: 'var(--c-text-2, #64748B)',
            }}
          >
            <span>
              Tọa độ: [{lat}, {lng}]
            </span>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--primary, #14655B)',
                  textDecoration: 'underline',
                  fontWeight: 600,
                }}
              >
                Mở trên Google Maps ↗
              </a>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            padding: '24px 16px',
            background: '#F8FAFC',
            borderRadius: 6,
            border: '1px dashed #CBD5E1',
            textAlign: 'center',
          }}
        >
          {address && (
            <p style={{ margin: '0 0 6px 0', fontSize: 13, color: 'var(--c-text-1, #1E293B)' }}>
              <strong>Địa chỉ: </strong>
              {address}
            </p>
          )}
          <div style={{ color: 'var(--c-text-muted, #64748B)', fontSize: 13 }}>
            Chưa có vị trí trên bản đồ.
          </div>
        </div>
      )}
    </div>
  );
}

function AddressLocationEditor({
  address = '',
  lat,
  lng,
  onAddressChange,
  onCoordinatesChange,
  entityKind = 'ret',
  entityName,
  readOnly = false,
  required = false,
  height = 280,
  error,
  addressError,
  showCoordinatesInputs = true,
  showExpandButton = true,
  radiusKm = 0,
  label = 'Địa chỉ chi tiết',
}: {
  address?: string;
  lat: number | null;
  lng: number | null;
  onAddressChange?: (address: string) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  entityKind?: 'wh' | 'central' | 'ret';
  entityName?: string;
  readOnly?: boolean;
  required?: boolean;
  height?: number | string;
  error?: string;
  addressError?: string;
  showCoordinatesInputs?: boolean;
  showExpandButton?: boolean;
  radiusKm?: number;
  label?: string;
}) {
  const [geocoding, setGeocoding] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'ok' | 'error'>('ok');
  const [pickerModalOpen, setPickerModalOpen] = useState(false);

  const mapIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Stable coordinate anchor for iframe initialization:
  // Ensures iframe srcDoc is NOT re-rendered on address typing or keystroke!
  const initialAnchor = useMemo<[number, number]>(() => {
    const safeLat = lat != null && Number.isFinite(lat) && lat !== 0 ? lat : 10.8744;
    const safeLng = lng != null && Number.isFinite(lng) && lng !== 0 ? lng : 106.6511;
    return [safeLat, safeLng];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapSrcDoc = useMemo(() => {
    return buildMapDoc({
      center: initialAnchor,
      radiusKm,
      zoom: 13,
      interactivePick: true,
      pickHint: 'Nhấp hoặc kéo ghim để chọn vị trí & đồng bộ địa chỉ',
      pinTooltip: entityName || 'Vị trí đang chọn (kéo ghim để đổi)',
    });
  }, [initialAnchor, radiusKm, entityName]);

  // Handle Map Picking (both from embed iframe and enlarged modal)
  const handleMapPick = useCallback(
    async (pickedLat: number, pickedLng: number) => {
      const safeLat = Math.round(pickedLat * 10000) / 10000;
      const safeLng = Math.round(pickedLng * 10000) / 10000;

      // 1. Immediately update coordinates to preserve selected point
      onCoordinatesChange?.(safeLat, safeLng);

      // 2. Reverse geocode to address
      setReverseGeocoding(true);
      setFeedbackMsg(null);
      try {
        const resolvedAddress = await reverseGeocode(safeLat, safeLng);
        if (resolvedAddress && resolvedAddress.trim()) {
          onAddressChange?.(resolvedAddress.trim());
          setFeedbackTone('ok');
          setFeedbackMsg(`Đã chọn tọa độ [${safeLat}, ${safeLng}] và cập nhật địa chỉ.`);
        } else {
          setFeedbackTone('ok');
          setFeedbackMsg(`Đã chọn tọa độ [${safeLat}, ${safeLng}].`);
        }
      } catch {
        // Reverse geocoding failed: preserve coordinates, notify user
        setFeedbackTone('error');
        setFeedbackMsg('Không thể xác định địa chỉ tại vị trí này.');
      } finally {
        setReverseGeocoding(false);
      }
    },
    [onCoordinatesChange, onAddressChange],
  );

  // Listen to iframe map pick messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (
        (e.data?.type === 'mapPick' || e.data?.type === 'fscm:pick-coords') &&
        typeof e.data.lat === 'number' &&
        typeof e.data.lng === 'number'
      ) {
        handleMapPick(e.data.lat, e.data.lng);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMapPick]);

  // Handle explicit "Định vị" button action
  const handleGeocode = async () => {
    const q = address.trim();
    if (!q) {
      setFeedbackTone('error');
      setFeedbackMsg('Vui lòng nhập địa chỉ trước khi định vị.');
      return;
    }

    setGeocoding(true);
    setFeedbackMsg(null);
    try {
      const coords = await forwardGeocode(q);
      if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        onCoordinatesChange?.(coords.lat, coords.lng);
        // Pan map and move marker via postMessage without reloading iframe
        mapIframeRef.current?.contentWindow?.postMessage(
          { type: 'setPoint', lat: coords.lat, lng: coords.lng },
          '*',
        );
        setFeedbackTone('ok');
        setFeedbackMsg(`Đã định vị tọa độ: [${coords.lat}, ${coords.lng}]`);
      } else {
        setFeedbackTone('error');
        setFeedbackMsg('Không tìm thấy vị trí phù hợp với địa chỉ đã nhập.');
      }
    } catch {
      setFeedbackTone('error');
      setFeedbackMsg('Không tìm thấy vị trí phù hợp với địa chỉ đã nhập.');
    } finally {
      setGeocoding(false);
    }
  };

  const currentLat = lat ?? initialAnchor[0];
  const currentLng = lng ?? initialAnchor[1];

  return (
    <div className="address-location-picker" style={{ width: '100%' }}>
      {/* Address row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
            {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
          </label>
          <Input
            value={address}
            disabled={readOnly || reverseGeocoding}
            onChange={(e) => {
              onAddressChange?.(e.target.value);
              if (feedbackMsg) setFeedbackMsg(null);
            }}
            placeholder={
              reverseGeocoding
                ? 'Đang xác định địa chỉ từ bản đồ…'
                : 'Nhập địa chỉ và bấm Định vị hoặc chọn trên bản đồ'
            }
            invalid={!!addressError || (feedbackTone === 'error' && !!feedbackMsg)}
          />
        </div>
        <div style={{ paddingTop: 23 }}>
          <Button
            size="md"
            disabled={readOnly || geocoding || reverseGeocoding || !address.trim()}
            onClick={handleGeocode}
            title="Định vị tọa độ từ địa chỉ đã nhập"
          >
            {geocoding ? 'Đang định vị…' : 'Định vị'}
          </Button>
        </div>
      </div>

      {/* Feedback message / validation error */}
      {(addressError || error || feedbackMsg || geocoding || reverseGeocoding) && (
        <div
          style={{
            fontSize: 12,
            marginBottom: 6,
            fontWeight: 500,
            color:
              addressError || error || feedbackTone === 'error'
                ? '#DC2626'
                : '#0D9488',
          }}
        >
          {addressError ||
            error ||
            (geocoding
              ? 'Đang tìm kiếm tọa độ từ địa chỉ…'
              : reverseGeocoding
              ? 'Đang lấy địa chỉ từ bản đồ…'
              : feedbackMsg)}
        </div>
      )}

      {/* Embedded interactive map */}
      <div
        style={{
          position: 'relative',
          height,
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid #CBD5E1',
          background: '#EEF2EC',
          marginBottom: 8,
        }}
      >
        <iframe
          ref={mapIframeRef}
          srcDoc={mapSrcDoc}
          title="Bản đồ chọn vị trí"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>

      {/* Coordinates inputs */}
      {showCoordinatesInputs && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--c-text-2, #64748B)',
                marginBottom: 2,
              }}
            >
              Vĩ độ (Latitude) {required && <span style={{ color: '#DC2626' }}>*</span>}
            </label>
            <Input
              type="number"
              step="0.0001"
              value={lat ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const val = Number(e.target.value);
                onCoordinatesChange?.(val, lng ?? initialAnchor[1]);
                mapIframeRef.current?.contentWindow?.postMessage(
                  { type: 'setPoint', lat: val, lng: lng ?? initialAnchor[1] },
                  '*',
                );
              }}
              placeholder="Ví dụ: 10.8744"
            />
          </div>

          <div style={{ flex: 1 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--c-text-2, #64748B)',
                marginBottom: 2,
              }}
            >
              Kinh độ (Longitude) {required && <span style={{ color: '#DC2626' }}>*</span>}
            </label>
            <Input
              type="number"
              step="0.0001"
              value={lng ?? ''}
              disabled={readOnly}
              onChange={(e) => {
                const val = Number(e.target.value);
                onCoordinatesChange?.(lat ?? initialAnchor[0], val);
                mapIframeRef.current?.contentWindow?.postMessage(
                  { type: 'setPoint', lat: lat ?? initialAnchor[0], lng: val },
                  '*',
                );
              }}
              placeholder="Ví dụ: 106.6511"
            />
          </div>

          {showExpandButton && (
            <div>
              <Button size="md" onClick={() => setPickerModalOpen(true)}>
                Mở bản đồ lớn
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal for enlarged map */}
      {pickerModalOpen && (
        <Modal
          open
          width={860}
          title="Bản đồ chọn tọa độ"
          subtitle="Nhấp chuột vào bản đồ hoặc kéo ghim để chọn tọa độ chính xác"
          onClose={() => setPickerModalOpen(false)}
          footer={
            <Button variant="primary" onClick={() => setPickerModalOpen(false)}>
              Xong
            </Button>
          }
        >
          <div style={{ height: 480, borderRadius: 6, overflow: 'hidden' }}>
            <iframe
              srcDoc={buildMapDoc({
                center: [currentLat, currentLng],
                points: [
                  {
                    lat: currentLat,
                    lng: currentLng,
                    kind: entityKind,
                    label: entityName || (entityKind === 'ret' ? 'Điểm bán' : 'Kho'),
                    sub: address,
                  },
                ],
                interactivePick: true,
                zoom: 14,
                pickHint: 'Nhấp hoặc kéo ghim để chọn vị trí & đồng bộ địa chỉ',
              })}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Bản đồ phóng to"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
