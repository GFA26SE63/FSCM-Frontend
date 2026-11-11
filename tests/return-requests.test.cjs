const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function source(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, jsx:ts.JsxEmit.ReactJSX}
  }).outputText;
  const module = {exports:{}};
  new Function('require','module','exports',code)(name => Object.hasOwn(mocks,name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
test('approval and physical confirmation preserve concurrency, quantity, settlement and waiver evidence', async () => {
  const calls = [];
  const {complaintApi: api} = source('features/complaints/api.ts', {'@/shared/api/http': {
    get: async () => {throw Error('id supplied; no ambiguous lookup');},
    post: async (url,body) => {calls.push({url,body});}, put:async()=>{}}
  });
  await api.decide({code:'KN-1',id:'request',decision:'approve',text:'Approved', approvedQuantity:2,
    settlementMethod:'CashRefund',expectedVersion:4,waivePhysicalHandling:true,waiverReason:'Confirmed disposal'});
  assert.deepEqual(calls[0],{url:'/complaints/request/approve',body:{note:'Approved',approvedQuantity:2,
    settlementMethod:'CashRefund',expectedVersion:4,waivePhysicalHandling:true,waiverReason:'Confirmed disposal'}});
  const handling = {id:'request',expectedVersion:5,actualQuantity:1,completedAt:'2026-11-12T01:00:00Z',note:'Received one',evidenceReference:'paper-1'};
  await api.completeHandling(handling);
  const {id,...body} = handling;
  assert.deepEqual(calls[1],{url:`/complaints/${id}/complete-handling`,body});
  await api.decide({code:'KN-1',id:'request',decision:'reject',text:'Not eligible',expectedVersion:6});
  assert.deepEqual(calls[2],{url:'/complaints/request/reject',body:{reason:'Not eligible',expectedVersion:6}});
});
function review(role, claim = {}) {
  let form;
  const component = source('features/complaints/components/ResolveDialog.tsx', {
    '@/shared/auth/AuthContext':{useAuth:()=>({user:{role}})},
    '@/shared/auth/permissions':{can:u=>u.role==='Admin'},
    '@/shared/ui':{FormDialog:()=>null}, '../hooks':{useDecideComplaint:()=>({mutateAsync:async()=>{}}),
      useComplaint:()=>({data:{id:'id',status:'Open',requestType:'Return',requestedQuantity:4,version:3,settlementMethod:'DebtOffset',...claim}})}
  }).ResolveDialog;
  form = component({code:'KN-1',onClose(){}}).props;
  return form;
}
test('Operator can request evidence but cannot choose approve or reject', () => {
  assert.deepEqual(review('Operator').fields.find(f=>f.key==='decision').options.map(o=>o.value),['requestEvidence']);
  assert.equal(review('Admin').fields.find(f=>f.key==='decision').options.length,3);
});
test('review blocks fractional and excessive approval quantities and preserves approved recovery method', () => {
  const form = review('Admin',{status:'Approved',approvedSettlementMethod:'CashRefund'});
  assert.equal(form.initial.settlementMethod,'CashRefund');
  const qty = form.fields.find(f=>f.key==='approvedQuantity');
  for (const bad of [0,-1,1.5,5]) assert.ok(qty.validate(bad));
  assert.equal(qty.validate(4),undefined);
  assert.equal(form.fields.find(f=>f.key==='settlementMethod').options.some(o=>o.value==='None'),false);
  assert.equal(review('Admin',{requestType:'DamagedCollection'}).fields.find(f=>f.key==='settlementMethod').options.some(o=>o.value==='None'),true);
});
test('physical confirmation accepts zero, blocks excess/future values and retains sub-minute timestamp', () => {
  const Component = source('features/complaints/components/CompleteHandlingDialog.tsx', {
    react:{useState:initializer=>[initializer(),()=>{}]},
    '@/shared/ui':{FormDialog:()=>null},'../hooks':{useCompleteRequestHandling:()=>({mutateAsync:async()=>{}})}
  }).CompleteHandlingDialog;
  const form = Component({claim:{id:'id',code:'KN-1',approvedQuantity:2,version:5},onClose(){}}).props;
  const qty = form.fields.find(f=>f.key==='quantity');
  assert.equal(qty.validate(0),undefined);
  for (const bad of [-1,0.5,3]) assert.ok(qty.validate(bad));
  const at = form.fields.find(f=>f.key==='at');
  assert.equal(at.step,'any');
  assert.ok(at.validate(new Date(Date.now()+86400000).toISOString()));
  assert.equal(form.initial.at.length,23);
});
