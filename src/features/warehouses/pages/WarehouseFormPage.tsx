import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { toApiError } from '@/shared/api/errors';
import {
  Button,
  Callout,
  Card,
  FormField,
  Input,
  Modal,
  PageHeader,
  QueryState,
  Select,
  useToast,
} from '@/shared/ui';
import {
  useCreateWarehouse,
  useRegions,
  useRetailerMapPoints,
  useUpdateWarehouse,
  useWarehouse,
  useWarehouseKeepers,
  useWarehouses,
} from '../hooks';
import type { Warehouse, WarehouseInput } from '../types';
import { forwardGeocode, reverseGeocode } from '../lib/geocoding';
import { buildWarehouseMapDoc } from '../components/warehouseMap';

const defaultForm: WarehouseInput = {
  code: 'WH-HM',
  name: '',
  regionId: '',
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

export function WarehouseFormPage() {
  const { code, regionId: routeRegionId } = useParams<{ code?: string; regionId?: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const queryRegionId = searchParams.get('regionId') || routeRegionId || '';

  const edit = Boolean(code);
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const query = useWarehouse(edit ? code! : '', false);

  if (!isAdmin) {
    return <Callout tone="danger">403 — Bạn không có quyền quản lý kho.</Callout>;
  }

  if (edit) {
    return (
      <QueryState query={query}>
        {(wh) => <WarehouseEditor key={wh.code} initialWarehouse={wh} defaultRegionId={queryRegionId} />}
      </QueryState>
    );
  }

  return <WarehouseEditor defaultRegionId={queryRegionId} />;
}

function WarehouseEditor({
  initialWarehouse,
  defaultRegionId = '',
}: {
  initialWarehouse?: Warehouse;
  defaultRegionId?: string;
}) {
  const edit = Boolean(initialWarehouse);
  const navigate = useNavigate();
  const toast = useToast();

  const { data: regions = [] } = useRegions();
  const { data: allWarehouses = [] } = useWarehouses();
  const { data: keepers = [] } = useWarehouseKeepers(true);
  const { data: retailers = [] } = useRetailerMapPoints(true);

  const initialRegionId = initialWarehouse?.regionId || defaultRegionId || '';

  const [form, setForm] = useState<WarehouseInput>(() => {
    if (initialWarehouse) {
      return {
        code: initialWarehouse.code,
        name: initialWarehouse.name,
        regionId: initialRegionId,
        address: initialWarehouse.address,
        lat: initialWarehouse.lat,
        lng: initialWarehouse.lng,
        type: initialWarehouse.type || 'Regional',
        keeperId: initialWarehouse.keeperId ?? null,
        keeperName: initialWarehouse.keeperName ?? null,
        capacityPallets: initialWarehouse.capacityPallets || 280,
        minStock: initialWarehouse.minStock ?? 30,
        status: initialWarehouse.status || 'Active',
      };
    }
    return {
      ...defaultForm,
      regionId: initialRegionId,
    };
  });

  // Auto-fill region if not yet set and regions arrive
  useEffect(() => {
    if (!form.regionId && regions.length > 0) {
      const preferred = defaultRegionId && regions.some((r) => r.id === defaultRegionId)
        ? defaultRegionId
        : regions[0].id;
      setForm((prev) => ({ ...prev, regionId: preferred }));
    }
  }, [regions, defaultRegionId, form.regionId]);

  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [pickerModalOpen, setPickerModalOpen] = useState(false);
  const mapIframeRef = useRef<HTMLIFrameElement | null>(null);

  const create = useCreateWarehouse();
  const update = useUpdateWarehouse();

  // Link keeper if options arrive
  useEffect(() => {
    if (initialWarehouse && keepers.length > 0 && !form.keeperId) {
      const match = keepers.find(
        (k) => k.id === initialWarehouse.keeperId || k.name === initialWarehouse.keeperName,
      );
      if (match) {
        setForm((prev) => ({ ...prev, keeperId: match.id, keeperName: match.name }));
      }
    }
  }, [initialWarehouse, keepers, form.keeperId]);

  // Coordinate picked on Map -> reverse geocode to address
  const handleCoordPicked = useCallback(async (pickedLat: number, pickedLng: number) => {
    const lat = Math.round(pickedLat * 10000) / 10000;
    const lng = Math.round(pickedLng * 10000) / 10000;
    setForm((prev) => ({ ...prev, lat, lng }));

    setGeocoding(true);
    try {
      const resolvedAddress = await reverseGeocode(lat, lng);
      if (resolvedAddress) {
        setForm((prev) => ({ ...prev, address: resolvedAddress }));
      }
    } catch {
      // Fallback
    } finally {
      setGeocoding(false);
    }
  }, []);

  // Listen to iframe map messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (
        (e.data?.type === 'mapPick' || e.data?.type === 'fscm:pick-coords') &&
        typeof e.data.lat === 'number' &&
        typeof e.data.lng === 'number'
      ) {
        void handleCoordPicked(e.data.lat, e.data.lng);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleCoordPicked]);

  // Address changed -> forward geocode to coordinates
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
      }
    } catch {
      // Keep existing coords
    } finally {
      setGeocoding(false);
    }
  };

  const set = <K extends keyof WarehouseInput>(field: K, value: WarehouseInput[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const mapSrcDoc = useMemo(() => {
    const otherWh = allWarehouses
      .filter((w) => w.code.toUpperCase() !== form.code.trim().toUpperCase())
      .map((w) => ({
        lat: w.lat || 10.87,
        lng: w.lng || 106.65,
        kind: 'wh' as const,
        label: `${w.code} · ${w.name}`,
        sub: w.address,
      }));

    const retPoints = retailers.map((r) => ({
      lat: r.lat || 10.87,
      lng: r.lng || 106.65,
      kind: 'ret' as const,
      label: r.name,
      sub: `${r.code} · ${r.address}`,
    }));

    return buildWarehouseMapDoc({
      center: [form.lat || 10.8891, form.lng || 106.5912],
      points: [
        {
          lat: form.lat || 10.8891,
          lng: form.lng || 106.5912,
          kind: 'wh',
          label: `${form.code || 'Mới'} · ${form.name || 'Kho mới'}`,
          sub: form.address,
        },
        ...otherWh,
        ...retPoints,
      ],
      radiusKm: 20,
      zoom: 12,
      interactivePick: true,
    });
  }, [allWarehouses, retailers, form.code, form.name, form.address, form.lat, form.lng]);

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
    if (!form.regionId) nextErr.regionId = ['Vui lòng chọn vùng kho.'];
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
        regionId: form.regionId,
        address: form.address.trim(),
        type: 'Regional',
      };

      if (edit && initialWarehouse) {
        await update.mutateAsync({ code: initialWarehouse.code, body: payload });
        toast.show(
          `Đã lưu ${payload.code} và tính lại khoảng cách tới retailer.`,
        );
        navigate(`/whs/${payload.code}`);
      } else {
        await create.mutateAsync(payload);
        toast.show(
          `Đã tạo ${payload.code} và tính lại khoảng cách tới retailer.`,
        );
        if (payload.regionId) {
          navigate(`/whs/regions/${payload.regionId}`);
        } else {
          navigate(`/whs/${payload.code}`);
        }
      }
    } catch (e) {
      const err = toApiError(e);
      if (Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(err.detail ?? err.title);
      }
    }
  };

  const keeperOptions = useMemo(() => {
    const list = [...keepers];
    if (form.keeperName && !list.some((k) => k.name === form.keeperName)) {
      list.push({
        id: form.keeperId || 'temp',
        name: form.keeperName,
        scope: form.code,
      });
    }
    return list;
  }, [keepers, form.keeperId, form.keeperName, form.code]);

  return (
    <>
      <PageHeader
        back={form.regionId ? `/whs/regions/${form.regionId}` : '/whs'}
        title={edit ? `Sửa kho ${form.code}` : 'Thêm kho mới'}
        subtitle="Quản lý thông tin vị trí kho, vùng trực thuộc và phân công thủ kho"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => navigate(form.regionId ? `/whs/regions/${form.regionId}` : '/whs')}
            >
              Hủy
            </Button>
            <Button variant="primary" disabled={busy} onClick={submit}>
              {busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Tạo kho'}
            </Button>
          </div>
        }
      />

      {generalError && (
        <Callout tone="danger">{generalError}</Callout>
      )}

      {/* Card 1: Thông tin kho */}
      <Card title="Thông tin kho">
        <div className="form-grid cols-3">
          <FormField label="Mã kho *" error={errors.code?.[0]}>
            {edit ? (
              <div className="inp readonly" style={{ fontWeight: 600 }}>
                {form.code}
              </div>
            ) : (
              <Input
                invalid={!!errors.code?.[0]}
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="WH-HM"
              />
            )}
          </FormField>

          <FormField label="Tên kho *" error={errors.name?.[0]}>
            <Input
              invalid={!!errors.name?.[0]}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ví dụ Kho Hóc Môn"
            />
          </FormField>

          <FormField label="Vùng kho trực thuộc *" error={errors.regionId?.[0]}>
            <Select
              value={form.regionId}
              onChange={(e) => set('regionId', e.target.value)}
              options={[
                { value: '', label: '— Chọn vùng kho —' },
                ...regions.map((r) => ({
                  value: r.id,
                  label: `${r.name} (${r.code})`,
                })),
              ]}
            />
          </FormField>

          <FormField
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Địa chỉ *
                {geocoding && (
                  <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                    (Đang đồng bộ…)
                  </span>
                )}
              </span>
            }
            span={2}
            error={errors.address?.[0]}
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
                title="Định vị tọa độ từ địa chỉ"
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
            label="Tồn tối thiểu (thùng / SKU) *"
            error={errors.minStock?.[0]}
          >
            <Input
              type="number"
              invalid={!!errors.minStock?.[0]}
              value={form.minStock}
              onChange={(e) => set('minStock', Number(e.target.value))}
            />
          </FormField>

          <FormField label="Vĩ độ (lat) *" error={errors.lat?.[0]}>
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

          <FormField label="Kinh độ (lng) *" error={errors.lng?.[0]}>
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

          <FormField label="Chọn trên bản đồ">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
              <Button
                size="sm"
                onClick={() => setPickerModalOpen(true)}
              >
                Mở bản đồ phóng to
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
                <span>Bản đồ vị trí kho so với kho và điểm bán hiện có (vòng tròn = bán kính phục vụ 20 km)</span>
                <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                  Kéo ghim hoặc bấm vào bản đồ để chọn tọa độ
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
                height: 340,
                border: '1px solid #E2E5E0',
                borderRadius: 8,
              }}
            />
          </FormField>
        </div>
      </Card>

      {/* Card 2: Phân công */}
      <Card title="Phân công" style={{ marginTop: 14 }}>
        <div className="form-grid cols-2">
          <FormField label="Thủ kho">
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
                  keeperId: matched?.id || null,
                  keeperName: selectedName,
                }));
              }}
            />
          </FormField>
        </div>
      </Card>

      {/* Modal phóng to bản đồ */}
      <Modal
        open={pickerModalOpen}
        title="Chọn vị trí kho trên bản đồ Vietmap"
        subtitle="Bấm hoặc kéo ghim đến vị trí mong muốn để đồng bộ tọa độ & địa chỉ"
        width={1000}
        onClose={() => setPickerModalOpen(false)}
        footer={<Button onClick={() => setPickerModalOpen(false)}>Xác nhận vị trí</Button>}
      >
        <iframe
          title="Bản đồ phóng to"
          srcDoc={mapSrcDoc}
          style={{
            width: '100%',
            height: 580,
            border: '1px solid #E2E5E0',
            borderRadius: 8,
          }}
        />
      </Modal>
    </>
  );
}
