const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function source(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) throw new Error(`Missing mock ${name}`);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const model = source('features/dashboard/dashboardModel.ts');

test('dashboard defaults to Vietnam calendar date across UTC month rollover', () => {
  assert.deepEqual(model.defaultDashboardDates(new Date('2026-10-31T18:00:00Z')), { fromDate:'2026-11-01', toDate:'2026-11-01' });
});
test('Admin and Operator see all report tabs; Keeper and Manager see their own reports', () => {
  assert.deepEqual(model.dashboardTabs('Operator'), model.dashboardTabs('Admin'));
  assert.deepEqual(model.dashboardTabs('WarehouseKeeper').map(x=>x.key), ['overview','inventory']);
  assert.deepEqual(model.dashboardTabs('SalesManager').map(x=>x.key), ['overview','sales','customers']);
  const cards=['revenue','allocationIssues','receiptPending','expired'].map(key=>({key}));
  assert.deepEqual(model.visibleCards(cards,'WarehouseKeeper','overview').map(c=>c.key),['receiptPending','expired']);
  assert.deepEqual(model.visibleCards(cards,'Operator','overview').map(c=>c.key),['allocationIssues']);
  assert.deepEqual(model.visibleCards(cards,'Admin','overview').map(c=>c.key),['revenue']);
});
test('API forwards real dates and scope filters without accepting actor or role from the client', async () => {
  let request;
  const {dashboardApi}=source('features/dashboard/api.ts',{'@/shared/api/http':{get:async (...args)=>{request=args;return {};}}});
  await dashboardApi.get({fromDate:'2026-11-01',toDate:'2026-11-11',regionId:'r',warehouseId:'w',salesGroupId:'g',role:'Admin',userId:'forged'});
  assert.deepEqual(request,['/dashboard',{fromDate:'2026-11-01',toDate:'2026-11-11',regionId:'r',warehouseId:'w',salesGroupId:'g'}]);
});
test('query cache is isolated by user and role and polls only while visible', async () => {
  let user={id:'keeper-a',role:'WarehouseKeeper'};let options;
  const {useDashboard}=source('features/dashboard/hooks.ts',{
    '@tanstack/react-query':{useQuery:o=>{options=o;return o;}},
    '@/shared/auth/AuthContext':{useAuth:()=>({user})},'./api':{dashboardApi:{get:async f=>f}},
  });
  const filters={fromDate:'2026-11-01',toDate:'2026-11-11'};
  const first=useDashboard(filters).queryKey;
  assert.equal(options.refetchIntervalInBackground,false);assert.equal(options.refetchInterval,30000);
  user={id:'manager-b',role:'SalesManager'};assert.notDeepEqual(useDashboard(filters).queryKey,first);
  assert.equal(options.refetchInterval,60000);assert.deepEqual(await options.queryFn(),filters);
  user=null;useDashboard(filters);assert.equal(options.enabled,false);
});
test('API failures replace stale data with a visible error rather than zero or cached totals', () => {
  const {QueryState}=source('shared/ui/QueryState.tsx',{
    './EmptyState':{EmptyState:({title,description})=>React.createElement('p',null,title,description)},
    '../api/errors':{errorMessage:()=> 'Server unavailable'},
  });
  const html=renderToStaticMarkup(React.createElement(QueryState,{query:{isLoading:false,error:new Error('offline'),data:{revenue:123}}},()=>React.createElement('span',null,'OLD REVENUE 123')));
  assert.match(html,/Không tải được dữ liệu/);assert.doesNotMatch(html,/OLD REVENUE/);
});
test('Keeper region grants are saved explicitly and derived region labels do not grant sibling warehouses', async () => {
  const types=source('features/users/types.ts',{'@/shared/auth/roles':source('shared/auth/roles.ts'),'./userPolicy':{CREATABLE_ROLES:['WarehouseKeeper']}});
  const keeper={id:'k',role:'WarehouseKeeper',email:'k@test.local',fullName:'Keeper',scope:{warehouseIds:['w1'],regionIds:['r-derived'],salesGroupIds:[],retailerIds:[]}};
  const assignments=types.assignmentsFromUser(keeper);
  assert.deepEqual(assignments.regions,[]);
  const calls=[];
  const {finishUserSave}=source('features/users/saveUser.ts',{
    '@/shared/api/errors':{ApiError:Error},'./userPolicy':{assertCreatableRole:()=>{}},
    './api':{userApi:{get:async()=>keeper,changeScope:async input=>calls.push(input)}},
  });
  await finishUserSave({...keeper,assignments:{...assignments,regions:['r-explicit']}});
  assert.deepEqual(calls,[{userId:'k',kind:'regions',scopeId:'r-explicit',remove:false}]);
});

test('dashboard picking link shows and expands the requested sheet, with a way back to all sheets', () => {
  let search='?code=PK-TARGET';
  const rows=['TARGET','OTHER'].map(code=>({id:code,pickingCode:`PK-${code}`,status:'Pending',warehouseCode:'WH',warehouseName:'Kho',orderCode:`SO-${code}`,retailerCode:'R',retailerName:'Shop',items:[{sku:`SKU-${code}`,productName:'Milk',batchCode:'B',expirationDate:'2026-11-20',requestedQuantity:10,pickedQuantity:0,remainingQuantity:10,status:'Pending'}]}));
  const Wrap=({children,title,value,label,actions})=>React.createElement('div',null,title,label,value,actions,children);
  const requests=[];
  // The server filters by pickingCode (GraphQL where); the mock returns what the server would.
  const page=(q)=>{requests.push(q);const r=q.pickingCode?rows.filter(x=>x.pickingCode===q.pickingCode):rows;
    return {data:{rows:r,totalCount:r.length,pageInfo:{hasNextPage:false,hasPreviousPage:false,startCursor:null,endCursor:null},statusCounts:{InProgress:0,Completed:0,Exception:0}},isPending:false,isError:false,isFetching:false};};
  const {RunPickingPage}=source('features/runpicking/pages/RunPickingPage.tsx',{
    '@/shared/router/compat':{useLocation:()=>({search}),useNavigate:()=>()=>{}},
    '@/shared/router/listState':{useStringParam:()=>['',()=>{}],useEnumParam:(_n,_a,fallback)=>[fallback,()=>{}],useQueryParams:()=>({params:new URLSearchParams(search),setParams:()=>{}}),parsePage:()=>1},
    '@/shared/auth/AuthContext':{useAuth:()=>({user:{id:'u',role:'Admin'}})},
    '@/shared/api/errors':{errorMessage:String},
    '../pickingGraphql':{PAGE_SIZES:[10,20,50],PICKING_STATUSES:['Pending','InProgress','Completed','Exception']},
    '../hooks':{usePickingListPage:page,useWarehouseOptions:()=>({data:[]})},
    '@/shared/ui':{Card:Wrap,Chip:Wrap,PageHeader:Wrap,Stat:Wrap,Button:Wrap,Callout:Wrap,Select:()=>null,SimpleTable:({rows,columns})=>React.createElement('div',null,rows.map((r,i)=>React.createElement('div',{key:i},columns.map((c,j)=>React.createElement('span',{key:j},c.cell(r))))))},
    '@/shared/lib':{formatCases:String,formatNumber:String,formatPercent:String},
    '@/shared/lib/dates':{formatDate:String,formatInstantDateTime:String},
  });
  const html=renderToStaticMarkup(React.createElement(RunPickingPage));
  assert.equal(requests.at(-1).pickingCode,'PK-TARGET');
  assert.match(html,/PK-TARGET/);assert.match(html,/SKU-TARGET/);assert.match(html,/Xem tất cả phiếu/);assert.doesNotMatch(html,/PK-OTHER/);
  search='';const all=renderToStaticMarkup(React.createElement(RunPickingPage));
  assert.equal(requests.at(-1).pickingCode,undefined);
  assert.match(all,/PK-TARGET/);assert.match(all,/PK-OTHER/);assert.doesNotMatch(all,/Xem tất cả phiếu/);
});
