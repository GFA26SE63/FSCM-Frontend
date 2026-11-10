import { useState } from 'react';
import { Button, Card, QueryState, SimpleTable } from '@/shared/ui';
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
  SalesGroupAssigned: 'Gán nhóm Sales',
  SalesGroupUnassigned: 'Bỏ gán nhóm Sales',
  RetailerAssigned: 'Gán retailer',
  RetailerUnassigned: 'Bỏ gán retailer',
};

export function UserAuditPanel({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const after = cursors[cursors.length - 1];
  const query = useUserAudit(userId, after, user?.role === 'Admin');

  if (user?.role !== 'Admin') return null;

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
          <SimpleTable rows={page.nodes} empty="Chưa có lịch sử tài khoản." columns={[
            { header: 'Thời gian', width: '160px', cell: (entry) => formatDateTime(entry.createdAt) },
            { header: 'Thao tác', cell: (entry) => actionLabels[entry.action] ?? entry.action },
            { header: 'ID người thực hiện', cell: (entry) => entry.userAccountId ?? 'Hệ thống' },
            { header: 'Lý do', cell: (entry) => entry.reason?.trim() || 'Không được ghi nhận' },
          ]} />
          <div className="row-wrap" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <Button size="sm" disabled={query.isFetching || cursors.length === 1}
              onClick={() => setCursors((current) => current.slice(0, -1))}>Trang trước</Button>
            <span>Trang {cursors.length}</span>
            <Button size="sm" disabled={query.isFetching || !page.pageInfo.hasNextPage}
              onClick={() => {
                const next = page.pageInfo.endCursor;
                if (next) setCursors((current) => [...current, next]);
              }}>Trang sau</Button>
          </div>
        </>}
      </QueryState>
    </Card>
  );
}
