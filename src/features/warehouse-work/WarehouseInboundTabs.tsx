import { Tabs } from '@/shared/ui';

interface WarehouseInboundTabsProps {
  reason: 'Factory' | 'Transfer';
  tab: string;
  onReasonChange: (reason: 'Factory' | 'Transfer') => void;
  onTabChange: (tab: 'todo' | 'history') => void;
}

export function WarehouseInboundTabs({ reason, tab, onReasonChange, onTabChange }: WarehouseInboundTabsProps) {
  const operation = reason === 'Transfer' ? 'nhập luân chuyển' : 'nhập kho';

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
    <Tabs
      items={[{ key: 'Factory', label: 'Nhập kho' }, { key: 'Transfer', label: 'Nhập luân chuyển' }]}
      value={reason}
      onChange={onReasonChange}
    />
    <Tabs
      variant="pills"
      items={[
        { key: 'todo', label: `Yêu cầu ${operation}` },
        { key: 'history', label: `Lịch sử ${operation}` },
      ]}
      value={tab === 'history' ? 'history' : 'todo'}
      onChange={onTabChange}
    />
  </div>;
}
