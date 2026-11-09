import { errorMessage } from '@/shared/api/errors';
import {
  Button,
  Callout,
  Card,
  FormField,
  Input,
  Select,
} from '@/shared/ui';

import { useReportGroups, useSalesStaff } from '../hooks';
import { getPeriodDates, vietnamToday } from '../filters';
import type {
  PeriodType,
  ProductCriterion,
  ReportFilters,
} from '../types';

interface Props {
  value: ReportFilters;
  productMode: boolean;
  showSalesStaff?: boolean;
  error?: string;
  onChange: (patch: Partial<ReportFilters>) => void;
}

export function RankingFilters({
  value,
  productMode,
  showSalesStaff = false,
  error,
  onChange,
}: Props) {
  const groups = useReportGroups();
  const staff = useSalesStaff(value.salesGroupId);

  const groupOptions = (groups.data ?? []).map((item) => ({
    value: item.id,
    label: [item.code, item.name].filter(Boolean).join(' · '),
  }));

  // Giữ rõ giá trị từ URL nếu danh sách chưa tải hoặc quyền đã đổi.
  if (
    value.salesGroupId &&
    !groupOptions.some((item) => item.value === value.salesGroupId)
  ) {
    groupOptions.push({
      value: value.salesGroupId,
      label: `Nhóm đã chọn: ${value.salesGroupId}`,
    });
  }

  const staffOptions = (staff.data ?? []).map((item) => ({
    value: item.id,
    label: [item.fullName, item.email].filter(Boolean).join(' · '),
  }));

  if (
    value.salesUserId &&
    !staffOptions.some((item) => item.value === value.salesUserId)
  ) {
    staffOptions.push({
      value: value.salesUserId,
      label: `Nhân viên đã chọn: ${value.salesUserId}`,
    });
  }

  const currentPeriod: PeriodType = value.periodType || 'custom';

  const handlePeriodChange = (newPeriod: PeriodType) => {
    if (newPeriod === 'custom') {
      onChange({ periodType: 'custom' });
    } else {
      const dates = getPeriodDates(newPeriod);
      onChange({
        periodType: newPeriod,
        fromDate: dates.fromDate,
        toDate: dates.toDate,
      });
    }
  };

  return (
    <Card title="Bộ lọc báo cáo">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <FormField label="Kỳ báo cáo">
          <Select
            value={currentPeriod}
            options={[
              { value: 'month', label: 'Tháng này' },
              { value: 'lastMonth', label: 'Tháng trước' },
              { value: 'quarter', label: 'Quý này' },
              { value: 'year', label: 'Năm nay' },
              { value: 'custom', label: 'Tùy chỉnh khoảng ngày' },
            ]}
            onChange={(event) =>
              handlePeriodChange(event.target.value as PeriodType)
            }
          />
        </FormField>

        <FormField label="Từ ngày" required>
          <Input
            type="date"
            value={value.fromDate}
            max={vietnamToday()}
            onChange={(event) =>
              onChange({ fromDate: event.target.value, periodType: 'custom' })
            }
          />
        </FormField>

        <FormField label="Đến ngày" required>
          <Input
            type="date"
            value={value.toDate}
            onChange={(event) =>
              onChange({ toDate: event.target.value, periodType: 'custom' })
            }
          />
        </FormField>

        <FormField label="Nhóm Sales">
          <Select
            value={value.salesGroupId}
            disabled={groups.isPending}
            options={[
              { value: '', label: 'Tất cả nhóm trong phạm vi được phép' },
              ...groupOptions,
            ]}
            onChange={(event) =>
              onChange({
                salesGroupId: event.target.value,
                // Reset nhân viên khi chọn nhóm khác để tránh ID không thuộc nhóm
                salesUserId: '',
              })
            }
          />
        </FormField>

        {showSalesStaff && !productMode && (
          <FormField label="Nhân viên Sales">
            <Select
              value={value.salesUserId || ''}
              disabled={staff.isPending}
              options={[
                { value: '', label: 'Tất cả nhân viên Sales' },
                ...staffOptions,
              ]}
              onChange={(event) =>
                onChange({ salesUserId: event.target.value })
              }
            />
          </FormField>
        )}

        {productMode && (
          <FormField label="Xếp hạng theo">
            <Select
              value={value.criterion}
              options={[
                { value: 'Quantity', label: 'Số lượng bán' },
                { value: 'Revenue', label: 'Doanh thu thuần điều chỉnh' },
              ]}
              onChange={(event) =>
                onChange({
                  criterion: event.target.value as ProductCriterion,
                })
              }
            />
          </FormField>
        )}
      </div>

      {error && <Callout tone="danger">{error}</Callout>}

      {groups.error && (
        <Callout tone="danger">
          Không tải được bộ lọc nhóm: {errorMessage(groups.error)}.{' '}
          <Button
            size="sm"
            onClick={() => void groups.refetch()}
          >
            Thử lại
          </Button>
        </Callout>
      )}

      {showSalesStaff && !productMode && staff.error && (
        <Callout tone="danger">
          Không tải được danh sách nhân viên Sales: {errorMessage(staff.error)}.{' '}
          <Button
            size="sm"
            onClick={() => void staff.refetch()}
          >
            Thử lại
          </Button>
        </Callout>
      )}
    </Card>
  );
}