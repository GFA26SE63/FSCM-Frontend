export const MAX_GIFT_IMAGE_BYTES = 10 * 1024 * 1024;

export function giftImageError(file: Pick<File, 'size' | 'type'>): string | undefined {
  if (file.size <= 0) return 'Ảnh rỗng. Vui lòng chọn ảnh khác.';
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
    return 'Chỉ nhận ảnh JPG, PNG hoặc WebP.';
  }
  if (file.size > MAX_GIFT_IMAGE_BYTES) return 'Ảnh vượt quá 10 MB.';
  return undefined;
}
