import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { initSync, retrySync, syncState, stripPhotos } from '../js/sync.js';

test('照片尚在下載時保留雲端指標，刪除標記不下載相片',()=>{
  const d=store.emptyData();
  d.meals=[{id:'waiting',hasPhoto:true,photo:null},{id:'deleted',deletedAt:1,hasPhoto:true,photo:null}];
  assert.deepEqual(stripPhotos(d).meals.map(m=>m.hasPhoto),[true,false]);
});

test('模擬 Firestore 確認、離線修改、相片失敗和重試，只有成功上傳才清除待同步數',async()=>{
  const storage=new Map([['ontime-sync-on','1']]);
  const cloud=new Map();
  let authChanged, failPhoto=false;
  const ref=key=>({
    key,collection:()=>({doc:name=>ref(name)}),
    get:async()=>({exists:cloud.has(key),data:()=>cloud.get(key)}),
    set:async value=>{if(failPhoto)throw Error('offline');cloud.set(key,value);},
    onSnapshot:()=>()=>{}
  });
  const db={collection:()=>({doc:name=>ref(name)}),runTransaction:async fn=>fn({
    get:r=>r.get(),set:(r,value)=>cloud.set(r.key,value)
  })};
  const auth={setPersistence:async()=>{},onAuthStateChanged:cb=>{authChanged=cb;}};
  const app={name:'ontime',auth:()=>auth,firestore:()=>db};
  const globals={
    document:{querySelector:()=>true}, window:{addEventListener:()=>{},firebase:{apps:[app],auth:{Auth:{Persistence:{LOCAL:'local'}}},firestore:{FieldValue:{serverTimestamp:()=>1}}}},
    navigator:{onLine:true},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}
  };
  const previous=new Map();
  for(const [key,value] of Object.entries(globals)){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});}
  try {
    initSync();await new Promise(r=>setImmediate(r));await authChanged({uid:'test',email:'example@example.test'});
    assert.equal(syncState().status,'cloud');assert.equal(syncState().pending,0);
    store.update(d=>d.meals.push({id:'meal',photo:'data:image/png;base64,YQ=='}));
    assert.equal(syncState().pending,1);
    failPhoto=true;await retrySync();assert.equal(syncState().status,'error');assert.equal(syncState().pending,1);
    failPhoto=false;await retrySync();assert.equal(syncState().status,'cloud');assert.equal(syncState().pending,0);
    assert.equal(cloud.get('ontime-photo-meal').data,'data:image/png;base64,YQ==');
    assert.ok(syncState().lastSync);assert.equal(JSON.parse(cloud.get('ontime').json).meals[0].hasPhoto,true);
    await authChanged(null);
  } finally {
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});
