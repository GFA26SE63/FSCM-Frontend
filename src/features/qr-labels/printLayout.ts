/**
 * Bố cục tem in 100 × 60 mm áp lên tài liệu HTML do hệ thống trả về.
 *
 * Cấu trúc tài liệu gốc (đã xác minh từ bản "Tải HTML", xem
 * docs/design/TEM-TEM-001021.html):
 *   body > .label (lặp lại theo từng tem, break-after: page)
 *     .qr   > svg   (viewBox đã gồm vùng trắng 4 module quanh mã)
 *     .info > div… (.code = mã tem, .exp = HSD)
 *
 * Chỉ bổ sung một khối <style> sau stylesheet gốc; không chạm vào SVG,
 * nội dung QR hay dữ liệu trên tem. Vì được áp ngay khi tải tài liệu nên
 * Xem trước, Tải HTML và In dùng cùng một bản.
 */

const LAYOUT_STYLE_ID = 'fscm-label-layout-100x60';

// Trang 100 × 60 mm, lề 2 mm → vùng in 96 × 56 mm.
// Tem cao 55.6 mm (thấp hơn vùng in 0.4 mm) để sai số làm tròn
// không đẩy tem sang trang mới gây trang trắng.
const LAYOUT_CSS = `
@page{size:100mm 60mm;margin:2mm}
html,body{margin:0;padding:0}
.label{width:96mm;height:55.6mm;padding:3mm 3.5mm;gap:4mm;border:0.3mm solid #000;box-sizing:border-box;overflow:hidden;display:flex;align-items:center;background:#fff}
.qr{width:38mm;height:38mm;flex:0 0 38mm}
.qr svg{width:100%;height:100%;display:block}
.info{flex:1 1 auto;min-width:0;max-height:100%;font-size:10pt;line-height:1.28;overflow:hidden;overflow-wrap:anywhere;word-break:break-word}
.info>div+div{margin-top:0.4mm}
.code{font-size:15pt;font-weight:bold;line-height:1.15;margin-bottom:1mm}
.exp{color:#b00;font-weight:bold}
@media screen{
  html{background:#eef1ee}
  body{display:flex;flex-direction:column;align-items:center;gap:16px;padding:20px 12px}
  .label{zoom:1.5;box-shadow:0 1px 4px rgba(0,0,0,.18)}
}
`;

export function applyLabelPrintLayout(html: string): string {
  if (html.includes(LAYOUT_STYLE_ID)) return html;

  const styleTag = `<style id="${LAYOUT_STYLE_ID}">${LAYOUT_CSS}</style>`;

  // Chèn cuối <head> để ghi đè stylesheet gốc (cùng độ ưu tiên selector).
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleTag}</head>`);
  }

  // Tài liệu không có <head>: chèn ngay sau DOCTYPE để không rơi vào quirks mode.
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype) {
    return doctype[0] + styleTag + html.slice(doctype[0].length);
  }

  return styleTag + html;
}
