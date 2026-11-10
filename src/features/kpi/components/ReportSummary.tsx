import { Card, Fields } from '@/shared/ui';
import { formatDate } from '@/shared/lib';

import {
  quantityUnitText,
  scopeText,
} from '../filters';
import type { ProductCriterion } from '../types';

interface Props {
  fromDate: string;
  toDate: string;
  scope: string;
  criterion?: ProductCriterion;
  quantityUnit?: string;
  recognitionRule?: string;
  configurationVersion?: string;
  configurationEffectiveFrom?: string;
}

export function ReportSummary({
  fromDate,
  toDate,
  scope,
  criterion,
  quantityUnit,
  recognitionRule,
  configurationVersion,
  configurationEffectiveFrom,
}: Props) {
  return (
    <Card title="Thông tin báo cáo">
      <Fields
        cols={3}
        items={[
          { label: 'Từ ngày', value: formatDate(fromDate) },
          { label: 'Đến ngày', value: formatDate(toDate) },
          { label: 'Phạm vi áp dụng', value: scopeText(scope) },
          ...(criterion
            ? [{
                label: 'Tiêu chí',
                value: criterion === 'Quantity'
                  ? 'Số lượng bán'
                  : 'Doanh thu thuần điều chỉnh',
              }]
            : []),
          ...(quantityUnit
            ? [{
                label: 'Đơn vị số lượng',
                value: quantityUnitText(quantityUnit),
              }]
            : []),
          ...(configurationVersion
            ? [{
                label: 'Phiên bản cấu hình',
                value: configurationVersion,
              }]
            : []),
          ...(configurationEffectiveFrom
            ? [{
                label: 'Hiệu lực cấu hình từ',
                value: formatDate(configurationEffectiveFrom),
              }]
            : []),
        ]}
      />

      {recognitionRule && (
        <details style={{ marginTop: 12 }}>
          <summary>Quy tắc tính doanh thu ghi nhận</summary>
          <p style={{ overflowWrap: 'anywhere', marginTop: 8, color: 'var(--text-secondary)' }}>
            {recognitionRule}
          </p>
        </details>
      )}
    </Card>
  );
}