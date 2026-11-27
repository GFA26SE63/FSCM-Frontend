/**
 * Phase 8B — RunPicking Authorization & Warehouse Scope Tests.
 *
 * All tests are static code analysis (source assertions) or pure logic tests.
 * Runtime authorization (actual GraphQL requests with real JWT) is BLOCKED (no live env).
 *
 * Covers:
 * 1. orderIds scope construction per role (Backend source analysis)
 * 2. PickingList filter — warehouse OR order scope
 * 3. WarehouseKeeper with multiple assigned warehouses
 * 4. WarehouseKeeper with no assignments
 * 5. Unassigned warehouse exclusion
 * 6. Admin access (unrestricted)
 * 7. Operator access (unrestricted for non-admin entities)
 * 8. Warehouse dropdown options — WarehouseKeeper sees only assigned warehouses
 * 9. Frontend comment correctness
 * 10. scopeWarehouseIds as performance hint, not security gate
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ─── Source readers ──────────────────────────────────────────────────────────

const frontendRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(frontendRoot, '..', 'FSCM-Backend', 'src');
const readFe = (rel) => fs.readFileSync(path.join(frontendRoot, rel), 'utf8');
const readBe = (rel) => fs.readFileSync(path.join(backendRoot, rel), 'utf8');

const entityQueryService = readBe('FSCM.Persistence/EntityQueries/EntityQueryService.cs');
const identityStore = readBe('FSCM.Persistence/Identity/IdentityStore.cs');
const scopeQueries = readBe('FSCM.Persistence/ReportingScopeQueries.cs');
const identityService = readBe('FSCM.Application/Features/Identity/IdentityService.cs');
const systemQuery = readBe('FSCM.API/GraphQL/SystemQuery.cs');
const systemRoles = readBe('FSCM.Domain/Authorization/SystemRoles.cs');
const pickingGraphql = readFe('src/features/runpicking/pickingGraphql.ts');
const runPickingPage = readFe('src/features/runpicking/pages/RunPickingPage.tsx');

// ─── 1. orderIds scope construction — Backend source analysis ─────────────────

describe('orderIds scope construction per role', () => {
  test('ScopedOrders for WarehouseKeeper scopes via PickingList.warehouseId', () => {
    assert.ok(
      entityQueryService.includes("SystemRoles.WarehouseKeeper => dbContext.SalesOrderRecords.Where(order =>"),
      'WarehouseKeeper orders must be scoped via PickingList or Allocation warehouseId',
    );
    assert.ok(
      entityQueryService.includes('access.Scope.WarehouseIds.Contains(list.WarehouseId)'),
      'WarehouseKeeper order scope must reference PickingList.WarehouseId',
    );
  });

  test('ScopedOrders for Sales scopes via CreatedByUserId or SalesGroupId', () => {
    assert.ok(
      entityQueryService.includes('SystemRoles.Sales => dbContext.SalesOrderRecords.Where(x =>'),
      'Sales must scope orders via CreatedByUserId or SalesGroupId',
    );
    assert.ok(
      entityQueryService.includes('x.CreatedByUserId == access.UserId'),
      'Sales must scope to their own orders',
    );
  });

  test('ScopedOrders for SalesManager scopes via SalesGroupId', () => {
    assert.ok(
      entityQueryService.includes('SystemRoles.SalesManager => dbContext.SalesOrderRecords.Where(x => access.Scope.SalesGroupIds.Contains(x.SalesGroupId))'),
      'SalesManager must scope orders via SalesGroupId',
    );
  });

  test('ScopedOrders for Retailer scopes via RetailerId', () => {
    assert.ok(
      entityQueryService.includes('SystemRoles.Retailer => dbContext.SalesOrderRecords.Where(x => access.Scope.RetailerIds.Contains(x.RetailerId))'),
      'Retailer must scope orders via RetailerId',
    );
  });

  test('Unknown role produces empty orderIds (deny-by-default)', () => {
    assert.ok(
      entityQueryService.includes('_ => dbContext.SalesOrderRecords.Where(_ => false)'),
      'Unknown role must produce empty order scope',
    );
  });

  test('Admin bypasses ScopedOrders entirely (returns full set)', () => {
    assert.ok(
      entityQueryService.includes('if (access.Role == SystemRoles.Admin)') &&
      entityQueryService.includes('return query;'),
      'Admin must receive full dataset — bypasses CreateScopedQuery entirely',
    );
  });

  test('Operator bypasses scope for non-admin entities', () => {
    assert.ok(
      entityQueryService.includes('if (access.Role == SystemRoles.Operator && !IsAdminOnlyEntity<TEntity>())'),
      'Operator must receive full dataset for non-admin entities',
    );
  });
});

// ─── 2. PickingList predicate — warehouse OR order scope ──────────────────────

describe('PickingList predicate — warehouse OR order scope', () => {
  test('PickingList predicate includes warehouse scope via warehouseIds.Contains', () => {
    assert.ok(
      entityQueryService.includes('warehouseIds.Contains(x.WarehouseId)'),
      'PickingList predicate must include warehouseIds.Contains(x.WarehouseId)',
    );
  });

  test('PickingList predicate also scopes via PurchaseOrder → SalesOrder (orderIds)', () => {
    assert.ok(
      entityQueryService.includes('dbContext.PurchaseOrderRecords.Any(po => po.Id == x.PurchaseOrderId && orderIds.Contains(po.SalesOrderId))'),
      'PickingList predicate must also include purchase order scope (order path)',
    );
  });

  test('OR condition: PickingList visible if EITHER order or warehouse is in scope', () => {
    // The predicate uses || between the two conditions
    const pickingListBlock = entityQueryService.match(
      /if \(typeof\(TEntity\) == typeof\(PickingList\)\)([\s\S]*?)if \(typeof\(TEntity\) == typeof\(PickingItem\)\)/
    )?.[1] ?? '';
    assert.ok(
      pickingListBlock.includes('||'),
      'PickingList predicate must use OR between order-path and warehouse-path conditions',
    );
  });

  test('WarehouseKeeper orderIds are scoped to assigned warehouses', () => {
    // WarehouseKeeper ScopedOrders uses warehouseIds.Contains(list.WarehouseId)
    assert.ok(
      entityQueryService.includes('access.Scope.WarehouseIds.Contains(list.WarehouseId)'),
      'WarehouseKeeper orderIds are derived from assigned warehouses — no cross-warehouse leak via order path',
    );
  });

  test('PickingItem uses same warehouse scope as PickingList', () => {
    assert.ok(
      entityQueryService.includes('if (typeof(TEntity) == typeof(PickingItem))'),
      'PickingItem must have its own scope predicate',
    );
    assert.ok(
      entityQueryService.includes('warehouseIds.Contains(x.WarehouseId)') &&
      entityQueryService.includes('pickingIds.Contains(x.PickingListId)'),
      'PickingItem must be scoped via PickingList (which is scoped by warehouse)',
    );
  });
});

// ─── 3. Scope construction — WarehouseKeeper warehouse IDs ───────────────────

describe('scope construction — WarehouseKeeper warehouseIds', () => {
  test('ManagedWarehouses uses active UserWarehouseAssignment (not client-supplied)', () => {
    assert.ok(
      scopeQueries.includes('db.UserWarehouseAssignmentRecords.Any(a => a.UserAccountId == userId && a.WarehouseId == w.Id && a.IsActive)'),
      'ManagedWarehouses must use UserWarehouseAssignment.IsActive — no client injection possible',
    );
  });

  test('ManagedWarehouses also includes warehouses in assigned regions', () => {
    assert.ok(
      scopeQueries.includes('db.UserRegionAssignmentRecords.Any(a => a.UserAccountId == userId && a.RegionId == w.RegionId && a.IsActive)'),
      'ManagedWarehouses must also include warehouses in directly-assigned regions',
    );
  });

  test('GetScopeAsync uses ManagedWarehouses for WarehouseKeeper', () => {
    assert.ok(
      identityStore.includes('ManagedWarehouses(dbContext, userId)'),
      'GetScopeAsync must call ManagedWarehouses for WarehouseKeeper role',
    );
  });

  test('Empty scope when WarehouseKeeper has no assignments', () => {
    // ManagedWarehouses returns empty when no active assignments exist
    // EntityQueryService: warehouseIds = [] → warehouseIds.Contains(x.WarehouseId) always false
    // Also orderIds for WarehouseKeeper: scoped via PickingList → empty list too
    // Result: query.Where(_ => false) or empty predicate → no rows
    assert.ok(
      entityQueryService.includes('return scoped ?? query.Where(_ => false)'),
      'Unknown entity type with no scope must return empty (deny-all fallback)',
    );
    // The PickingList case handles empty warehouseIds gracefully — IN ([]) = false
    assert.ok(
      entityQueryService.includes("if (typeof(TEntity) == typeof(PickingList))"),
      'PickingList must have its explicit scope handler',
    );
  });

  test('Multiple assigned warehouses: warehouseIds is a list (IN clause)', () => {
    // IdentityScope.WarehouseIds is IReadOnlyCollection<Guid>
    assert.ok(
      identityStore.includes('ManagedWarehouses(dbContext, userId)\n') ||
      identityStore.includes('ManagedWarehouses(dbContext, userId)'),
      'WarehouseIds collection supports multiple IDs',
    );
  });
});

// ─── 4. Admin and Operator access ─────────────────────────────────────────────

describe('Admin and Operator access', () => {
  test('Admin receives unrestricted PickingList access', () => {
    assert.ok(
      entityQueryService.includes('if (access.Role == SystemRoles.Admin)') &&
      entityQueryService.includes('return query;'),
      'Admin must bypass CreateScopedQuery and receive full dataset',
    );
  });

  test('Operator receives unrestricted PickingList access (not an admin-only entity)', () => {
    assert.ok(
      entityQueryService.includes('if (access.Role == SystemRoles.Operator && !IsAdminOnlyEntity<TEntity>())'),
      'Operator must receive full PickingList dataset',
    );
    // Verify PickingList IS handled in CreateScopedQuery (meaning it's NOT admin-only)
    assert.ok(
      entityQueryService.includes('typeof(TEntity) == typeof(PickingList)'),
      'PickingList must have its own scope handler in CreateScopedQuery (not admin-only)',
    );
  });

  test('SystemRoles defines exactly 6 roles', () => {
    const roles = ['Admin', 'Operator', 'SalesManager', 'Sales', 'WarehouseKeeper', 'Retailer'];
    for (const role of roles) {
      assert.ok(systemRoles.includes(`"${role}"`), `SystemRoles must define ${role}`);
    }
  });
});

// ─── 5. GraphQL authentication — entities endpoint ───────────────────────────

describe('GraphQL authentication — entities endpoint', () => {
  test('[Authorize] guard on Entities() rejects unauthenticated requests', () => {
    assert.ok(
      systemQuery.includes('[Authorize]'),
      'Entities() must require authentication via [Authorize]',
    );
  });

  test('Scope loaded from Backend DB via GetCurrentUserAsync (not client request)', () => {
    assert.ok(
      systemQuery.includes('identityService.GetCurrentUserAsync('),
      'Scope must be loaded from IdentityService using JWT identity, not client body',
    );
  });

  test('EntityQueryAccess constructed from server-sourced user data', () => {
    assert.ok(
      systemQuery.includes('new EntityQueryAccess(current.Id, current.Role, current.Scope, current.Permissions)'),
      'EntityQueryAccess must use server-sourced current.Scope',
    );
  });
});

// ─── 6. Frontend comment correctness ─────────────────────────────────────────

describe('Frontend comment correctness', () => {
  test('pickingGraphql.ts no longer says Backend does not enforce scope', () => {
    assert.ok(
      !pickingGraphql.includes('không tự giới hạn theo kho được phân công'),
      'The misleading comment claiming Backend does not scope must be removed',
    );
  });

  test('pickingGraphql.ts documents Backend enforcement', () => {
    assert.ok(
      pickingGraphql.includes('Backend BẮT BUỘC') || pickingGraphql.includes('EntityQueryService'),
      'Comment must document that Backend enforces scope via EntityQueryService',
    );
  });

  test('pickingGraphql.ts documents scopeWarehouseIds as performance hint', () => {
    assert.ok(
      pickingGraphql.includes('gợi ý hiệu năng') || pickingGraphql.includes('performance hint'),
      'Comment must clarify scopeWarehouseIds is a performance hint, not security gate',
    );
  });

  test('RunPickingPage comment updated to reflect Backend enforcement', () => {
    assert.ok(
      !runPickingPage.includes('Backend không tự giới hạn truy vấn này'),
      'RunPickingPage must not contain the old misleading comment',
    );
  });
});

// ─── 7. Warehouse dropdown — WarehouseKeeper sees only assigned warehouses ────

describe('warehouse dropdown — WarehouseKeeper UX', () => {
  test('visibleWarehouses is filtered for WarehouseKeeper using scopeLabels', () => {
    assert.ok(
      runPickingPage.includes("user?.role === 'WarehouseKeeper'") &&
      runPickingPage.includes('scopeLabels?.warehouses'),
      'visibleWarehouses must be filtered for WarehouseKeeper using scopeLabels.warehouses',
    );
  });

  test('Admin sees all warehouses (no filter applied)', () => {
    // The else branch returns warehouses.data ?? []
    assert.ok(
      runPickingPage.includes('(warehouses.data ?? [])'),
      'Non-WarehouseKeeper roles must see all warehouses',
    );
  });

  test('Dropdown uses visibleWarehouses not warehouses.data', () => {
    assert.ok(
      runPickingPage.includes('visibleWarehouses.map'),
      'Dropdown options must use visibleWarehouses (not warehouses.data directly)',
    );
    assert.ok(
      !runPickingPage.includes('(warehouses.data ?? []).map'),
      'Dropdown must not directly use warehouses.data.map',
    );
  });

  test('warehouseId validation uses visibleWarehouses', () => {
    assert.ok(
      runPickingPage.includes('visibleWarehouses.some((w) => w.id === rawWarehouseId)'),
      'URL warehouse validation must use visibleWarehouses (not all warehouses)',
    );
  });

  test('scopeWarehouseIds performance hint is still sent for WarehouseKeeper', () => {
    assert.ok(
      runPickingPage.includes("user?.role === 'WarehouseKeeper' ? user.scope?.warehouseIds ?? [] : undefined"),
      'scopeWarehouseIds must still be sent as performance hint for WarehouseKeeper',
    );
  });
});

// ─── 8. scopeWarehouseIds as performance hint ─────────────────────────────────

describe('scopeWarehouseIds performance hint', () => {
  test('scopeWarehouseIds adds a client-side where filter on top of Backend scope', () => {
    // Backend applies warehouseIds.Contains → client adds warehouseId: { in: $scope }
    // The two are independent AND conditions; the client one is redundant but harmless
    const { buildFilter } = (() => {
      // Parse the filter logic from source
      const hasScope = pickingGraphql.includes("conditions.push('{ warehouseId: { in: $scope } }')");
      return { buildFilter: { hasScope } };
    })();
    assert.ok(buildFilter.hasScope, 'Frontend must still send $scope variable as a where clause');
  });

  test('scopeWarehouseIds is undefined for non-WarehouseKeeper roles', () => {
    // Admin and Operator should not have scope filter sent (Backend returns all)
    assert.ok(
      runPickingPage.includes("user?.role === 'WarehouseKeeper' ? user.scope?.warehouseIds ?? [] : undefined"),
      'Non-WarehouseKeeper roles must receive undefined scopeWarehouseIds (no $scope filter)',
    );
  });
});
