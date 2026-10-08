export function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function initials(name: string) {
  return name
    .split(' ')
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
