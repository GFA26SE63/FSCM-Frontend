import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Select } from '@/shared/ui';
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
  });

  const selected = useQuery({
    queryKey: ['users', 'assignment-names', kind, value],
    queryFn: () => getAssignmentNames(kind, value),
    enabled: value.length > 0,
  });

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <strong>{label}</strong>

      {value.length === 0 && (
        <span className="muted">Chưa chọn.</span>
      )}

      {value.map((id) => {
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
            }}
          >
            <span
              style={{
                flex: 1,
                overflowWrap: 'anywhere',
              }}
            >
              {item ? `${item.code} · ${item.name}` : id}
            </span>

            {!readOnly && (
              <Button
                size="sm"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    value.filter((itemId) => itemId !== id),
                  )
                }
              >
                Bỏ chọn
              </Button>
            )}
          </div>
        );
      })}

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

      {!readOnly && (
        <>
          <Input
            aria-label={`Tìm ${label}`}
            placeholder="Tìm mã hoặc tên"
            value={search}
            disabled={disabled}
            onChange={(event) => {
              setSearch(event.target.value);
              setAfter(null);
            }}
          />

          <Select
            aria-label={label}
            value=""
            placeholder={
              options.isFetching
                ? 'Đang tải…'
                : 'Chọn để thêm'
            }
            disabled={disabled || options.isFetching}
            options={(options.data?.nodes ?? [])
              .filter((item) => !value.includes(item.id))
              .map((item) => ({
                value: item.id,
                label: `${item.code} · ${item.name}`,
              }))}
            onChange={(event) => {
              const id = event.target.value;
              if (!id) return;

              onChange(
                multiple ? [...value, id] : [id],
              );
            }}
          />

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

      {error && (
        <span className="field-err">{error}</span>
      )}
    </div>
  );
}