import { Link } from '@/shared/router/compat';
import { EmptyState } from '@/shared/ui';

export function NotFoundPage() {
  return <EmptyState title="404 – Không tìm thấy màn hình" description="Đường dẫn không tồn tại hoặc bạn không có quyền xem." action={<Link to="/">Về màn hình chính</Link>} />;
}
