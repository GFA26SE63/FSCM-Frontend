import { useEffect, useState } from 'react';
import { Button, FormField, Modal, Select } from '@/shared/ui';
import { roleApi, type RoleItem } from '@/features/roles';
import { errorMessage } from '@/shared/api/errors';
import { userApi } from '../api';
import type { UserDetail } from '../types';

export function RoleAssignmentDialog({ user, onClose, onSaved }: {
  user: UserDetail; onClose: () => void; onSaved: () => Promise<unknown>;
}) {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [role, setRole] = useState(user.role);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    roleApi.list().then(items => {
      if (!disposed) setRoles(items.filter(item => item.code !== 'Admin' && item.baseRole !== 'Admin'));
    }).catch(err => { if (!disposed) setError(errorMessage(err)); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, []);
  const save = async () => {
    if (busy || loading || !roles.some(item => item.code === role)) return;
    setBusy(true);
    setError('');
    try {
      await userApi.assignRole(user.id, role);
      await onSaved();
      onClose();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <Modal open title="Đổi vai trò tài khoản" onClose={() => { if (!busy) onClose(); }} footer={<>
    <Button onClick={onClose} disabled={busy}>Hủy</Button>
    <Button variant="primary" onClick={save} disabled={busy || loading || role === user.role || !!error}>
      {busy ? 'Đang lưu…' : 'Lưu vai trò'}
    </Button>
  </>}>
    {error && <div role="alert">{error}</div>}
    <FormField label="Vai trò được gán" required>
      <Select value={role} disabled={busy || loading} options={roles.map(item => ({ value: item.code, label: `${item.name} (${item.code})` }))}
        onChange={event => setRole(event.target.value)} />
    </FormField>
    <p className="muted">Quyền mới có hiệu lực ngay. Sau khi đổi vai trò, kiểm tra lại kho, khu vực hoặc nhà bán lẻ được phân công.</p>
  </Modal>;
}
