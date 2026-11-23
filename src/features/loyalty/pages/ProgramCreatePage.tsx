import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useNavigate } from '@/shared/router/compat';
import { Callout, PageHeader } from '@/shared/ui';
import { ProgramCreateForm } from '../components/ProgramCreateForm';

export function ProgramCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!can(user, 'loyalty.manage')) return <Callout tone="danger">Bạn không có quyền tạo chương trình khách hàng thân thiết.</Callout>;
  return <>
    <PageHeader back="/loyalty" title="Tạo chương trình khách hàng thân thiết" />
    <ProgramCreateForm onClose={() => navigate('/loyalty')} />
  </>;
}
