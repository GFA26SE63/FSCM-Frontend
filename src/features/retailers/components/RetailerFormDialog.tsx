import { AddressLocationPicker, FormDialog, Modal, useToast, type FormFieldDef } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import {
  useCreateRetailer,
  useRetailerLookups,
  useUpdateCreditTerms,
  useUpdateRetailerProfile,
} from '../hooks';
import type { Retailer, UpdateRetailerProfilePayload } from '../types';
import { hasRetailerProfileChanges, retailerProfilePayload } from '../profileForm';

const KINDS = [
  { value: 'GroceryStore', label: 'Tạp hóa' },
  { value: 'MiniSupermarket', label: 'Siêu thị mini' },
  { value: 'ConvenienceStore', label: 'Cửa hàng tiện lợi' },
  { value: 'MarketStall', label: 'Sạp chợ' },
];

/** Create (Admin) / edit retailer. Prepopulates and validates saved values. */
export function RetailerFormDialog({
  open,
  retailer,
  onClose,
}: {
  open: boolean;
  retailer?: Retailer | null;
  onClose: () => void;
}) {
  const { areas, groups } = useRetailerLookups(open);
  const create = useCreateRetailer();
  const updateProfile = useUpdateRetailerProfile();
  const updateCreditTerms = useUpdateCreditTerms();
  const toast = useToast();

  if (!open) return null;

  const edit = Boolean(retailer);

  if (areas.isLoading || groups.isLoading) {
    return (
      <Modal
        open
        width={500}
        title={edit ? `Sửa thông tin hồ sơ ${retailer!.code}` : 'Tạo mới nhà bán lẻ'}
        onClose={onClose}
      >
        <div className="loading" style={{ padding: '36px 20px', textAlign: 'center' }}>
          <span className="spinner" /> Đang tải dữ liệu biểu mẫu…
        </div>
      </Modal>
    );
  }

  const rawAreas = areas.data ?? [];
  const rawGroups = groups.data ?? [];

  const areaOptions = rawAreas.map((a) => ({
    value: a.code,
    label: a.name ? `${a.name} (${a.code})` : a.code,
  }));

  if (retailer?.areaCode && !areaOptions.some((o) => o.value === retailer.areaCode)) {
    areaOptions.unshift({
      value: retailer.areaCode,
      label: retailer.areaName ? `${retailer.areaName} (${retailer.areaCode})` : retailer.areaCode,
    });
  }

  const groupOptions = rawGroups.map((g) => ({
    value: g.code,
    label: g.name ? `${g.name} (${g.code})` : g.code,
  }));

  if (retailer?.groupCode && !groupOptions.some((o) => o.value === retailer.groupCode)) {
    groupOptions.unshift({
      value: retailer.groupCode,
      label: retailer.salesGroupCode || retailer.groupCode,
    });
  }

  const fields: FormFieldDef[] = [
    // The 8-digit code is issued by the system, so it is only shown (read-only) when editing.
    {
      key: 'code',
      label: 'Mã nhà bán lẻ',
      readOnly: true,
      visible: () => edit,
    },
    { key: 'name', label: 'Tên nhà bán lẻ', required: true, span: 2 },
    { key: 'contactName', label: 'Người liên hệ', required: true },
    {
      key: 'phone',
      label: 'Số điện thoại',
      required: true,
      validate: (v) =>
        !IdFormat.isPhone(String(v))
          ? 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'
          : undefined,
    },
    { key: 'email', label: 'Email', type: 'text', required: true },
    {
      key: 'address',
      label: 'Địa chỉ & Vị trí bản đồ',
      type: 'custom',
      required: true,
      span: 3,
      validate: (v, values) => {
        if (!v || !String(v).trim()) return 'Vui lòng nhập địa chỉ chi tiết.';
        const lat = Number(values.lat);
        const lng = Number(values.lng);
        if (!Number.isFinite(lat) || lat === 0 || !Number.isFinite(lng) || lng === 0) {
          return 'Vui lòng xác định tọa độ hợp lệ qua nút Định vị hoặc chọn trên bản đồ.';
        }
        return undefined;
      },
      render: (values, set, error) => (
        <AddressLocationPicker
          mode="edit"
          address={String(values.address ?? '')}
          lat={values.lat != null && values.lat !== '' ? Number(values.lat) : null}
          lng={values.lng != null && values.lng !== '' ? Number(values.lng) : null}
          onAddressChange={(newAddr) => set('address', newAddr)}
          onCoordinatesChange={(newLat, newLng) => {
            set('lat', newLat);
            set('lng', newLng);
          }}
          entityKind="ret"
          entityName={values.name ? String(values.name) : undefined}
          error={error}
          height={280}
          required
        />
      ),
    },
    { key: 'retailerType', label: 'Loại hình nhà bán lẻ', type: 'select', options: KINDS },
    {
      key: 'areaCode',
      label: 'Khu vực / Vùng hoạt động',
      type: 'select',
      readOnly: edit,
      options: areaOptions,
    },
    {
      key: 'groupCode',
      label: 'Nhóm bán hàng phụ trách',
      type: 'select',
      readOnly: edit,
      options: groupOptions,
    },
    { key: 'storeSizeSquareMeters', label: 'Diện tích (m²)', type: 'number' },
    {
      key: 'forecastRevenue',
      label: 'Doanh thu dự báo / tháng (VND)',
      type: 'number',
      required: true,
    },
    {
      key: 'purchasingCapacity',
      label: 'Sức mua (thùng / tháng)',
      type: 'number',
      required: true,
    },
    {
      key: 'purchaseFrequencyPerMonth',
      label: 'Tần suất mua hàng (lần / tháng)',
      type: 'number',
    },
    {
      key: 'assessmentNote',
      label: 'Đánh giá / Ghi chú của nhân viên bán hàng',
      type: 'textarea',
      span: 3,
    },
    {
      key: 'creditTermDays',
      label: 'Kỳ hạn công nợ đề xuất',
      type: 'select',
      // A new retailer gets its credit term when Admin approves it.
      visible: () => edit,
      options: [
        { value: '0', label: 'Không công nợ (chỉ trả trước)' },
        { value: '7', label: '7 ngày' },
        { value: '14', label: '14 ngày' },
        { value: '30', label: '30 ngày' },
      ],
    },
    {
      key: 'creditLimit',
      label: 'Hạn mức công nợ (VNĐ)',
      type: 'number',
      required: true,
      visible: () => edit,
      validate: (v) => Number(v) >= 0 ? undefined : 'Hạn mức công nợ không được âm.',
    },
    {
      key: 'status',
      label: 'Trạng thái hoạt động',
      type: 'select',
      readOnly: edit,
      // A new retailer always starts as PendingApproval.
      visible: () => edit,
      options: [
        { value: 'Active', label: 'Hoạt động' },
        { value: 'Locked', label: 'Đã khóa' },
        { value: 'Draft', label: 'Bản nháp' },
        { value: 'PendingApproval', label: 'Chờ duyệt' },
      ],
    },
  ];

  const first = areaOptions[0]?.value ?? '';
  const initialValues = retailer
    ? {
        code: retailer.code,
        name: retailer.name,
        contactName: retailer.contactName || retailer.contact || '',
        phone: retailer.phone || '',
        email: retailer.email || '',
        address: retailer.address || '',
        retailerType: KINDS.find(kind => kind.value === retailer.retailerType || kind.label === retailer.retailerType || kind.label === retailer.kind)?.value
          ?? retailer.retailerType ?? KINDS[0].value,
        areaCode: retailer.areaCode || first,
        groupCode:
          retailer.groupCode ||
          retailer.salesGroupCode ||
          rawGroups.find((g) => g.areaCode === (retailer.areaCode || first))?.code ||
          groupOptions[0]?.value ||
          '',
        lat: String(retailer.latitude ?? retailer.lat ?? ''),
        lng: String(retailer.longitude ?? retailer.lng ?? ''),
        storeSizeSquareMeters: String(
          retailer.storeSizeSquareMeters ?? retailer.areaM2 ?? '',
        ),
        forecastRevenue: String(retailer.forecastRevenue ?? ''),
        purchasingCapacity: String(
          retailer.purchasingCapacity ?? retailer.monthlyCapacity ?? '',
        ),
        purchaseFrequencyPerMonth: String(
          retailer.purchaseFrequencyPerMonth ?? 4,
        ),
        assessmentNote: retailer.assessmentNote || '',
        creditTermDays: String(
          retailer.requestedCreditTermDays ?? retailer.creditTermDays ?? 0,
        ),
        creditLimit: String(retailer.creditLimit ?? 0),
        status: retailer.status || 'Active',
      }
    : {
        code: '',
        name: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        retailerType: KINDS[0].value,
        areaCode: first,
        groupCode:
          rawGroups.find((g) => g.areaCode === first)?.code ??
          groupOptions[0]?.value ??
          '',
        lat: '',
        lng: '',
        storeSizeSquareMeters: '',
        forecastRevenue: '',
        purchasingCapacity: '',
        purchaseFrequencyPerMonth: '4',
        assessmentNote: '',
        creditTermDays: '0',
        status: 'Active',
      };

  return (
    <FormDialog
      open
      width={860}
      columns={3}
      title={edit ? `Sửa thông tin hồ sơ ${retailer!.code}` : 'Tạo mới nhà bán lẻ'}
      submitLabel={edit ? 'Lưu thay đổi' : 'Tạo nhà bán lẻ'}
      note={edit ? undefined : 'Mã nhà bán lẻ do hệ thống tự cấp. Nhà bán lẻ mới ở trạng thái Chờ duyệt như khai báo của nhân viên bán hàng; kỳ hạn công nợ và tài khoản nhà bán lẻ được tạo khi duyệt. Cần khai báo ít nhất 1 yêu cầu HSD tối thiểu ở tab Yêu cầu hạn sử dụng trước khi duyệt.'}
      initial={initialValues}
      fields={fields}
      onClose={onClose}
      onSubmit={async (v) => {
        const lat = Number(v.lat);
        const lng = Number(v.lng);
        const forecastRevenue = Number(v.forecastRevenue);
        const capacity = Number(v.purchasingCapacity);
        const sizeM2 = Number(v.storeSizeSquareMeters);
        const frequency = Number(v.purchaseFrequencyPerMonth || 4);
        const creditDays = Number(v.creditTermDays);
        const creditLimit = Number(v.creditLimit);

        if (edit) {
          const profileChanged = hasRetailerProfileChanges(initialValues, v);
          const creditChanged = creditDays !== Number(initialValues.creditTermDays)
            || creditLimit !== Number(initialValues.creditLimit);
          if (!profileChanged && !creditChanged) {
            toast.show('Chưa có thay đổi nào.');
            return;
          }
          const retailerId = retailer!.id || retailer!.code;
          if (profileChanged) {
            const profilePayload: UpdateRetailerProfilePayload = retailerProfilePayload(v);
            await updateProfile.mutateAsync({ retailerId, payload: profilePayload });
          }
          if (creditChanged) {
            await updateCreditTerms.mutateAsync({
              retailerId,
              creditTermDays: creditDays as 0 | 7 | 14 | 30,
              creditLimit,
              reason: 'Cập nhật từ hồ sơ nhà bán lẻ.',
            });
          }
        } else {
          const selectedRegion = rawAreas.find((a) => a.code === v.areaCode || a.id === v.areaCode);
          const selectedGroup = rawGroups.find((g) => g.code === v.groupCode || g.id === v.groupCode);
          await create.mutateAsync({
            name: String(v.name).trim(),
            contact: String(v.contactName).trim(),
            contactName: String(v.contactName).trim(),
            phone: String(v.phone).trim(),
            email: v.email ? String(v.email).trim() : undefined,
            address: String(v.address).trim(),
            kind: String(v.retailerType),
            retailerType: String(v.retailerType),
            areaCode: String(v.areaCode),
            groupCode: String(v.groupCode),
            regionId: selectedRegion?.id,
            salesGroupId: selectedGroup?.id,
            lat,
            lng,
            latitude: lat,
            longitude: lng,
            areaM2: sizeM2,
            storeSizeSquareMeters: sizeM2,
            forecastRevenue,
            monthlyCapacity: capacity,
            purchasingCapacity: capacity,
            orderFrequency: `${frequency} lần/tháng`,
            purchaseFrequencyPerMonth: frequency,
            assessmentNote: v.assessmentNote ? String(v.assessmentNote).trim() : undefined,
            creditTermDays: creditDays,
            requestedCreditTermDays: creditDays,
            status: String(v.status || 'Active'),
          });
        }
        onClose();
        // A save can issue both profile and credit mutations. Give the Admin
        // one final, explicit acknowledgement after every requested update
        // has completed instead of relying on a transient mutation toast.
        toast.show(edit ? 'Cập nhật thông tin nhà bán lẻ thành công.' : 'Đã tạo hồ sơ nhà bán lẻ thành công.');
      }}
    />
  );
}
