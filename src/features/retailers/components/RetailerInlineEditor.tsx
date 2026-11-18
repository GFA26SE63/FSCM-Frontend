import { useState } from 'react';
import { AddressLocationPicker, Button, Card, Input, Select, TextArea, useToast } from '@/shared/ui';
import { hasRetailerProfileChanges, retailerProfilePayload } from '../profileForm';
import { useUpdateRetailerProfile } from '../hooks';
import type { Retailer } from '../types';

const KINDS = [
  { value: 'GroceryStore', label: 'Tạp hóa' },
  { value: 'MiniSupermarket', label: 'Siêu thị mini' },
  { value: 'ConvenienceStore', label: 'Cửa hàng tiện lợi' },
  { value: 'MarketStall', label: 'Sạp chợ' },
];

function valuesOf(retailer: Retailer) {
  return {
    name: retailer.name ?? '', contactName: retailer.contactName || retailer.contact || '', phone: retailer.phone || '',
    email: retailer.email || '', address: retailer.address || '',
    retailerType: KINDS.find((kind) => kind.value === retailer.retailerType || kind.label === retailer.retailerType || kind.label === retailer.kind)?.value ?? retailer.retailerType ?? KINDS[0].value,
    lat: String(retailer.latitude ?? retailer.lat ?? ''), lng: String(retailer.longitude ?? retailer.lng ?? ''),
    storeSizeSquareMeters: String(retailer.storeSizeSquareMeters ?? retailer.areaM2 ?? ''),
    forecastRevenue: String(retailer.forecastRevenue ?? ''), purchasingCapacity: String(retailer.purchasingCapacity ?? retailer.monthlyCapacity ?? ''),
    purchaseFrequencyPerMonth: String(retailer.purchaseFrequencyPerMonth ?? 4),
    creditTermDays: String(retailer.requestedCreditTermDays ?? retailer.creditTermDays ?? 0), assessmentNote: retailer.assessmentNote || '',
  };
}

/** The editable counterpart of the retailer profile's read-only detail cards. */
export function RetailerInlineEditor({ retailer, onCancel }: { retailer: Retailer; onCancel: () => void }) {
  const initial = valuesOf(retailer);
  const [values, setValues] = useState(initial);
  const update = useUpdateRetailerProfile();
  const toast = useToast();
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!hasRetailerProfileChanges(initial, values)) {
      toast.show('Chưa có thay đổi nào.');
      onCancel();
      return;
    }
    await update.mutateAsync({ retailerId: retailer.id || retailer.code, payload: retailerProfilePayload(values) });
    onCancel();
  };
  const field = (label: string, key: keyof typeof values, type: 'text' | 'number' | 'email' = 'text') => (
    <label className="lbl retailer-edit-field"><span>{label}</span><Input type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : undefined} value={values[key]} onChange={(event) => set(key, event.target.value)} /></label>
  );

  return (
    <div className="stack retailer-inline-editor" style={{ gap: 20 }}>
      <div className="callout callout-info">Chế độ chỉnh sửa đang bật. Các trường có nền xanh nhạt có thể thay đổi; mã nhà bán lẻ, khu vực và nhóm phụ trách do hệ thống quản lý.</div>
      <Card title="A. Thông tin liên hệ">
        <div className="form-grid cols-3">
          {field('Tên nhà bán lẻ', 'name')}
          <label className="lbl retailer-edit-field retailer-readonly-field"><span>Mã nhà bán lẻ</span><Input value={retailer.code} readOnly /></label>
          {field('Người liên hệ', 'contactName')}{field('Số điện thoại', 'phone')}{field('Email', 'email', 'email')}
        </div>
      </Card>
      <Card title="B. Vị trí & tọa độ">
        <div className="form-grid cols-3">
          <label className="lbl retailer-edit-field retailer-readonly-field"><span>Khu vực / Vùng hoạt động</span><Input value={retailer.areaName || retailer.areaCode || 'Chưa có thông tin'} readOnly /></label>
          <label className="lbl retailer-edit-field retailer-readonly-field"><span>Nhóm bán hàng phụ trách</span><Input value={retailer.salesGroupCode || retailer.groupCode || 'Chưa có thông tin'} readOnly /></label>
          <label className="lbl retailer-edit-field retailer-readonly-field"><span>Phiên bản vị trí</span><Input value={retailer.locationVersion != null ? `v${retailer.locationVersion}` : 'Chưa có thông tin'} readOnly /></label>
        </div>
        <div style={{ marginTop: 16 }}><AddressLocationPicker mode="edit" address={values.address} lat={values.lat} lng={values.lng} entityKind="ret" entityName={values.name} required onAddressChange={(value) => set('address', value)} onCoordinatesChange={(lat, lng) => { set('lat', String(lat)); set('lng', String(lng)); }} height={320} /></div>
      </Card>
      <Card title="C. Quy mô kinh doanh">
        <div className="form-grid cols-3">
          <label className="lbl retailer-edit-field"><span>Loại hình nhà bán lẻ</span><Select value={values.retailerType} options={KINDS} onChange={(event) => set('retailerType', event.target.value)} /></label>
          {field('Diện tích cửa hàng (m²)', 'storeSizeSquareMeters', 'number')}{field('Sức mua / tháng (thùng)', 'purchasingCapacity', 'number')}{field('Tần suất mua hàng / tháng', 'purchaseFrequencyPerMonth', 'number')}
        </div>
      </Card>
      <Card title="D. Tiềm năng kinh doanh & khai báo">
        <div className="form-grid cols-3">
          {field('Doanh thu dự báo / tháng', 'forecastRevenue', 'number')}
          <label className="lbl retailer-edit-field"><span>Kỳ hạn công nợ yêu cầu (ngày)</span><Select value={values.creditTermDays} options={['0', '7', '14', '30']} onChange={(event) => set('creditTermDays', event.target.value)} /></label>
          <label className="lbl retailer-edit-field span-3" style={{ gridColumn: 'span 3' }}><span>Đánh giá / ghi chú</span><TextArea value={values.assessmentNote} onChange={(event) => set('assessmentNote', event.target.value)} /></label>
        </div>
      </Card>
      <div className="retailer-edit-actions"><Button onClick={onCancel} disabled={update.isPending}>Hủy</Button><Button variant="primary" loading={update.isPending} onClick={() => void save()}>Lưu thay đổi</Button></div>
    </div>
  );
}
