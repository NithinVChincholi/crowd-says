// Run against an already-running preview: node scripts/verify-preview.cjs
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:3000';
async function main(){
 const page=await fetch(base).then(r=>r.text());assert.match(page,/Crowd Says/);
 const client=await fetch(base+'/client.js').then(r=>r.text());assert.match(client,/checkSession/);assert.match(client,/'Ram','Rome','Bat','Alexa'/);
 assert.equal((await fetch(base+'/events?code=MISSING&token=invalid')).status,401);
 let session;
 async function action(action){const r=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,action,name:'Connection check',mode:process.argv[3]||'solo'})});assert.equal(r.status,200);return r.json();}
 session=await action('create');
 const joinResponse=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'join',code:session.code,name:'Independent guest',team:1})});
 assert.equal(joinResponse.status,200);const guest=await joinResponse.json();assert.notEqual(guest.token,session.token);
 const guestStream=await fetch(base+`/events?code=${guest.code}&token=${guest.token}`);assert.equal(guestStream.status,200);await guestStream.body.cancel();
 await action('addBot');await action('start');
 const url=base+`/events?code=${session.code}&token=${session.token}`;
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(url,{signal:controller.signal});assert.equal(response.status,200);
  const reader=response.body.getReader();let text='';let botMoved=false;
  while(!botMoved){const {value,done}=await reader.read();assert.ok(!done,'stream unexpectedly closed');text+=new TextDecoder().decode(value);let end;while((end=text.indexOf('\n\n'))>=0){const event=text.slice(0,end);text=text.slice(end+2);if(event.startsWith('data: ')){const state=JSON.parse(event.slice(6));botMoved=state.players.some(p=>p.id!==session.id&&p.attempts>=1);}}}
  await reader.cancel();
  const reconnect=await fetch(url);assert.equal(reconnect.status,200);await reconnect.body.cancel();
  await action('reveal');console.log('PASS: updated title, bot names, stale-session rejection, independent guest joins, live bot guess, stable stream, and same-room reconnect.');
 }finally{clearTimeout(timeout);controller.abort();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

