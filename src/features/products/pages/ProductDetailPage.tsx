import { useState } from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from '@/shared/router/compat';

import {
  Button,
  Callout,
  Card,
  Fields,
  PageHeader,
  QueryState,
  StatusChip,
} from '@/shared/ui';

import { formatDate } from '@/shared/lib';
import { useProduct } from '../hooks';
import { ProductActions } from '../components/ProductActions';
import { ProductDialog } from '../components/ProductDialog';
import { lifeText, priceText } from '../utils';

export function ProductDetailPage() {
  const { sku: productId = '' } = useParams();

  const navigate = useNavigate();
  const query = useProduct(productId);
  const [editing, setEditing] = useState(false);

  return (
    <>
      {query.error && (
        <div className="row-wrap">
          <Button
            onClick={() => navigate('/skus')}
          >
            Về danh sách
          </Button>

          <Button
            onClick={() => void query.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}

      <QueryState query={query}>
        {(p) => (
          <>
            <PageHeader
              back="/skus"
              title={p.sku + ' · ' + p.name}
              subtitle={p.categoryName}
              chips={
                <StatusChip
                  domain="product"
                  value={p.status}
                />
              }
              actions={
                <ProductActions
                  p={p}
                  size="md"
                  onEdit={() => setEditing(true)}
                  onDeleted={() =>
                    navigate('/skus')
                  }
                />
              }
            />

            {p.status !== 'Draft' && (
              <Callout tone="neutral">
                Thông tin sản phẩm đã khóa.
                Dùng “Tạo bản mới” để tạo một
                bản nháp độc lập. Giá được
                quản lý riêng khi sản phẩm
                còn hoạt động.
              </Callout>
            )}

            {p.status === 'Draft' &&
              p.currentUnitPrice == null && (
                <Callout tone="info">
                  Sản phẩm chưa có giá.
                  Chọn “Cập nhật giá”
                  trước khi đăng bán.
                </Callout>
              )}

            {p.replacesProductId && (
              <Callout tone="info">
                Đây là bản thay thế cho{' '}
                <Link
                  to={
                    '/skus/' +
                    p.replacesProductId
                  }
                >
                  sản phẩm nguồn
                </Link>
                .
              </Callout>
            )}

            <Card title="Thông tin sản phẩm">
              <Fields
                cols={3}
                items={[
                  {
                    label: 'SKU',
                    value: p.sku,
                  },
                  {
                    label: 'Tên sản phẩm',
                    value: p.name,
                  },
                  {
                    label: 'Danh mục',
                    value:
                      p.categoryCode +
                      ' · ' +
                      p.categoryName,
                  },
                  {
                    label: 'Đơn vị bán',
                    value: p.unit,
                  },
                  {
                    label: 'Giá / đơn vị',
                    value: priceText(
                      p.currentUnitPrice,
                    ),
                  },
                  {
                    label: 'Tổng hạn dùng',
                    value: lifeText(
                      p.shelfLifeHours,
                    ),
                  },
                  {
                    label: 'Cận hạn khi còn',
                    value: lifeText(
                      p.nearDateThresholdHours,
                    ),
                  },
                  {
                    label: 'Ngày tạo',
                    value: formatDate(
                      p.createdAt,
                    ),
                  },
                  {
                    label: 'Cập nhật gần nhất',
                    value: formatDate(
                      p.updatedAt,
                    ),
                  },
                  {
                    label: 'Ngày đăng bán',
                    value: p.publishedAt
                      ? formatDate(p.publishedAt)
                      : '—',
                  },
                  {
                    label: 'Ngày ngừng bán',
                    value: p.inactivatedAt
                      ? formatDate(p.inactivatedAt)
                      : '—',
                  },
                ]}
              />
            </Card>

            {editing && (
              <ProductDialog
                key={p.id}
                open
                product={p}
                onClose={() =>
                  setEditing(false)
                }
              />
            )}
          </>
        )}
      </QueryState>
    </>
  );
}