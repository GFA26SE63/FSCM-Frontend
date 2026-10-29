import { db } from '../fixtures';
import type { DbCategory, DbProduct } from '../fixtures/types';
import { MockRouter, conflict, notFound, paginate, validation } from '../router';
import { mockGuid, warehouseName } from './common';

const catName = (code: string) => db.categories.find((c) => c.code === code)?.name ?? code;
const productSummary = (p: DbProduct) => ({
  // The server addresses products by identifier; the code stays for people to read.
  id: mockGuid(p.sku),
  sku: p.sku,
  name: p.name,
  categoryCode: p.categoryCode,
  categoryName: catName(p.categoryCode),
  productCategoryId: mockGuid(p.categoryCode),
  categoryId: mockGuid(p.categoryCode),
  packSpec: p.packSpec,
  basePrice: p.basePrice,
  shelfLifeDays: p.shelfLifeDays,
  nearExpiryDays: p.nearExpiryDays,
  defaultMlor: p.defaultMlor,
  status: p.status,
});
const productDetail = (p: DbProduct) => ({
  ...productSummary(p), unitCost: p.unitCost, replaceOf: p.replaceOf, replacedBy: p.replacedBy,
  batches: db.batches.filter((b) => b.sku === p.sku && !b.disposed).map((b) => ({ warehouseCode: b.warehouseCode, warehouseName: warehouseName(b.warehouseCode), batchCode: b.code, expiry: b.expiry, available: b.available })),
});
const categoryDto = (c: DbCategory) => ({ id: mockGuid(c.code), ...c, productCount: db.products.filter((p) => p.categoryCode === c.code).length });
const find = (sku: string) => db.products.find((p) => p.sku === sku) ?? (() => { throw notFound(`Sản phẩm ${sku}`); })();
const nextSku = () => 'SKU' + String(Math.max(...db.products.map((p) => Number(p.sku.slice(3)))) + 1).padStart(3, '0');

function readProduct(body: Record<string, unknown>) {
  const errors: Record<string, string[]> = {};
  const num = (k: string) => (body[k] === undefined || body[k] === '' || Number.isNaN(Number(body[k])) ? (errors[k] = ['Phải là số.'], 0) : Number(body[k]));
  const out = {
    name: String(body.name ?? '').trim(), categoryCode: String(body.categoryCode ?? ''), packSpec: String(body.packSpec ?? '').trim(),
    basePrice: num('basePrice'), shelfLifeDays: num('shelfLifeDays'), nearExpiryDays: num('nearExpiryDays'), defaultMlor: num('defaultMlor'), unitCost: body.unitCost ? Number(body.unitCost) : 0,
  };
  if (!out.name) errors.name = ['Bắt buộc nhập.'];
  if (!out.packSpec) errors.packSpec = ['Bắt buộc nhập.'];
  if (out.basePrice <= 0) errors.basePrice = ['Giá phải lớn hơn 0.'];
  if (out.shelfLifeDays <= 0) errors.shelfLifeDays = ['Phải lớn hơn 0.'];
  if (out.nearExpiryDays >= out.shelfLifeDays) errors.nearExpiryDays = ['Phải nhỏ hơn tổng hạn dùng.'];
  if (out.defaultMlor <= 0 || out.defaultMlor >= 1) errors.defaultMlor = ['m phải nằm trong (0, 1).'];
  if (Object.keys(errors).length) throw validation(errors);
  return out;
}

export function registerCatalog(r: MockRouter) {
  // Plain array on the real API too; /products stays paged.
  r.get('/categories', () => db.categories.map(categoryDto));
  r.get('/categories/:code', ({ params }) => {
    const c = db.categories.find((x) => x.code === params.code || mockGuid(x.code) === params.code) ?? (() => { throw notFound(`Danh mục ${params.code}`); })();
    return { ...categoryDto(c), products: db.products.filter((p) => p.categoryCode === c.code).map(productSummary) };
  });
  r.post('/categories', ({ body }) => {
    const name = String(body?.name ?? '').trim();
    if (!name) throw validation({ name: ['Bắt buộc nhập.'] });
    if (db.categories.some((c) => c.name === name)) throw validation({ name: ['Tên đã tồn tại.'] });
    const code = body?.code ? String(body.code).trim().toUpperCase() : 'CAT-' + String(Math.max(0, ...db.categories.map((c) => Number(c.code.slice(4)))) + 1).padStart(2, '0');
    const c: DbCategory = { code, name, description: body?.description ?? '', status: body?.status ?? 'Active' };
    db.categories.push(c);
    return categoryDto(c);
  });
  r.put('/categories/:code', ({ params, body }) => {
    const c = db.categories.find((x) => x.code === params.code || mockGuid(x.code) === params.code) ?? (() => { throw notFound(`Danh mục ${params.code}`); })();
    if (db.categories.some((x) => x.name === body?.name && x.code !== c.code)) throw validation({ name: ['Tên đã tồn tại.'] });
    Object.assign(c, { name: body?.name ?? c.name, description: body?.description ?? c.description, status: body?.status ?? c.status });
    return categoryDto(c);
  });
  r.patch('/categories/:code/status', ({ params, body }) => {
    const c = db.categories.find((x) => x.code === params.code || mockGuid(x.code) === params.code) ?? (() => { throw notFound(`Danh mục ${params.code}`); })();
    c.status = body?.isActive === false ? 'Inactive' : 'Active';
    return categoryDto(c);
  });

  r.get('/products', ({ query }) => {
    let prods = db.products;
    if (query?.categoryId) {
      prods = prods.filter((p) => p.categoryCode === query.categoryId || mockGuid(p.categoryCode) === query.categoryId);
    }
    return paginate(prods.map(productSummary), query, (p) => `${p.sku} ${p.name} ${p.categoryName}`);
  });
  r.get('/products/:sku', ({ params }) => productDetail(find(params.sku)));
  r.post('/products', ({ body }) => {
    const sku = nextSku();
    const p: DbProduct = { sku, ...readProduct(body ?? {}), status: 'Draft', replaceOf: body?.replaceOf ?? null, replacedBy: null };
    db.products.push(p);
    return productDetail(p);
  });
  r.put('/products/:sku', ({ params, body }) => {
    const p = find(params.sku);
    if (p.status !== 'Draft') throw conflict(`${p.sku} đã ${p.status === 'Published' ? 'publish' : 'Inactive'} – thông tin bị khóa. Dùng "Tạo bản mới" để thay đổi.`);
    Object.assign(p, readProduct(body ?? {}));
    return productDetail(p);
  });
  r.delete('/products/:sku', ({ params }) => {
    const p = find(params.sku);
    if (p.status !== 'Draft') throw conflict('Chỉ xóa được bản nháp.');
    db.products.splice(db.products.indexOf(p), 1);
    return undefined;
  });
  r.post('/products/:sku/publish', ({ params }) => {
    const p = find(params.sku);
    if (p.status !== 'Draft') throw conflict('Chỉ publish được bản nháp.');
    p.status = 'Published';
    if (p.replaceOf) {
      const old = db.products.find((x) => x.sku === p.replaceOf);
      if (old) Object.assign(old, { status: 'Inactive', replacedBy: p.sku });
    }
    return productDetail(p);
  });
  r.post('/products/:sku/inactivate', ({ params }) => {
    const p = find(params.sku);
    if (p.status !== 'Published') throw conflict('Chỉ Inactive được sản phẩm đã publish.');
    p.status = 'Inactive';
    return productDetail(p);
  });
  r.post('/products/:sku/clone', ({ params, body }) => {
    const src = find(params.sku);
    const copy: DbProduct = { ...src, ...(body?.name ? { name: body.name } : {}), sku: nextSku(), status: 'Draft', replaceOf: src.sku, replacedBy: null };
    db.products.push(copy);
    return productDetail(copy);
  });
}
