import { errorMessage } from '@/shared/api/errors';
import {
  Button,
  Callout,
  Card,
  FormField,
  Input,
  Select,
} from '@/shared/ui';

import { useReportGroups } from '../hooks';
import { vietnamToday } from '../filters';
import type {
  ProductCriterion,
  ReportFilters,
} from '../types';

interface Props {
  value: ReportFilters;
  productMode: boolean;
  error?: string;
  onChange: (patch: Partial<ReportFilters>) => void;
}

export function RankingFilters({
  value,
  productMode,
  error,
  onChange,
}: Props) {
  const groups = useReportGroups();

  const options = (groups.data ?? []).map((item) => ({
    value: item.id,
    label: [item.code, item.name].filter(Boolean).join(' · '),
  }));

  // Giữ rõ giá trị từ URL nếu danh sách chưa tải hoặc quyền đã đổi.
  // Report API sẽ kiểm tra quyền, không tự thay bằng nhóm khác.
  if (
    value.salesGroupId &&
    !options.some((item) => item.value === value.salesGroupId)
  ) {
    options.push({
      value: value.salesGroupId,
      label: `Nhóm đã chọn: ${value.salesGroupId}`,
    });
  }

  return (
    <Card title="Bộ lọc báo cáo">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <FormField label="Từ ngày" required>
          <Input
            type="date"
            value={value.fromDate}
            max={vietnamToday()}
            onChange={(event) =>
              onChange({ fromDate: event.target.value })
            }
          />
        </FormField>

        <FormField label="Đến ngày" required>
          <Input
            type="date"
            value={value.toDate}
            onChange={(event) =>
              onChange({ toDate: event.target.value })
            }
          />
        </FormField>

        <FormField label="Nhóm Sales">
          <Select
            value={value.salesGroupId}
            disabled={groups.isPending}
            options={[
              { value: '', label: 'Tất cả nhóm trong phạm vi được phép' },
              ...options,
            ]}
            onChange={(event) =>
              onChange({ salesGroupId: event.target.value })
            }
          />
        </FormField>

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
    </Card>
  );
}