const {test,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {Order}=require('../models/OrderModel');
const {CustomerAccount}=require('../models/CustomerAccountModel');
const {getCustomers}=require('../controllers/CustomerController');
afterEach(()=>mock.restoreAll());
test('customer list labels account state, preserves history, and separates recreated accounts',async()=>{
 const active='aaaaaaaaaaaaaaaaaaaaaaaa',deleted='bbbbbbbbbbbbbbbbbbbbbbbb';
 const row=(id,user,email,total)=>({_id:id,user,customer:{name:'Buyer',email},status:'pending',items:[],total,currency:'USD',createdAt:new Date('2026-10-10')});
 const rows=[row('1',active,'same@example.com',20),row('2',deleted,'same@example.com',30),row('3',deleted,'old@example.com',40),row('4',undefined,'legacy@example.com',10)];
 mock.method(Order,'find',()=>({sort(){return this;},lean:async()=>rows}));
 mock.method(CustomerAccount,'find',filter=>{assert.deepEqual(filter._id.$in,[active,deleted]);return{select(fields){assert.equal(fields,'_id');return this;},lean:async()=>[{_id:active}]};});
 let body;await getCustomers({}, {json:value=>{body=value;},status:()=>{throw new Error('Unexpected error');}});
 assert.equal(body.customers.length,3);
 const live=body.customers.find(c=>c.id===active);assert.equal(live.accountStatus,'active');assert.equal(live.orders,1);
 const removed=body.customers.find(c=>c.id===deleted);assert.equal(removed.accountStatus,'deleted');assert.equal(removed.orders,2);assert.equal(removed.totalSpent,70);
 assert.equal(body.customers.find(c=>c.email==='legacy@example.com').accountStatus,'historical');
});
test('account lookup failure does not incorrectly label customers deleted',async()=>{
 mock.method(Order,'find',()=>({sort(){return this;},lean:async()=>[{user:'aaaaaaaaaaaaaaaaaaaaaaaa'}]}));
 mock.method(CustomerAccount,'find',()=>({select(){return this;},lean:async()=>{throw new Error('Unavailable');}}));
 let status,body;await getCustomers({}, {status:value=>{status=value;return{json:value=>body=value};}});
 assert.equal(status,500);assert.equal(body.success,false);
});
