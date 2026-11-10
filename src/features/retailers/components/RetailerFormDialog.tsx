import { AddressLocationPicker, FormDialog, Modal, type FormFieldDef } from '@/shared/ui';
import { IdFormat } from '@/shared/lib';
import {
  useCreateRetailer,
  useRetailerLookups,
  useUpdateRetailerDeclaration,
} from '../hooks';
import type { Retailer, UpdateRetailerDeclarationPayload } from '../types';

const KINDS = [
  'Tạp hóa',
  'Siêu thị mini',
  'Quán cà phê',
  'Nhà hàng',
  'Cửa hàng tiện lợi',
  'Đại lý phân phối',
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
  const updateDeclaration = useUpdateRetailerDeclaration();

  if (!open) return null;

  const edit = Boolean(retailer);

  if (areas.isLoading || groups.isLoading) {
    return (
      <Modal
        open
        width={500}
        title={edit ? `Sửa thông tin hồ sơ ${retailer!.code}` : 'Tạo mới điểm bán'}
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
    {
      key: 'code',
      label: 'Mã điểm bán (8 chữ số)',
      required: true,
      readOnly: edit,
      validate: (v) =>
        !IdFormat.isRetailerCode(String(v)) ? 'Mã gồm đúng 8 chữ số.' : undefined,
    },
    { key: 'name', label: 'Tên điểm bán', required: true, span: 2 },
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
    { key: 'email', label: 'Email', type: 'text' },
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
    { key: 'retailerType', label: 'Loại hình điểm bán', type: 'select', options: KINDS },
    {
      key: 'areaCode',
      label: 'Khu vực / Vùng hoạt động',
      type: 'select',
      readOnly: edit,
      options: areaOptions,
    },
    {
      key: 'groupCode',
      label: 'Nhóm Sales phụ trách',
      type: 'select',
      readOnly: edit,
      options: groupOptions,
    },
    { key: 'storeSizeSquareMeters', label: 'Diện tích (m²)', type: 'number' },
    {
      key: 'forecastRevenue',
      label: 'Doanh thu dự báo / tháng (đ)',
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
      label: 'Đánh giá / Ghi chú của Sales',
      type: 'textarea',
      span: 3,
    },
    {
      key: 'creditTermDays',
      label: 'Kỳ hạn công nợ đề xuất',
      type: 'select',
      options: [
        { value: '0', label: 'Không công nợ (chỉ trả trước)' },
        { value: '7', label: '7 ngày' },
        { value: '14', label: '14 ngày' },
        { value: '30', label: '30 ngày' },
      ],
    },
    {
      key: 'status',
      label: 'Trạng thái hoạt động',
      type: 'select',
      readOnly: edit,
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
        retailerType: retailer.retailerType || retailer.kind || KINDS[0],
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
        status: retailer.status || 'Active',
      }
    : {
        code: '',
        name: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        retailerType: KINDS[0],
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
      title={edit ? `Sửa thông tin hồ sơ ${retailer!.code}` : 'Tạo mới điểm bán'}
      submitLabel={edit ? 'Lưu thay đổi' : 'Tạo điểm bán'}
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

        if (edit) {
          const retailerId = retailer!.id || retailer!.code;
          const declarationPayload: UpdateRetailerDeclarationPayload = {
            name: String(v.name).trim(),
            contactName: String(v.contactName).trim(),
            phone: String(v.phone).trim(),
            email: v.email ? String(v.email).trim() : undefined,
            address: String(v.address).trim(),
            retailerType: String(v.retailerType),
            forecastRevenue,
            storeSizeSquareMeters: sizeM2,
            purchasingCapacity: capacity,
            purchaseFrequencyPerMonth: frequency,
            requestedCreditTermDays: creditDays,
            assessmentNote: v.assessmentNote ? String(v.assessmentNote).trim() : undefined,
            latitude: lat,
            longitude: lng,
          };

          await updateDeclaration.mutateAsync({
            retailerId,
            payload: declarationPayload,
          });
        } else {
          const selectedRegion = rawAreas.find((a) => a.code === v.areaCode || a.id === v.areaCode);
          const selectedGroup = rawGroups.find((g) => g.code === v.groupCode || g.id === v.groupCode);
          await create.mutateAsync({
            code: String(v.code).trim(),
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
            creditTermDays: creditDays,
            requestedCreditTermDays: creditDays,
            status: String(v.status || 'Active'),
          });
        }
        onClose();
      }}
    />
  );
}
