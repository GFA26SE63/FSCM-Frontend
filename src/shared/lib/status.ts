export type StatusTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple'

const successStatuses = [
  'Đã duyệt',
  'Đã giao',
  'Đã xuất',
  'Hoạt động',
  'Đạt',
  'Đã thu đủ',
  'Đã xử lý',
  'Bình thường',
  'Đã publish',
]
const dangerStatuses = [
  'Bị từ chối',
  'Đã hủy',
  'Quá hạn',
  'Hết hạn',
  'Đã khóa',
]
const warningStatuses = [
  'Chờ duyệt',
  'Chờ xử lý',
  'Cận hạn',
  'Gợi ý',
  'Tạm dừng',
  'Thu một phần',
  'Chưa đạt',
]
const infoStatuses = ['Đang giao', 'Đang vận chuyển', 'Chưa đến hạn']

export function statusTone(value: string): StatusTone {
  if (successStatuses.includes(value)) return 'success'
  if (dangerStatuses.includes(value)) return 'danger'
  if (warningStatuses.includes(value)) return 'warning'
  if (infoStatuses.includes(value)) return 'info'
  if (value.includes('pick')) return 'purple'
  return 'neutral'
}
