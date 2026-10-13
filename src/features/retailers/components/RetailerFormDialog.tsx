import { FormDialog, type FormFieldDef } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import { useCreateRetailer, useRetailerLookups, useUpdateRetailer } from '../hooks';
import type { Retailer } from '../types';

const KINDS = ['Tạp hóa', 'Siêu thị mini', 'Quán cà phê', 'Nhà hàng', 'Cửa hàng tiện lợi'];

/** Create (Admin) / edit retailer. The 8-digit code is the key, read-only when editing. */
export function RetailerFormDialog({ open, retailer, onClose }: { open: boolean; retailer?: Retailer | null; onClose: () => void }) {
  const { areas, groups } = useRetailerLookups(open);
  const create = useCreateRetailer();
  const update = useUpdateRetailer();
  if (!open || !areas.data || !groups.data) return null;
  const edit = !!retailer;
  const fields: FormFieldDef[] = [
    { key: 'code', label: 'Mã retailer (8 chữ số)', required: true, readOnly: edit, validate: (v) => (!IdFormat.isRetailerCode(String(v)) ? 'Mã gồm đúng 8 chữ số.' : undefined) },
    { key: 'name', label: 'Tên điểm bán', required: true, span: 2 },
    { key: 'address', label: 'Địa chỉ', required: true, span: 3 },
    { key: 'phone', label: 'Số điện thoại', required: true, validate: (v) => (!IdFormat.isPhone(String(v)) ? 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.' : undefined) },
    { key: 'contact', label: 'Người liên hệ' },
    { key: 'kind', label: 'Loại hình', type: 'select', options: KINDS },
    { key: 'areaCode', label: 'Khu vực', type: 'select', options: areas.data.map((a) => ({ value: a.code, label: a.name })) },
    { key: 'groupCode', label: 'Nhóm Sales', type: 'select', options: groups.data.map((g) => ({ value: g.code, label: g.code })) },
    { key: 'size', label: 'Quy mô', type: 'select', options: ['S', 'M', 'L'] },
    { key: 'lat', label: 'Vĩ độ', type: 'number', required: true },
    { key: 'lng', label: 'Kinh độ', type: 'number', required: true },
    { key: 'areaM2', label: 'Diện tích (m²)', type: 'number' },
    { key: 'fridges', label: 'Số tủ mát', type: 'number' },
    { key: 'forecastRevenue', label: 'Doanh thu dự báo / tháng', type: 'number', required: true },
    { key: 'monthlyCapacity', label: 'Sức mua (thùng / tháng)', type: 'number', required: true },
    { key: 'orderFrequency', label: 'Tần suất đặt hàng', type: 'select', options: ['1 lần/tuần', '2 lần/tuần', '3 lần/tuần', 'Hằng ngày'] },
    { key: 'creditTermDays', label: 'Kỳ hạn công nợ', type: 'select', options: [{ value: '0', label: 'Không công nợ' }, { value: '7', label: '7 ngày' }, { value: '14', label: '14 ngày' }, { value: '30', label: '30 ngày' }] },
    { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'Active', label: 'Hoạt động' }, { value: 'Locked', label: 'Đã khóa' }] },
  ];
  const first = areas.data[0]?.code ?? '';
  return (
    <FormDialog
      open
      width={860}
      columns={3}
      title={edit ? `Sửa retailer ${retailer!.code}` : 'Tạo retailer'}
      submitLabel={edit ? 'Lưu' : 'Tạo retailer'}
      initial={retailer ? { ...retailer, creditTermDays: String(retailer.creditTermDays) } : { code: '', name: '', address: '', phone: '', contact: '', kind: KINDS[0], areaCode: first, groupCode: groups.data.find((g) => g.areaCode === first)?.code ?? groups.data[0]?.code ?? '', size: 'M', lat: '', lng: '', areaM2: '', fridges: '', forecastRevenue: '', monthlyCapacity: '', orderFrequency: '1 lần/tuần', creditTermDays: '0', status: 'Active' }}
      fields={fields}
      onClose={onClose}
      onSubmit={async (v) => {
        const input = { ...v, creditTermDays: Number(v.creditTermDays) as Retailer['creditTermDays'], lat: Number(v.lat), lng: Number(v.lng), forecastRevenue: Number(v.forecastRevenue), monthlyCapacity: Number(v.monthlyCapacity) };
        await (edit ? update.mutateAsync({ ...input, code: retailer!.code }) : create.mutateAsync(input));
        onClose();
      }}
    />
  );
}
