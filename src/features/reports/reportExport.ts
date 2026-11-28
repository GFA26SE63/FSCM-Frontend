export interface PagedReport<Row> {
  items: Row[];
  totalCount: number;
}

/** Collect every matching page in Excel exports (200 per request) without changing on-screen pagination. */
export async function loadAllReportRows<Row>(
  load: (page: number, pageSize: number) => Promise<PagedReport<Row>>,
  pageSize = 200,
): Promise<Row[]> {
  const first = await load(1, pageSize);
  const rows = [...first.items];
  const pages = Math.ceil(first.totalCount / pageSize);
  for (let page = 2; page <= pages; page++) {
    const next = await load(page, pageSize);
    if (next.totalCount !== first.totalCount || next.items.length === 0) {
      throw new Error('Dữ liệu thay đổi khi đang xuất. Vui lòng xuất lại.');
    }
    rows.push(...next.items);
  }
  return rows;
}
