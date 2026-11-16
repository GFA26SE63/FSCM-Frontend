import { useState } from 'react';
import { Button, Callout, Card, Input, PageHeader, QueryState, Select, SimpleTable, StatusChip } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { parsePage, useEnumParam, useQueryParams, useStringParam } from '@/shared/router/listState';
import { useCreateGift, useGiftPrograms, useGifts, useUpdateGift } from '../hooks';
import { GIFT_PAGE_SIZE } from '../api';
import { GiftDialog } from '../components/GiftDialog';
import type { Gift, GiftFilters } from '../types';

/** "Quà đổi điểm" – catalogue of gifts retailers can redeem with loyalty points. */
export function GiftsPage() {
  const { params, setParams } = useQueryParams();
  const resets = ['after', 'before', 'page'];
  const [search, setSearch] = useStringParam('search', { resets });
  const [status, setStatus] = useEnumParam('status', ['', 'Active', 'Paused', 'OutOfStock'] as const, '', { resets });
  const [sort, setSort] = useEnumParam('sort', ['newest', 'oldest', 'pointsAsc', 'pointsDesc'] as const, 'newest', { resets });
  const filters: GiftFilters = { search: search.trim(), status, sort,
    after: params.get('after') || undefined, before: params.get('before') || undefined };
  const query = useGifts(filters);
  const create = useCreateGift();
  const update = useUpdateGift();
  const programs = useGiftPrograms();
  const [dlg, setDlg] = useState<{ gift: Gift | null; imageFile?: File | null; targetStatus?: Gift['status']; revision?: number } | null>(null);
  const [statusError, setStatusError] = useState('');
  const [notice, setNotice] = useState('');
  const open = (gift: Gift | null) => { setStatusError(''); setNotice(''); setDlg({ gift }); };
  return (
    <>
      <PageHeader title="Quà đổi điểm" subtitle="Khi Retailer gửi yêu cầu, hệ thống giữ điểm và lượng quà. Từ chối sẽ trả lại phần đã giữ." />
      {notice && <Callout tone="ok">{notice}</Callout>}
      {programs.isError && <Callout tone="danger">Không tải được chương trình loyalty. <Button size="sm" onClick={() => void programs.refetch()}>Thử lại</Button></Callout>}
      {programs.isSuccess && programs.data.length === 0 && <Callout tone="info">Cần tạo chương trình loyalty trước khi thêm quà.</Callout>}
      <Card title="Danh sách quà" actions={<Button variant="primary" disabled={!programs.isSuccess || !programs.data.length} onClick={() => open(null)}>+ Thêm quà</Button>}>
        <div className="row-wrap" style={{ gap: 12, marginBottom: 16 }}>
          <Input aria-label="Tìm quà" placeholder="Mã hoặc tên quà…" value={search} onChange={e => setSearch(e.target.value)} />
          <Select aria-label="Trạng thái quà" value={status} onChange={e => setStatus(e.target.value as typeof status)}
            options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'Active', label: 'Hoạt động' }, { value: 'Paused', label: 'Tạm ngừng' }, { value: 'OutOfStock', label: 'Hết quà' }]} />
          <Select aria-label="Sắp xếp quà" value={sort} onChange={e => setSort(e.target.value as typeof sort)}
            options={[{ value: 'newest', label: 'Mới nhất' }, { value: 'oldest', label: 'Cũ nhất' }, { value: 'pointsAsc', label: 'Điểm tăng dần' }, { value: 'pointsDesc', label: 'Điểm giảm dần' }]} />
        </div>
        <QueryState query={query}>{page => {
          const current = !page.pageInfo.hasPreviousPage ? 1 : parsePage(params.get('page'));
          return <>
            <SimpleTable rows={page.items} columns={[
              { header: 'Mã quà', cell: g => <strong>{g.code}</strong> },
              { header: 'Tên quà', cell: g => <div className="row-wrap" style={{ gap: 10 }}>
                {g.imageUrl && <img src={g.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6 }} />}{g.name}
              </div> },
              { header: 'Điểm / quà', align: 'right', cell: g => formatNumber(g.points) },
              { header: 'Còn có thể cấp', align: 'right', cell: g => g.stock === null ? 'Không giới hạn' : g.stock === 0 ? 'Hết quà' : formatNumber(g.stock) },
              { header: 'Đã đổi', align: 'right', cell: g => g.redeemed === null ? 'Chưa xác định' : formatNumber(g.redeemed) },
              { header: 'Trạng thái', cell: g => <StatusChip domain="active" value={g.status} /> },
              { header: 'Thao tác', cell: g => <Button size="sm" onClick={() => open(g)}>Sửa</Button> },
            ]} />
            <div className="pager">
              <span>{page.totalCount} quà · Trang {current} / {Math.max(1, Math.ceil(page.totalCount / GIFT_PAGE_SIZE))}</span>
              <span className="pages">
                <Button size="sm" disabled={query.isFetching || !page.pageInfo.hasPreviousPage} onClick={() => setParams({
                  page: current > 2 ? current - 1 : null, before: current > 2 ? page.pageInfo.startCursor : null, after: null,
                })}>Trước</Button>
                <Button size="sm" disabled={query.isFetching || !page.pageInfo.hasNextPage} onClick={() => setParams({
                  page: current + 1, after: page.pageInfo.endCursor, before: null,
                })}>Sau</Button>
                {(filters.after || filters.before) && <Button size="sm" onClick={() => setParams({ page: null, after: null, before: null })}>Trang đầu</Button>}
              </span>
            </div>
          </>;
        }}</QueryState>
        {query.isError && (filters.after || filters.before) && <Button size="sm" onClick={() => setParams({ page: null, after: null, before: null })}>Về trang đầu</Button>}
      </Card>
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
