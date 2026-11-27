import { hasOperation } from '@/shared/auth/permissions';
import { useState } from 'react';
import { Button, Card, Pagination, QueryState, SimpleTable } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import { formatDateTime } from '@/shared/lib';
import { useUserAudit } from '../hooks';

const actionLabels: Record<string, string> = {
  Created: 'Tạo tài khoản',
  ProfileUpdated: 'Cập nhật thông tin',
  RoleUpdated: 'Đổi vai trò',
  Activated: 'Bật tài khoản',
  Deactivated: 'Khóa tài khoản',
  WarehouseAssigned: 'Gán kho',
  WarehouseUnassigned: 'Bỏ gán kho',
  RegionAssigned: 'Gán khu vực',
  RegionUnassigned: 'Bỏ gán khu vực',
  SalesGroupAssigned: 'Gán nhóm bán hàng',
  SalesGroupUnassigned: 'Bỏ gán nhóm bán hàng',
  RetailerAssigned: 'Gán nhà bán lẻ',
  RetailerUnassigned: 'Bỏ gán nhà bán lẻ',
};

export function UserAuditPanel({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageSize, setPageSize] = useState(20);
  const after = cursors[cursors.length - 1];
  const query = useUserAudit(userId, after, hasOperation(user, 'api:Users.List'), pageSize);

  if (!hasOperation(user, 'api:Users.List')) return null;

  return (
    <Card title="Lịch sử tài khoản" actions={
      <Button size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>
        Tải lại
      </Button>
    }>
      <p className="muted small">
        Nhật ký thao tác trên tài khoản. Nội dung dữ liệu trước/sau thay đổi được ẩn để bảo vệ thông tin nhạy cảm.
      </p>
      <QueryState query={query}>
        {(page) => <>
          <SimpleTable paginate={false} rows={page.nodes} empty="Chưa có lịch sử tài khoản." columns={[
            { header: 'Thời gian', width: '160px', cell: (entry) => formatDateTime(entry.createdAt) },
            { header: 'Thao tác', cell: (entry) => actionLabels[entry.action] ?? entry.action },
            { header: 'ID người thực hiện', cell: (entry) => entry.userAccountId ?? 'Hệ thống' },
            { header: 'Lý do', cell: (entry) => entry.reason?.trim() || 'Không được ghi nhận' },
          ]} />
          <Pagination currentPage={cursors.length} totalCount={page.totalCount} pageSize={pageSize} itemCount={page.nodes.length}
            totalPages={Math.max(1, Math.ceil(page.totalCount / pageSize))} loading={query.isFetching}
            hasPrev={cursors.length > 1} hasNext={page.pageInfo.hasNextPage}
            navigablePages={[...cursors.map((_, i) => i + 1), ...(page.pageInfo.hasNextPage ? [cursors.length + 1] : [])]}
            onPrev={() => setCursors(current => current.slice(0, -1))}
            onNext={() => { const next = page.pageInfo.endCursor; if (next) setCursors(current => [...current, next]); }}
            onPage={n => {
              if (n <= cursors.length) setCursors(current => current.slice(0, n));
              else if (n === cursors.length + 1 && page.pageInfo.endCursor) setCursors(current => [...current, page.pageInfo.endCursor]);
            }}
            onPageSizeChange={size => { setPageSize(size); setCursors([null]); }} />
        </>}
      </QueryState>
    </Card>
  );
}
