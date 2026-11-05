import type { Category } from './types';

/**
 * Finds a category in the list by matching either its ID or code (case-insensitive).
 */
export function findCategory(categories: Category[], ref?: string | null): Category | null {
  if (!ref) return null;
  const q = String(ref).trim().toLowerCase();
  return (
    categories.find((c) => (c.id && c.id.toLowerCase() === q) || (c.code && c.code.toLowerCase() === q)) || null
  );
}

/**
 * Direct children of a category.
 */
export function getCategoryChildren(categories: Category[], cat?: Category | null): Category[] {
  if (!cat) return [];
  const cId = cat.id?.toLowerCase();
  const cCode = cat.code.toLowerCase();
  return categories.filter((c) => {
    if (!c.parentCategoryId) return false;
    const p = c.parentCategoryId.toLowerCase();
    return (cId && p === cId) || (cCode && p === cCode);
  });
}

/**
 * Calculates 0-based depth of category in tree (0 = Root / Cấp 1, 1 = Cấp 2, 2 = Cấp 3).
 * Uses visited set to prevent infinite loops on broken/cyclic data.
 */
export function getCategoryDepth(categories: Category[], cat?: Category | null, visited = new Set<string>()): number {
  if (!cat || !cat.parentCategoryId) return 0;
  const key = (cat.id || cat.code).toLowerCase();
  if (visited.has(key)) return 0;
  visited.add(key);

  const parent = findCategory(categories, cat.parentCategoryId);
  if (!parent) return 0;
  return 1 + getCategoryDepth(categories, parent, visited);
}

/**
 * Returns 1-based level (1 = Cấp 1, 2 = Cấp 2, 3 = Cấp 3).
 */
export function getCategoryLevel(categories: Category[], cat?: Category | null): number {
  return getCategoryDepth(categories, cat) + 1;
}

/**
 * Returns hierarchical breadcrumb string for a category (e.g. "Đồ uống > Nước ngọt > Nước ngọt có ga").
 */
export function getCategoryPath(
  categories: Category[],
  cat?: Category | null,
  visited = new Set<string>(),
  separator = ' > ',
): string {
  if (!cat) return '';
  const key = (cat.id || cat.code).toLowerCase();
  if (visited.has(key)) return cat.name;
  visited.add(key);

  if (!cat.parentCategoryId) return cat.name;
  const parent = findCategory(categories, cat.parentCategoryId);
  if (!parent) return cat.name;
  return `${getCategoryPath(categories, parent, visited, separator)}${separator}${cat.name}`;
}

/**
 * Returns all direct and indirect descendant IDs and Codes of a category (used for circular reference prevention).
 */
export function getCategoryDescendantKeys(categories: Category[], cat?: Category | null): Set<string> {
  const result = new Set<string>();
  if (!cat) return result;

  const targetId = cat.id?.toLowerCase();
  const targetCode = cat.code.toLowerCase();
  if (targetId) result.add(targetId);
  if (targetCode) result.add(targetCode);

  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (!c.parentCategoryId) continue;
      const pKey = c.parentCategoryId.toLowerCase();
      const cId = c.id?.toLowerCase();
      const cCode = c.code.toLowerCase();
      if (result.has(pKey)) {
        if (cId && !result.has(cId)) {
          result.add(cId);
          added = true;
        }
        if (cCode && !result.has(cCode)) {
          result.add(cCode);
          added = true;
        }
      }
    }
  }

  return result;
}

/**
 * Returns the maximum depth of descendants under this category (0 if leaf node).
 */
export function getCategorySubtreeDepth(categories: Category[], cat?: Category | null): number {
  if (!cat) return 0;
  const children = getCategoryChildren(categories, cat);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((ch) => getCategorySubtreeDepth(categories, ch)));
}

/**
 * Checks if a category can have child categories added (max level is 3, so depth must be < 2).
 */
export function canAddSubcategory(categories: Category[], cat?: Category | null): boolean {
  if (!cat) return false;
  return getCategoryDepth(categories, cat) < 2;
}

export interface FlatTreeRow {
  category: Category;
  depth: number;
  level: number;
  hasKids: boolean;
  isOpen: boolean;
  isVisible: boolean;
}

/**
 * Builds flattened tree row list respecting expand/collapse state and search filter.
 */
export function buildFlatTree(
  categories: Category[],
  openState: Record<string, boolean>,
  searchQuery = '',
): FlatTreeRow[] {
  const q = searchQuery.trim().toLowerCase();
  const rows: FlatTreeRow[] = [];

  // Match helper: node matches if its name/code matches or any descendant matches
  const doesNodeOrDescendantMatch = (c: Category): boolean => {
    if (!q) return true;
    if (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) return true;
    const kids = getCategoryChildren(categories, c);
    return kids.some(doesNodeOrDescendantMatch);
  };

  const walk = (parentId: string | null, depth: number, visible: boolean) => {
    // Find all children for this parent
    const children = categories.filter((c) => {
      if (!parentId) {
        return !c.parentCategoryId;
      }
      const p = (c.parentCategoryId || '').toLowerCase();
      const target = parentId.toLowerCase();
      return p === target;
    });

    // Sort by code or name
    children.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    for (const cat of children) {
      const kids = getCategoryChildren(categories, cat);
      const hasKids = kids.length > 0;
      const key = (cat.id || cat.code).toLowerCase();
      // If searching, auto-expand if any descendant matches
      const isOpen = q ? true : (openState[key] ?? true);
      const matches = doesNodeOrDescendantMatch(cat);

      if (visible && matches) {
        rows.push({
          category: cat,
          depth,
          level: depth + 1,
          hasKids,
          isOpen,
          isVisible: true,
        });
      }

      const nextParentKey = cat.id || cat.code;
      walk(nextParentKey, depth + 1, visible && matches && isOpen);
    }
  };

  walk(null, 0, true);
  return rows;
}

