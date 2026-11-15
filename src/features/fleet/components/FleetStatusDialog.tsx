import { FormDialog } from '@/shared/ui';

import {
  useSetDriverActive,
  useSetVehicleActive,
} from '../hooks';
import {
  activeText,
  type FleetStatusTarget,
} from '../types';

interface Props {
  target: FleetStatusTarget;
  onClose: () => void;
}

export function FleetStatusDialog({ target, onClose }: Props) {
  const vehicleStatus = useSetVehicleActive();
  const driverStatus = useSetDriverActive();

  const name = target.kind === 'vehicle'
    ? target.item.plateNumber
    : `${target.item.code} · ${target.item.fullName}`;

  const nextActive = !target.item.isActive;

  return (
    <FormDialog
      open
      title={`${nextActive ? 'Kích hoạt' : 'Ngừng hoạt động'} ${name}`}
      submitLabel="Xác nhận"
      width={520}
      columns={1}
      danger={!nextActive}
      initial={{
        name,
        oldStatus: activeText(target.item.isActive),
        newStatus: activeText(nextActive),
      }}
      fields={[
        { key: 'name', label: 'Bản ghi', type: 'info' },
        { key: 'oldStatus', label: 'Trạng thái hiện tại', type: 'info' },
        { key: 'newStatus', label: 'Trạng thái mới', type: 'info' },
      ]}
      onClose={onClose}
      onSubmit={async () => {
        const input = {
          id: target.item.id,
          isActive: nextActive,
        };

        if (target.kind === 'vehicle') {
          await vehicleStatus.mutateAsync(input);
        } else {
          await driverStatus.mutateAsync(input);
        }

        onClose();
      }}
    />
  );
}