import { useEffect, useState } from 'react';
import {
  Button,
  Callout,
  Card,
  FormField,
  Input,
  Select,
} from '@/shared/ui';
import { formatDate } from '@/shared/lib';

import { useReportGroups } from '../hooks';
import { getPeriodDates, vietnamToday } from '../filters';
import type {
  PeriodType,
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

  const currentPeriod: PeriodType = value.periodType || 'month';
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(currentPeriod);
  const [stagedFromDate, setStagedFromDate] = useState<string>(value.fromDate);
  const [stagedToDate, setStagedToDate] = useState<string>(value.toDate);
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  // Đồng bộ lại state nội bộ khi URL hoặc props thay đổi
  useEffect(() => {
    setSelectedPeriod(value.periodType || 'month');
    setStagedFromDate(value.fromDate);
    setStagedToDate(value.toDate);
    setLocalError(undefined);
  }, [value.periodType, value.fromDate, value.toDate]);

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setSelectedPeriod(newPeriod);
    setLocalError(undefined);

    if (newPeriod === 'custom') {
      // Giữ nguyên ngày hợp lệ trước đó và chờ người dùng chọn ngày rồi nhấn "Áp dụng"
      return;
    }

    // Khi chọn kỳ định sẵn (preset), tính toán ngay mốc thời gian chuẩn và nạp dữ liệu
    const dates = getPeriodDates(newPeriod, today);
    setStagedFromDate(dates.fromDate);
    setStagedToDate(dates.toDate);
    onChange({
      periodType: newPeriod,
      fromDate: dates.fromDate,
      toDate: dates.toDate,
    });
  };

  const handleApplyCustom = () => {
    if (!stagedFromDate || !stagedToDate) {
      setLocalError('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.');
      return;
    }

    if (stagedFromDate > stagedToDate) {
      setLocalError('Ngày bắt đầu không được sau ngày kết thúc.');
      return;
    }

    if (stagedFromDate > today) {
      setLocalError('Kỳ báo cáo không được bắt đầu trong tương lai.');
      return;
    }

    if (stagedToDate > today) {
      setLocalError('Ngày kết thúc không được trong tương lai.');
      return;
    }

    setLocalError(undefined);
    onChange({
      periodType: 'custom',
      fromDate: stagedFromDate,
      toDate: stagedToDate,
    });
  };

  const isCustom = selectedPeriod === 'custom';

  return (
    <Card title="Bộ lọc báo cáo">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isCustom
            ? 'repeat(auto-fit, minmax(170px, 1fr))'
            : 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          alignItems: 'flex-end',
        }}
      >
        <FormField label="Kỳ báo cáo">
          <Select
            value={selectedPeriod}
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

        {isCustom ? (
          <>
            <FormField label="Từ ngày" required>
              <Input
                type="date"
                value={stagedFromDate}
                max={today}
                onChange={(event) => {
                  setStagedFromDate(event.target.value);
                  setLocalError(undefined);
                }}
              />
            </FormField>

            <FormField label="Đến ngày" required>
              <Input
                type="date"
                value={stagedToDate}
                max={today}
                onChange={(event) => {
                  setStagedToDate(event.target.value);
                  setLocalError(undefined);
                }}
              />
            </FormField>

            <div style={{ paddingBottom: 2 }}>
              <Button
                variant="primary"
                onClick={handleApplyCustom}
                disabled={!stagedFromDate || !stagedToDate}
              >
                Áp dụng
              </Button>
            </div>
          </>
        ) : (
          <div
            style={{
              paddingBottom: 10,
              fontSize: 13,
              color: 'var(--text-secondary, #64748B)',
            }}
          >
            Thời gian: <strong>{formatDate(value.fromDate)}</strong> –{' '}
            <strong>{formatDate(value.toDate)}</strong>
          </div>
        )}

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
            Không tải được danh sách nhóm Sales. Vui lòng thử lại.{' '}
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
