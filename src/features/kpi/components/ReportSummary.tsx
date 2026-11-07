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
}

export function ReportSummary({
  fromDate,
  toDate,
  scope,
  criterion,
  quantityUnit,
  recognitionRule,
}: Props) {
  return (
    <Card title="Thông tin báo cáo">
      <Fields
        cols={3}
        items={[
          { label: 'Từ ngày', value: formatDate(fromDate) },
          { label: 'Đến ngày', value: formatDate(toDate) },
          { label: 'Phạm vi BE áp dụng', value: scopeText(scope) },
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
        ]}
      />

      {recognitionRule && (
        <details style={{ marginTop: 12 }}>
          <summary>Quy tắc ghi nhận do backend trả về</summary>
          <p style={{ overflowWrap: 'anywhere' }}>
            {recognitionRule}
          </p>
        </details>
      )}
    </Card>
  );
}