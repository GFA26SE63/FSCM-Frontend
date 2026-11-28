import { useQuery } from '@tanstack/react-query';
import { Callout, QueryState } from '@/shared/ui';
import { ExpandableRecord } from '@/shared/ui/ExpandableRecord';
import { OrderCartonTable } from '@/features/orders/components/OrderCartons';
import { fetchTransferDispatchGoods } from '../transferDispatchGoods';

export function TransferDispatchGoods({ issueDocumentId }: { issueDocumentId: string | null }) {
  const query = useQuery({
    queryKey: ['transport-dispatch', 'goods', issueDocumentId],
    queryFn: () => fetchTransferDispatchGoods(issueDocumentId!),
    enabled: !!issueDocumentId,
  });
  return <section aria-label="Sản phẩm luân chuyển">
    <h3>Sản phẩm luân chuyển</h3>
    {!issueDocumentId ? <p className="muted">Lệnh này chưa có phiếu xuất kho nguồn để hiển thị sản phẩm và thùng.</p>
      : query.isError ? <Callout tone="danger">Không tải được sản phẩm và danh sách thùng. <button type="button" onClick={() => void query.refetch()}>Thử lại</button></Callout>
        : <QueryState query={query}>{products => products.length === 0
          ? <p className="muted">Phiếu xuất luân chuyển chưa có sản phẩm.</p>
          : <div className="order-carton-groups">{products.map(product => <ExpandableRecord
            key={product.productId} title={product.productName} subtitle={product.sku}
            meta={`${product.quantity.toLocaleString('vi-VN')} thùng`} actionLabel="Danh sách thùng"
          ><OrderCartonTable productContext cartons={product.cartons} emptyText="Chưa có thùng cho sản phẩm này trên phiếu xuất luân chuyển." /></ExpandableRecord>)}</div>}
        </QueryState>}
  </section>;
}
