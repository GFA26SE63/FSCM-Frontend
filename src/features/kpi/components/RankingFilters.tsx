import { useEffect, useState } from 'react';
import {
  Button,
  Callout,
  Card,
  DateInput,
  FormField,
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

/** Why a date range cannot be used, or undefined when it can. */
export function rangeError(fromDate: string, toDate: string, today = vietnamToday()): string | undefined {
  if (!fromDate || !toDate) return 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.';
  if (fromDate > toDate) return 'Ngày bắt đầu không được sau ngày kết thúc.';
  if (fromDate > today) return 'Kỳ báo cáo không được bắt đầu trong tương lai.';
  if (toDate > today) return 'Ngày kết thúc không được trong tương lai.';
  return undefined;
}

/**
 * Report period as two dates (Từ ngày / Đến ngày). A valid range applies at once; an invalid one
 * stays on screen with its error and keeps the last applied range in the URL.
 */
export function RankingFilters({
  value,
  productMode,
  error,
  onChange,
}: Props) {
  const groups = useReportGroups();
  const today = vietnamToday();

  const groupOptions = (groups.data ?? []).map((item) => ({
    value: item.id,
    label: [item.code, item.name].filter(Boolean).join(' · '),
  }));

  if (
    value.salesGroupId &&
    !groupOptions.some((item) => item.value === value.salesGroupId)
  ) {
    groupOptions.push({
      value: value.salesGroupId,
      label: `Nhóm đã chọn: ${value.salesGroupId}`,
    });
  }

  const [fromDate, setFromDate] = useState(value.fromDate);
  const [toDate, setToDate] = useState(value.toDate);
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setFromDate(value.fromDate);
    setToDate(value.toDate);
    setLocalError(undefined);
  }, [value.fromDate, value.toDate]);

  const apply = (nextFrom: string, nextTo: string) => {
    setFromDate(nextFrom);
    setToDate(nextTo);
    const problem = rangeError(nextFrom, nextTo, today);
    setLocalError(problem);
    if (!problem && (nextFrom !== value.fromDate || nextTo !== value.toDate)) {
      onChange({ periodType: 'custom', fromDate: nextFrom, toDate: nextTo });
    }
  };

  return (
    <Card title="Bộ lọc báo cáo">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
          alignItems: 'flex-end',
        }}
      >
        <FormField label="Từ ngày" required>
          <DateInput value={fromDate} max={toDate || today} invalid={!!localError} onChange={(next) => apply(next, toDate)} />
        </FormField>

        <FormField label="Đến ngày" required>
          <DateInput value={toDate} min={fromDate} max={today} invalid={!!localError} onChange={(next) => apply(fromDate, next)} />
        </FormField>

        <FormField label="Nhóm bán hàng">
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
              })
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

      {(localError || error) && (
        <div style={{ marginTop: 12 }}>
          <Callout tone="danger">{localError || error}</Callout>
        </div>
      )}

      {groups.error && (
        <div style={{ marginTop: 12 }}>
          <Callout tone="danger">
            Không tải được danh sách nhóm bán hàng. Vui lòng thử lại.{' '}
            <Button
              size="sm"
              onClick={() => void groups.refetch()}
            >
              Thử lại
            </Button>
          </Callout>
        </div>
      )}
    </Card>
  );
}
