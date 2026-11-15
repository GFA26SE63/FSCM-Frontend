import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button, type ButtonVariant } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  confirmVariant?: ButtonVariant;
  onClose: () => void;
  onConfirm: () => Promise<unknown> | void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  danger,
  confirmVariant,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const variant: ButtonVariant = confirmVariant ?? (danger ? 'danger-solid' : 'primary');
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant={variant}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div style={{ lineHeight: 1.5 }}>{message}</div>}
    </Modal>
  );
}
