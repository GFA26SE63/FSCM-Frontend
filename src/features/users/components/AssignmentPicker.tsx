import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, SearchSelect } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import { getAssignmentNames, userApi } from '../api';
import type { ScopeKind } from '../types';

interface Props {
  kind: ScopeKind;
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
}

export function AssignmentPicker({
  kind,
  label,
  value,
  onChange,
  multiple = false,
  disabled = false,
  readOnly = false,
  error,
}: Props) {
  const [search, setSearch] = useState('');
  const [after, setAfter] = useState<string | null>(null);

  const options = useQuery({
    queryKey: [
      'users',
      'assignment-options',
      kind,
      search,
      after,
    ],
    queryFn: () => userApi.scopeOptions(kind, search, after),
    enabled: !readOnly,
    placeholderData: keepPreviousData,
  });

  const selected = useQuery({
    queryKey: ['users', 'assignment-names', kind, value],
    queryFn: () => getAssignmentNames(kind, value),
    enabled: value.length > 0,
  });

  const selectedList = (
    <div className="card" style={{ overflow: 'hidden' }}>
      {value.length === 0 ? (
        <div className="muted" style={{ padding: '10px 12px' }}>
          Chưa chọn.
        </div>
      ) : (
        value.map((id, index) => {
          const item =
            selected.data?.find((option) => option.id === id) ??
            options.data?.nodes.find((option) => option.id === id);

          return (
            <div
              key={id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '8px 12px',
                borderTop:
                  index === 0 ? undefined : '1px solid var(--c-border-soft)',
              }}
            >
              <span style={{ flex: 1, overflowWrap: 'anywhere' }}>
                {item ? (
                  <>
                    <strong>{item.code}</strong> · {item.name}
                  </>
                ) : (
                  id
                )}
              </span>

              {!readOnly && (
                <Button
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    onChange(value.filter((itemId) => itemId !== id))
                  }
                >
                  Bỏ chọn
                </Button>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>{label}</strong>
        {value.length > 0 && (
          <span className="muted">({value.length} đã chọn)</span>
        )}
      </div>

      {!readOnly && (
        <>
          <SearchSelect
            ariaLabel={label}
            value=""
            placeholder={
              options.isFetching ? 'Đang tải…' : 'Tìm mã hoặc tên để thêm'
            }
            disabled={disabled}
            onQueryChange={(query) => {
              setSearch(query);
              setAfter(null);
            }}
            options={(options.data?.nodes ?? [])
              .filter((item) => !value.includes(item.id))
              .map((item) => ({
                value: item.id,
                label: `${item.code} · ${item.name}`,
              }))}
            onChange={(id) => {
              if (!id) return;
              onChange(multiple ? [...value, id] : [id]);
            }}
          />

          {(after || options.data?.pageInfo.hasNextPage) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {after && (
                <Button
                  size="sm"
                  disabled={disabled || options.isFetching}
                  onClick={() => setAfter(null)}
                >
                  Về đầu
                </Button>
              )}

              {options.data?.pageInfo.hasNextPage && (
                <Button
                  size="sm"
                  disabled={disabled || options.isFetching}
                  onClick={() =>
                    setAfter(
                      options.data?.pageInfo.endCursor ?? null,
                    )
                  }
                >
                  Xem tiếp
                </Button>
              )}
            </div>
          )}

          {options.error && (
            <div className="callout callout-danger">
              {errorMessage(options.error)}
              <Button
                size="sm"
                onClick={() => void options.refetch()}
              >
                Thử lại
              </Button>
            </div>
          )}
        </>
      )}

      {selectedList}

      {selected.error && (
        <div className="callout callout-danger">
          Không tải được tên assignment:{' '}
          {errorMessage(selected.error)}
          <Button
            size="sm"
            onClick={() => void selected.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}

      {error && (
        <span className="field-err">{error}</span>
      )}
    </div>
  );
}
