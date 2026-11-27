import { useQuery } from '@tanstack/react-query';
import { formatInstantDateTime } from '@/shared/lib/dates';
import { Callout, SimpleTable } from '@/shared/ui';
import { fetchOrderCartons, type OrderCarton } from '../orderCartons';
import './OrderCartons.css';

export function useOrderCartons(orderId: string, enabled = true) {
  return useQuery({
    queryKey: ['orders', 'cartons', orderId],
    queryFn: () => fetchOrderCartons(orderId),
    enabled: enabled && !!orderId,
  });
}

export function OrderCartonTable({ cartons, productContext = false }: { cartons: OrderCarton[]; productContext?: boolean }) {
  return <div className="order-carton-table"><SimpleTable rows={cartons} empty="Chưa có thùng trên phiếu xuất kho cho đơn hàng này." columns={[
    { header: 'Mã thùng / QR', cell: carton => carton.cartonId },
    ...(!productContext ? [
      { header: 'SKU', cell: (carton: OrderCarton) => carton.sku },
      { header: 'Tên hàng', cell: (carton: OrderCarton) => carton.productName },
    ] : []),
    { header: 'Phiếu xuất kho', cell: carton => carton.documentCode },
    { header: 'Quét lúc', cell: carton => carton.scannedAt ? formatInstantDateTime(carton.scannedAt) : 'Chờ quét' },
  ]} /></div>;
}

export function OrderCartons({ orderId }: { orderId: string }) {
  const query = useOrderCartons(orderId);
  if (query.isPending) return <p role="status">Đang tải danh sách thùng…</p>;
  if (query.isError) return <Callout tone="danger">Không tải được danh sách thùng. <button type="button" onClick={() => void query.refetch()}>Thử lại</button></Callout>;
  return <OrderCartonTable cartons={query.data} />;
}
