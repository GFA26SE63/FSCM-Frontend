import { useEffect, useMemo, useRef, useState } from 'react';
import { toApiError } from '@/shared/api/errors';
import {
  Button,
  Callout,
  FormField,
  Input,
  Modal,
  Select,
  useToast,
} from '@/shared/ui';
import {
  useCreateWarehouse,
  useRetailerMapPoints,
  useUpdateWarehouse,
  useWarehouseKeepers,
  useWarehouses,
} from '../hooks';
import type { MapPoint, Warehouse, WarehouseInput } from '../types';
import { forwardGeocode, reverseGeocode } from '../lib/geocoding';
import { buildWarehouseMapDoc } from './warehouseMap';

const empty: WarehouseInput = {
  code: 'WH-HM',
  name: '',
  address: 'Xã Bà Điểm, H. Hóc Môn, TP. Hồ Chí Minh',
  lat: 10.8891,
  lng: 106.5912,
  type: 'Regional',
  keeperId: null,
  keeperName: null,
  capacityPallets: 280,
  minStock: 40,
  status: 'Active',
};

export function WarehouseDialog({
  open,
  warehouse,
  onClose,
}: {
  open: boolean;
  warehouse?: Warehouse | null;
  onClose: () => void;
}) {
  const edit = !!warehouse;
  const [form, setForm] = useState<WarehouseInput>(empty);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const [pendingPick, setPendingPick] = useState<{ lat: number; lng: number } | null>(null);
  const mapIframeRef = useRef<HTMLIFrameElement | null>(null);

  const create = useCreateWarehouse();
  const update = useUpdateWarehouse();
  const { data: allWarehouses = [] } = useWarehouses();
  const { data: keepers = [] } = useWarehouseKeepers(open);
  const { data: retailers = [] } = useRetailerMapPoints(open);
  const toast = useToast();

  useEffect(() => {
    if (warehouse) {
      const matchedKeeper = keepers.find(
        (k) => k.id === warehouse.keeperId || k.name === warehouse.keeperName,
      );
      setForm({
        code: warehouse.code,
        name: warehouse.name,
        address: warehouse.address,
        lat: warehouse.lat,
        lng: warehouse.lng,
        type: warehouse.type,
        keeperId: warehouse.keeperId ?? matchedKeeper?.id ?? null,
        keeperName: warehouse.keeperName,
        capacityPallets: warehouse.capacityPallets,
        minStock: warehouse.minStock ?? (warehouse.type === 'Central' ? 80 : 30),
        status: warehouse.status,
      });
    } else {
      setForm(empty);
    }
    setErrors({});
    setGeneralError(null);
    setPendingPick(null);
    setPickerModalOpen(false);
  }, [warehouse, open, keepers]);

  // Synchronize Map Picking -> Address & Coordinates
  const handleCoordPicked = async (pickedLat: number, pickedLng: number) => {
    const lat = Math.round(pickedLat * 10000) / 10000;
    const lng = Math.round(pickedLng * 10000) / 10000;
    setForm((prev) => ({ ...prev, lat, lng }));
    setPendingPick({ lat, lng });

    setGeocoding(true);
    try {
      const resolvedAddress = await reverseGeocode(lat, lng);
      if (resolvedAddress) {
        setForm((prev) => ({ ...prev, address: resolvedAddress }));
        toast.show(`Đã chọn tọa độ [${lat}, ${lng}] và đồng bộ địa chỉ: ${resolvedAddress}`);
      } else {
        toast.show(`Đã chọn tọa độ [${lat}, ${lng}].`);
      }
    } catch {
      toast.show(`Đã chọn tọa độ [${lat}, ${lng}].`);
    } finally {
      setGeocoding(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onMessage = (ev: MessageEvent) => {
      if (
        ev.data &&
        typeof ev.data === 'object' &&
        (ev.data.type === 'mapPick' || ev.data.type === 'fscm:pick-coords') &&
        typeof ev.data.lat === 'number' &&
        typeof ev.data.lng === 'number'
      ) {
        handleCoordPicked(ev.data.lat, ev.data.lng);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open]);

  // Synchronize Address Input -> Map Coordinates
  const handleGeocodeFromAddress = async () => {
    if (!form.address.trim()) return;
    setGeocoding(true);
    try {
      const coords = await forwardGeocode(form.address);
      if (coords) {
        setForm((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }));
        mapIframeRef.current?.contentWindow?.postMessage(
          { type: 'setPoint', lat: coords.lat, lng: coords.lng },
          '*',
        );
        toast.show(`Đã định vị tọa độ [${coords.lat}, ${coords.lng}] từ địa chỉ.`);
      } else {
        toast.show('Không tìm thấy tọa độ chính xác cho địa chỉ này, vui lòng chọn trên bản đồ.');
      }
    } catch {
      toast.show('Không thể tra cứu tọa độ từ địa chỉ.');
    } finally {
      setGeocoding(false);
    }
  };

  const set = <K extends keyof WarehouseInput>(k: K, v: WarehouseInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const keeperOptions = useMemo(() => {
    const list = [...keepers];
    if (
      form.keeperName &&
      !list.some((k) => k.name === form.keeperName || k.id === form.keeperId)
    ) {
      list.unshift({
        id: form.keeperId ?? form.keeperName,
        name: form.keeperName,
      });
    }
    return list;
  }, [keepers, form.keeperId, form.keeperName]);

  const mapSrcDoc = useMemo(() => {
    const lat = Number(form.lat) || 10.8891;
    const lng = Number(form.lng) || 106.5912;
    const points: MapPoint[] = [
      ...allWarehouses
        .filter((w) => w.code !== form.code)
        .map((w) => ({
          lat: w.lat || 10.87,
          lng: w.lng || 106.65,
          kind: (w.type === 'Central' ? 'central' : 'wh') as MapPoint['kind'],
          label: `${w.code} · ${w.name}`,
          sub: `${w.address} · ${w.type === 'Central' ? 'Kho tổng' : 'Kho vùng'}`,
        })),
      ...retailers.map((r) => ({
        lat: r.lat || 10.87,
        lng: r.lng || 106.65,
        kind: 'ret' as const,
        label: r.name,
        sub: `${r.code} · ${r.address}`,
      })),
      {
        lat,
        lng,
        kind: form.type === 'Central' ? 'central' : 'wh',
        label: `${form.code || 'WH-NEW'} · ${form.name || 'Kho mới'}`,
        sub: form.address || 'Vị trí đang chọn',
      },
    ];
    return buildWarehouseMapDoc({
      center: [lat, lng],
      points,
      radiusKm: 20,
      zoom: 12,
      interactivePick: true,
    });
  }, [allWarehouses, retailers, form.code, form.name, form.address, form.lat, form.lng, form.type]);

  const validate = (): boolean => {
    const nextErr: Record<string, string[]> = {};
    const code = form.code.trim().toUpperCase();
    if (!edit) {
      if (!/^WH-[A-Z]{2,4}$/.test(code)) {
        nextErr.code = ['Định dạng WH- + 2–4 chữ in hoa.'];
      } else if (allWarehouses.some((w) => w.code.toUpperCase() === code)) {
        nextErr.code = ['Mã đã tồn tại.'];
      }
    }
    if (!form.name.trim()) nextErr.name = ['Bắt buộc nhập.'];
    if (!form.address.trim()) nextErr.address = ['Bắt buộc nhập.'];
    if (!Number.isFinite(Number(form.minStock)) || Number(form.minStock) <= 0) {
      nextErr.minStock = ['Phải là số > 0.'];
    }
    if (!Number.isFinite(Number(form.lat))) nextErr.lat = ['Phải là số.'];
    if (!Number.isFinite(Number(form.lng))) nextErr.lng = ['Phải là số.'];

    setErrors(nextErr);
    return Object.keys(nextErr).length === 0;
  };

  const busy = create.isPending || update.isPending || geocoding;

  const submit = async () => {
    if (!validate()) return;
    setGeneralError(null);
    try {
      const payload: WarehouseInput = {
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        address: form.address.trim(),
      };
      if (edit && warehouse) {
        await update.mutateAsync({ code: warehouse.code, body: payload });
        toast.show(
          `Đã cập nhật kho ${payload.code} và tính lại khoảng cách đường bộ tới tất cả retailer.`,
        );
      } else {
        await create.mutateAsync(payload);
        toast.show(
          `Đã tạo kho ${payload.code} (${payload.name}) và tính khoảng cách đường bộ tới tất cả retailer.`,
        );
      }
      onClose();
    } catch (e) {
      const err = toApiError(e);
      if (Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(err.detail ?? err.title);
      }
    }
  };

  return (
    <>
      <Modal
        open={open}
        title={edit ? `Sửa kho ${warehouse!.code}` : 'Thêm kho'}
        subtitle="Master data · Kho"
        width={780}
        onClose={onClose}
        footer={
          <>
            <span className="muted small spacer">* Trường bắt buộc</span>
            <Button onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? 'Đang xử lý…' : edit ? 'Lưu thay đổi' : 'Tạo kho'}
            </Button>
          </>
        }
      >
        <div className="callout">
          Khi lưu tọa độ, hệ thống tính lại khoảng cách đường bộ (Dijkstra) từ kho tới tất cả retailer – dùng cho bước B2a (phạm vi 20 km) và ETA.
        </div>

        {generalError && <Callout tone="bad">{generalError}</Callout>}

        <div className="form-sec" style={{ marginTop: 12 }}>
          <div className="form-sec-title" style={{ fontWeight: 700, marginBottom: 10 }}>
            Thông tin kho
          </div>
          <div className="form-grid cols-3">
            <FormField label="Mã kho" required={!edit} error={errors.code?.[0]}>
              {edit ? (
                <div className="inp readonly">{form.code}</div>
              ) : (
                <Input
                  invalid={!!errors.code?.[0]}
                  value={form.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase())}
                  placeholder="WH-HM"
                />
              )}
            </FormField>

            <FormField label="Tên kho" required span={2} error={errors.name?.[0]}>
              <Input
                invalid={!!errors.name?.[0]}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ví dụ Kho Hóc Môn"
              />
            </FormField>

            <FormField
              label="Loại kho"
              hint="Kho tổng nhận hàng từ nhà sản xuất và bổ sung cho kho vùng"
            >
              <Select
                value={form.type}
                options={[
                  { value: 'Regional', label: 'Kho vùng' },
                  { value: 'Central', label: 'Kho tổng' },
                ]}
                onChange={(e) => {
                  const nextType = e.target.value as Warehouse['type'];
                  set('type', nextType);
                  if (!edit && (form.minStock === 30 || form.minStock === 40 || form.minStock === 80)) {
                    set('minStock', nextType === 'Central' ? 80 : 40);
                  }
                }}
              />
            </FormField>

            <FormField
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Địa chỉ
                  {geocoding && (
                    <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                      (Đang đồng bộ…)
                    </span>
                  )}
                </span>
              }
              required
              span={2}
              error={errors.address?.[0]}
              hint="Địa chỉ được tự động đồng bộ khi kéo/chọn điểm trên bản đồ"
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <Input
                  style={{ flex: 1 }}
                  invalid={!!errors.address?.[0]}
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  onBlur={handleGeocodeFromAddress}
                  placeholder="Nhập địa chỉ hoặc chọn trên bản đồ"
                />
                <Button
                  size="sm"
                  title="Tìm tọa độ trên bản đồ từ địa chỉ này"
                  disabled={geocoding || !form.address.trim()}
                  onClick={handleGeocodeFromAddress}
                >
                  Định vị
                </Button>
              </div>
            </FormField>

            <FormField label="Sức chứa (pallet)">
              <Input
                type="number"
                value={form.capacityPallets}
                onChange={(e) => set('capacityPallets', Number(e.target.value))}
              />
            </FormField>

            <FormField
              label="Tồn tối thiểu (thùng / SKU)"
              required
              hint="Cảnh báo khi lượng có thể cấp của một SKU thấp hơn mức này"
              error={errors.minStock?.[0]}
            >
              <Input
                type="number"
                invalid={!!errors.minStock?.[0]}
                value={form.minStock}
                onChange={(e) => set('minStock', Number(e.target.value))}
              />
            </FormField>

            <FormField label="Vĩ độ (lat)" required error={errors.lat?.[0]}>
              <Input
                type="number"
                step="0.0001"
                invalid={!!errors.lat?.[0]}
                value={form.lat}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  set('lat', val);
                  mapIframeRef.current?.contentWindow?.postMessage(
                    { type: 'setPoint', lat: val, lng: form.lng },
                    '*',
                  );
                }}
              />
            </FormField>

            <FormField label="Kinh độ (lng)" required error={errors.lng?.[0]}>
              <Input
                type="number"
                step="0.0001"
                invalid={!!errors.lng?.[0]}
                value={form.lng}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  set('lng', val);
                  mapIframeRef.current?.contentWindow?.postMessage(
                    { type: 'setPoint', lat: form.lat, lng: val },
                    '*',
                  );
                }}
              />
            </FormField>

            <FormField label="Vị trí trên bản đồ">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  onClick={() => setPickerModalOpen(true)}
                >
                  Mở bản đồ chọn vị trí
                </Button>
                <span className="muted" style={{ fontSize: 12 }}>
                  [{form.lat}, {form.lng}]
                </span>
              </div>
            </FormField>

            <FormField label="Trạng thái">
              <Select
                value={form.status}
                options={[
                  { value: 'Active', label: 'Hoạt động' },
                  { value: 'Paused', label: 'Tạm ngừng' },
                ]}
                onChange={(e) => set('status', e.target.value as Warehouse['status'])}
              />
            </FormField>

            <FormField
              label={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>Bản đồ vị trí kho & bán kính phục vụ 20 km (Kéo ghim hoặc nhấp để đồng bộ địa chỉ)</span>
                  <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                    Click bản đồ để đổi vị trí
                  </span>
                </div>
              }
              span={3}
            >
              <iframe
                ref={mapIframeRef}
                title="Bản đồ vị trí kho"
                srcDoc={mapSrcDoc}
                style={{
                  width: '100%',
                  height: 290,
                  border: '1px solid #E2E5E0',
                  borderRadius: 8,
                }}
              />
            </FormField>
          </div>
        </div>

        <div className="form-sec" style={{ marginTop: 16 }}>
          <div className="form-sec-title" style={{ fontWeight: 700, marginBottom: 10 }}>
            Phân công
          </div>
          <div className="form-grid cols-2">
            <FormField
              label="Thủ kho"
              hint="Thủ kho chỉ thao tác (nhập, soạn, xuất, hủy) trên kho được gán."
            >
              <Select
                value={form.keeperName ?? ''}
                options={[
                  { value: '', label: '— Chưa gán' },
                  ...keeperOptions.map((k) => ({
                    value: k.name,
                    label: `${k.name}${k.scope && k.scope !== '—' ? ` (${k.scope})` : ''}`,
                  })),
                ]}
                onChange={(e) => {
                  const selectedName = e.target.value || null;
                  const matched = keeperOptions.find((k) => k.name === selectedName);
                  setForm((prev) => ({
                    ...prev,
                    keeperName: selectedName,
                    keeperId: matched?.id ?? null,
                  }));
                }}
              />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Dedicated Full Map Picker Modal matching prototype FSCM_Prototype_Prod_v1.1.html lines 142-205 */}
      <Modal
        open={pickerModalOpen}
        title="Chọn vị trí trên bản đồ"
        subtitle="Click bản đồ hoặc kéo ghim để chọn điểm & đồng bộ địa chỉ kho"
        width={740}
        onClose={() => setPickerModalOpen(false)}
        footer={
          <>
            <span className="muted small spacer">
              {pendingPick
                ? `Lat: ${pendingPick.lat.toFixed(4)}   Lng: ${pendingPick.lng.toFixed(4)}`
                : `Lat: ${form.lat.toFixed(4)}   Lng: ${form.lng.toFixed(4)}`}
            </span>
            <Button onClick={() => setPickerModalOpen(false)}>Hủy</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingPick) {
                  handleCoordPicked(pendingPick.lat, pendingPick.lng);
                }
                setPickerModalOpen(false);
              }}
            >
              Xác nhận
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#3D4441' }}>
            Địa chỉ hiện tại: <strong>{form.address}</strong>
          </div>
          <iframe
            title="Bản đồ chọn vị trí"
            srcDoc={mapSrcDoc}
            style={{
              width: '100%',
              height: 440,
              border: '1px solid #E2E5E0',
              borderRadius: 8,
            }}
          />
        </div>
      </Modal>
    </>
  );
}
