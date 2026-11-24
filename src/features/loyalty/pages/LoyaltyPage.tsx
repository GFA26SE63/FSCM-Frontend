import { PageHeader } from '@/shared/ui';
import { LoyaltyProgramsPanel } from '../components/LoyaltyProgramsPanel';

export function LoyaltyPage() {
  return (
    <>
      <PageHeader title="Khách hàng thân thiết"
        subtitle="Quản lý chương trình khách hàng thân thiết. Điểm được cộng khi đơn hàng hoàn tất và đáp ứng điều kiện chương trình." />
      <LoyaltyProgramsPanel />
    </>
  );
}
