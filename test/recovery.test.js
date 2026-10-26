const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function browser(status){
 const elements=new Map();const storage=new Map();
 const context=vm.createContext({URL,URLSearchParams,location:{origin:'https://example.test',hostname:'example.test',search:'?room=ABC123'},document:{querySelector:s=>{if(!elements.has(s))elements.set(s,{hidden:false,textContent:'',innerHTML:'',value:''});return elements.get(s);}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async()=>({status,body:{cancel:async()=>{}}}),AbortController,setTimeout,clearTimeout,setInterval:()=>{},EventSource:class{close(){this.closed=true;}}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/client.js'),'utf8'),context);
 return {context,elements,storage};
}
test('stale room clears saved identity and returns home instead of retrying forever',async()=>{
 const {context,elements,storage}=browser(401);
 storage.set('crowd-session','old');
 await vm.runInContext("session={code:'OLD',token:'expired'};checkSession(session)",context);
 assert.equal(storage.has('crowd-session'),false);
 assert.equal(elements.get('#home').hidden,false);
 assert.equal(elements.get('#game').hidden,true);
 assert.match(elements.get('#message').textContent,/previous room is no longer available/);
});
test('valid sessions are preserved and bot display names are distinct and labeled',async()=>{
 const {context}=browser(200);
 await vm.runInContext("session={code:'VALID',token:'saved'};checkSession(session)",context);
 assert.equal(vm.runInContext('session.code',context),'VALID');
 assert.equal(vm.runInContext("displayName('Practice Bot 1')",context),'Ram Bot');
 assert.equal(vm.runInContext("displayName('Practice Bot 2')",context),'Rome Bot');
 assert.equal(vm.runInContext("roomInvite('ABC123')",context),'https://example.test/?room=ABC123');
});

