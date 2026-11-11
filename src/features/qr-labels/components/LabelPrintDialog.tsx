import { useRef, useState } from 'react';

import { errorMessage } from '@/shared/api/errors';
import { Modal } from '@/shared/ui';

import { useLabelPrintDocument } from '../hooks';
import type { PrintTarget } from '../types';

interface Props {
  ownerId: string;
  target: PrintTarget;
  onClose: () => void;
}

export function LabelPrintDialog({
  ownerId,
  target,
  onClose,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [printError, setPrintError] = useState('');

  const identifier =
    target.kind === 'label'
      ? target.qrCode
      : target.batchId;

  const query = useLabelPrintDocument(ownerId, target);

  function printDocument() {
    setPrintError('');

    try {
      const frameWindow = frameRef.current?.contentWindow;

      if (!frameWindow || !ready) {
        setPrintError('Bản in chưa sẵn sàng.');
        return;
      }

      frameWindow.focus();
      frameWindow.print();
    } catch {
      setPrintError(
        'Trình duyệt không mở được hộp thoại in. Hãy tải HTML và mở bằng trình duyệt.',
      );
    }
  }

  function downloadDocument() {
    if (!query.data) return;

    const blob = new Blob([query.data], {
      type: 'text/html;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `TEM-${identifier}.html`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
  }

  return (
    <Modal
      open
      title={
        target.kind === 'label'
          ? `Xem / in tem ${target.qrCode}`
          : 'Xem / in tem của batch'
      }
      subtitle="Bản in tem chính thức từ hệ thống. In lại sẽ sử dụng mã tem hiện có."
      onClose={onClose}
      width={960}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={onClose}
          >
            Đóng
          </button>

          <button
            type="button"
            className="btn"
            disabled={!query.data || query.isFetching || !!query.error}
            onClick={downloadDocument}
          >
            Tải HTML
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !query.data ||
              !ready ||
              query.isFetching ||
              !!query.error
            }
            onClick={printDocument}
          >
            In
          </button>
        </>
      }
    >
      {query.isPending && (
        <p role="status">Đang tải bản in…</p>
      )}

      {query.error && (
        <div role="alert">
          <p>{errorMessage(query.error)}</p>

          <button
            type="button"
            className="btn"
            disabled={query.isFetching}
            onClick={() => {
              setReady(false);
              void query.refetch();
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {printError && (
        <p role="alert">{printError}</p>
      )}

      {query.data && !query.error && (
        <iframe
          ref={frameRef}
          title="Bản xem trước tem QR"
          srcDoc={query.data}
          sandbox="allow-same-origin allow-modals"
          onLoad={() => setReady(true)}
          style={{
            display: 'block',
            width: '100%',
            height: 'min(60vh, 640px)',
            border: '1px solid #d9e2dc',
            background: '#fff',
          }}
        />
      )}
    </Modal>
  );
}