import { PageHeader } from '@/shared/ui';
import { LoyaltyProgramsPanel } from '../components/LoyaltyProgramsPanel';

export function LoyaltyPage() {
  return (
    <>
      <PageHeader title="Khách hàng thân thiết"
        subtitle="Quyền tích điểm được ghi nhận khi hệ thống nhận đơn. Khi đơn hoàn tất, chọn mức điểm cao nhất trong các chương trình đã ghi nhận; bằng điểm ưu tiên mã tăng dần. Chương trình hết hạn sau lúc nhận đơn không làm mất quyền lợi. Điểm dùng chung và không hết hạn." />
      <LoyaltyProgramsPanel />
    </>
  );
}
