// Quote every text cell and prevent spreadsheet applications from interpreting formulas.
export function csvCell(value: string) {
  return `"${(/^[\s]*[=+\-@]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
}

export async function loadAllReportRows<T extends { id: string }>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; totalCount: number }>,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let expectedCount: number | undefined;
  for (let page = 1; ; page++) {
    const result = await fetchPage(page, 200);
    expectedCount ??= result.totalCount;
    if (result.totalCount !== expectedCount || (!result.items.length && rows.length < expectedCount))
      throw new Error('Dữ liệu thay đổi khi xuất, vui lòng thử lại.');
    for (const row of result.items) {
      if (seen.has(row.id)) throw new Error('Dữ liệu thay đổi khi xuất, vui lòng thử lại.');
      seen.add(row.id);
      rows.push(row);
    }
    if (rows.length > expectedCount) throw new Error('Dữ liệu thay đổi khi xuất, vui lòng thử lại.');
    if (rows.length === expectedCount) return rows;
  }
}
