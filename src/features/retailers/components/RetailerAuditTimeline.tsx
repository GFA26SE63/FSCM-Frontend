import { Card, Callout, StatusChip } from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import type { Retailer } from '../types';

interface RetailerAuditTimelineProps {
  retailer: Retailer;
}

interface TimelineEvent {
  title: string;
  timestamp?: string | null;
  actor?: string | null;
  description?: string | null;
  statusChip?: string | null;
}

export function RetailerAuditTimeline({ retailer }: RetailerAuditTimelineProps) {
  const events: TimelineEvent[] = [];

  // Event 1: Creation / Declaration
  if (retailer.createdAt) {
    events.push({
      title: 'Khai báo hồ sơ điểm bán',
      timestamp: retailer.createdAt,
      actor: retailer.declaredByUserId ? 'Nhân viên kinh doanh (Sales)' : (retailer.source || 'Nhân viên kinh doanh (Sales)'),
      description: `Khởi tạo hồ sơ điểm bán ${retailer.name} (${retailer.code}) với loại hình ${retailer.retailerType || retailer.kind || 'Điểm bán'}.`,
      statusChip: 'Draft',
    });
  }

  // Event 2: Review (Approval / Rejection)
  if (retailer.reviewedAt) {
    const isApproved = retailer.status === 'Active' || retailer.status === 'Inactive' || retailer.status === 'Locked';
    events.push({
      title: isApproved ? 'Xét duyệt phê duyệt hồ sơ' : 'Xét duyệt từ chối hồ sơ',
      timestamp: retailer.reviewedAt,
      actor: retailer.reviewedByUserId ? 'Quản trị viên xét duyệt' : 'Ban quản trị hệ thống',
      description: retailer.reviewReason
        ? `Lý do / ghi chú: ${retailer.reviewReason}`
        : isApproved
        ? `Đã phê duyệt hồ sơ và thiết lập kỳ hạn công nợ ${retailer.creditTermDays} ngày.`
        : 'Hồ sơ đã bị từ chối.',
      statusChip: isApproved ? 'Active' : 'Rejected',
    });
  }

  // Event 3: Last update / location update
  if (retailer.updatedAt && retailer.updatedAt !== retailer.createdAt) {
    events.push({
      title: 'Cập nhật thông tin hồ sơ',
      timestamp: retailer.updatedAt,
      actor: 'Ban quản trị hệ thống',
      description: retailer.locationVersion
        ? `Cập nhật thông tin chi tiết và định vị cửa hàng (Phiên bản vị trí: v${retailer.locationVersion}).`
        : 'Cập nhật thông tin chi tiết điểm bán.',
    });
  }

  return (
    <div className="stack" style={{ gap: '20px' }}>
      <Callout tone="info">
        <div style={{ display: 'grid', gap: '6px' }}>
          <strong>Lịch sử thay đổi điểm bán:</strong>
          <div>
            Theo dõi toàn bộ các mốc quan trọng trong quá trình hoạt động của điểm bán, bao gồm thời điểm khai báo ban đầu từ Sales, kết quả xét duyệt và các lần cập nhật thông tin gần nhất.
          </div>
        </div>
      </Callout>

      <Card title="Lịch sử thay đổi hồ sơ">
        {events.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Chưa có thông tin thời gian vòng đời cho điểm bán này.
          </p>
        ) : (
          <div className="timeline">
            {events.map((ev, index) => (
              <div className="timeline-item" key={index} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="t" style={{ fontWeight: 600, color: 'var(--primary, #14655B)' }}>
                    {formatDate(ev.timestamp)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{ev.title}</span>
                  {ev.statusChip && <StatusChip value={ev.statusChip} />}
                </div>
                <div className="muted" style={{ fontSize: '13px', marginTop: '4px' }}>
                  {ev.actor}
                </div>
                {ev.description && (
                  <div style={{ fontSize: '13.5px', marginTop: '4px', lineHeight: 1.5 }}>
                    {ev.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

