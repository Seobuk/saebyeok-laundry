import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/realtime/validate.js';
import {validatePresence as serverValidate,MAX_BYTES} from '../server/state.js';
const V=globalThis.SaebyeokValidate;
const presence=(extra={})=>({in:1,x:0,z:0,fy:null,a:0,n:[0,0],l:[0,0,0],t:0,c:0,m:-1,ms:0,mu:0,f:0,...extra});
test('server and browser share one validator and limits',()=>{
 assert.equal(serverValidate,V.validatePresence);assert.equal(MAX_BYTES,2048);assert.deepEqual([...V.ROOMS],['laundry','spa']);
 assert.equal(V.validatePresence(presence({identity:null})),false,'clients cannot claim identity');
});
test('size check counts UTF-8 bytes and rejects unencodable values',()=>{
 assert.equal(V.withinSize({s:'가'.repeat(600)}),true);assert.equal(V.withinSize({s:'가'.repeat(700)}),false);
 const loop={};loop.self=loop;assert.equal(V.withinSize(loop),false);assert.equal(V.jsonBytes(1n),Infinity);
});
test('normalize applies room rules without mutating input',()=>{
 const now=1_000_000,p=presence({m:2,ms:1,mu:now*10});
 assert.deepEqual(V.normalize('laundry',p,now),{...p,mu:now+600000});assert.equal(p.mu,now*10);
 assert.deepEqual(V.normalize('spa',p,now),{...p,m:-1,ms:0,mu:0});
 assert.deepEqual(V.normalize('laundry',presence({in:0,m:2,ms:1,mu:5}),now),presence({in:0}));
});
