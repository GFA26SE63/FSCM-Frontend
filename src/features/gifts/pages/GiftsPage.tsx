import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { ActionDropdown, Button, Callout, Card, Input, PageHeader, Pagination, QueryState, Select, SimpleTable, StatusChip } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { downloadExcel } from '@/shared/lib/excel';
import { parsePage, useEnumParam, useQueryParams, useStringParam } from '@/shared/router/listState';
import { useCreateGift, useGiftPrograms, useGifts, useUpdateGift } from '../hooks';
import { GIFT_PAGE_SIZE } from '../api';
import { GiftDialog } from '../components/GiftDialog';
import { GiftDetailDialog } from '../components/GiftDetailDialog';
import type { Gift, GiftFilters } from '../types';

/** "Quà đổi điểm" – catalogue of gifts retailers can redeem with loyalty points. */
export function GiftsPage() {
  const { params, setParams } = useQueryParams();
  const resets = ['after', 'before', 'page'];
  const [search, setSearch] = useStringParam('search', { resets });
  const [status, setStatus] = useEnumParam('status', ['', 'Active', 'Paused', 'OutOfStock'] as const, '', { resets });
  const [sort, setSort] = useEnumParam('sort', ['newest', 'oldest', 'pointsAsc', 'pointsDesc'] as const, 'newest', { resets });
  const [size, setSize] = useEnumParam('size', ['10', '20', '50'] as const, String(GIFT_PAGE_SIZE) as '20', { resets });
  const filters: GiftFilters = { search: search.trim(), status, sort,
    after: params.get('after') || undefined, before: params.get('before') || undefined, pageSize: Number(size) };
  const query = useGifts(filters);
  const create = useCreateGift();
  const update = useUpdateGift();
  const [dlg, setDlg] = useState<{ gift: Gift | null; imageFile?: File | null; targetStatus?: Gift['status']; revision?: number } | null>(null);
  const [detail, setDetail] = useState<Gift | null>(null);
  const programs = useGiftPrograms(!dlg?.gift && !detail);
  const [statusError, setStatusError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const open = (gift: Gift | null) => { setStatusError(''); setNotice(''); setDlg({ gift }); if (!gift) void programs.refetch(); };
  const exportExcel = async () => {
    const gifts = query.data?.items ?? [];
    if (!gifts.length) return;
    setExporting(true);
    try {
      await downloadExcel('danh-sach-qua-doi-diem.xlsx', [{ name: 'Quà đổi điểm', title: 'Danh sách quà đổi điểm', blocks: [{
        columns: ['Mã quà', 'Tên quà', 'Điểm / quà', 'Còn có thể cấp', 'Đã đổi', 'Trạng thái'].map((header) => ({ header })),
        rows: gifts.map((gift) => [gift.code, gift.name, gift.points, gift.stock ?? 'Không giới hạn', gift.redeemed ?? 'Chưa xác định', gift.status]),
      }] }]);
    } finally { setExporting(false); }
  };
  return (
    <>
      <PageHeader title="Quà đổi điểm" subtitle="Khi nhà bán lẻ gửi yêu cầu, hệ thống giữ điểm và lượng quà. Từ chối sẽ trả lại phần đã giữ." />
      {notice && <Callout tone="ok">{notice}</Callout>}
      {programs.isError && <Callout tone="danger">Không tải được chương trình khách hàng thân thiết. <Button size="sm" onClick={() => void programs.refetch()}>Thử lại</Button></Callout>}
      {programs.isSuccess && programs.data.length === 0 && <Callout tone="info">Chưa có chương trình khách hàng thân thiết đang hoạt động và trong thời gian hiệu lực để thêm quà.</Callout>}
      <Card title="Danh sách quà" actions={<div className="row-wrap" style={{ gap: 8 }}><Button loading={exporting} disabled={query.isLoading || !(query.data?.items.length)} onClick={() => void exportExcel()}>Xuất Excel</Button><Button variant="primary" disabled={!programs.isSuccess || !programs.data.length} onClick={() => open(null)}>+ Thêm quà</Button></div>}>
        <div className="row-wrap" style={{ gap: 12, marginBottom: 16 }}>
          <Input aria-label="Tìm quà" placeholder="Mã hoặc tên quà…" value={search} onChange={e => setSearch(e.target.value)} />
          <Select aria-label="Trạng thái quà" value={status} onChange={e => setStatus(e.target.value as typeof status)}
            options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'Active', label: 'Hoạt động' }, { value: 'Paused', label: 'Tạm ngừng' }, { value: 'OutOfStock', label: 'Hết quà' }]} />
          <Select aria-label="Sắp xếp quà" value={sort} onChange={e => setSort(e.target.value as typeof sort)}
            options={[{ value: 'newest', label: 'Mới nhất' }, { value: 'oldest', label: 'Cũ nhất' }, { value: 'pointsAsc', label: 'Điểm tăng dần' }, { value: 'pointsDesc', label: 'Điểm giảm dần' }]} />
        </div>
        <QueryState query={query}>{page => {
          const current = !page.pageInfo.hasPreviousPage ? 1 : parsePage(params.get('page'));
          const firstPage = () => setParams({ page: null, after: null, before: null });
          const previousPage = () => setParams({ page: current > 2 ? current - 1 : null, before: current > 2 ? page.pageInfo.startCursor : null, after: null });
          const nextPage = () => setParams({ page: current + 1, after: page.pageInfo.endCursor, before: null });
          return <>
            <SimpleTable paginate={false} rows={page.items}
              summaryColumns={['Mã quà', 'Tên quà', 'Điểm / quà', 'Còn có thể cấp', 'Trạng thái', 'Thao tác']} columns={[
              { header: 'Mã quà', cell: g => <strong>{g.code}</strong> },
              { header: 'Tên quà', cell: g => <div className="row-wrap" style={{ gap: 10 }}>
                {g.imageUrl && <img src={g.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6 }} />}{g.name}
              </div> },
              { header: 'Điểm / quà', align: 'right', cell: g => formatNumber(g.points) },
              { header: 'Còn có thể cấp', align: 'right', cell: g => g.stock === null ? 'Không giới hạn' : g.stock === 0 ? 'Hết quà' : formatNumber(g.stock) },
              { header: 'Đã đổi', align: 'right', cell: g => g.redeemed === null ? 'Chưa xác định' : formatNumber(g.redeemed) },
              { header: 'Trạng thái', cell: g => <StatusChip domain="active" value={g.status} /> },
              { header: 'Thao tác', width: '150px', cell: g => <div className="table-actions-inline">
                <Button size="sm" onClick={() => setDetail(g)}><Eye size={14} /> Xem</Button>
                <ActionDropdown triggerTitle={`Thao tác quà ${g.code}`} items={[{
                  key: 'edit', label: 'Sửa', icon: <Pencil size={16} />, onClick: () => open(g),
                }]} />
              </div> },
            ]} />
            <Pagination currentPage={current} totalCount={page.totalCount} pageSize={Number(size)} itemCount={page.items.length}
              totalPages={Math.max(1, Math.ceil(page.totalCount / Number(size)))} loading={query.isFetching}
              hasPrev={page.pageInfo.hasPreviousPage} hasNext={page.pageInfo.hasNextPage}
              navigablePages={[1, current, ...(page.pageInfo.hasPreviousPage ? [current - 1] : []), ...(page.pageInfo.hasNextPage ? [current + 1] : [])]}
              onPrev={previousPage} onNext={nextPage}
              onPage={n => { if (n === 1) firstPage(); else if (n === current - 1) previousPage(); else if (n === current + 1) nextPage(); }}
              onPageSizeChange={n => setSize(String(n) as typeof size)} />
          </>;
        }}</QueryState>
        {query.isError && (filters.after || filters.before) && <Button size="sm" onClick={() => setParams({ page: null, after: null, before: null })}>Về trang đầu</Button>}
      </Card>
      {detail && <GiftDetailDialog gift={detail} program={programs.data?.find(p => p.id === detail.loyaltyProgramId)}
        loading={programs.isLoading} error={programs.error} onRetry={() => void programs.refetch()} onClose={() => setDetail(null)} />}
      {dlg && <GiftDialog key={`${dlg.gift?.id ?? 'new'}-${dlg.revision ?? 0}`} gift={dlg.gift} imageFile={dlg.imageFile}
        targetStatus={dlg.targetStatus} programs={programs.data ?? []} statusError={statusError}
        onClose={() => setDlg(null)} onSubmit={async input => {
          const result = dlg.gift ? await update.mutateAsync({ ...input, id: dlg.gift.id }) : await create.mutateAsync(input);
          if (result.imageError || result.statusError) {
            setStatusError(result.imageError || result.statusError || '');
            setDlg({ gift: result.gift, imageFile: result.imageError ? input.imageFile : null,
              targetStatus: input.status, revision: (dlg.revision ?? 0) + 1 });
          } else {
            setNotice(`Đã lưu quà ${result.gift.code} · ${result.gift.status === 'Active' ? 'Hoạt động' : 'Tạm ngừng'}.`);
            setDlg(null);
          }
        }} />}
    </>
  );
}
