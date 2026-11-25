import { Tabs } from '@/shared/ui';

interface WarehouseOutboundTabsProps {
  reason: 'Order' | 'Transfer';
  tab: string;
  onReasonChange: (reason: 'Order' | 'Transfer') => void;
  onTabChange: (tab: 'todo' | 'history') => void;
}

export function WarehouseOutboundTabs({ reason, tab, onReasonChange, onTabChange }: WarehouseOutboundTabsProps) {
  const operation = reason === 'Transfer' ? 'luân chuyển' : 'bán hàng';

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
    <Tabs
      items={[{ key: 'Order', label: 'Xuất bán hàng' }, { key: 'Transfer', label: 'Xuất luân chuyển' }]}
      value={reason}
      onChange={onReasonChange}
    />
    <Tabs
      variant="pills"
      items={[
        { key: 'todo', label: `Yêu cầu xuất ${operation}` },
        { key: 'history', label: `Lịch sử xuất ${operation}` },
      ]}
      value={tab === 'history' ? 'history' : 'todo'}
      onChange={onTabChange}
    />
  </div>;
}
