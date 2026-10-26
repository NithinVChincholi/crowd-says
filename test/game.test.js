const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {action,rooms,snapshot,botPlan,normalize}=require('../server');
test('independent bot vocabulary contains both hits and plausible misses for every prompt',()=>{
 const vocabulary=require('../bot-guesses');
 for(const board of require('../boards')){
  const accepted=new Set(board.answers.flatMap(a=>[a[0],...(a[2]||'').split(',')]).map(normalize));
  assert.ok(vocabulary[board.question].some(g=>accepted.has(normalize(g))));
  assert.ok(vocabulary[board.question].some(g=>!accepted.has(normalize(g))));
  const plan=botPlan(board.question);assert.ok(plan.length>=3&&plan.length<=5);
  assert.equal(new Set(plan).size,plan.length);
 }
});
after(()=>{for(const r of rooms.values()){clearTimeout(r.timer);for(const t of r.botTimers||[])clearTimeout(t);}});
for(const mode of ['solo','team'])test(`${mode}: full match, private boards, auth, scoring and restart`,()=>{
 const host=action({action:'create',name:'Host',mode});
 const guest=action({action:'join',code:host.code,name:'Guest',team:1});
 const doHost=(a,extra={})=>action({...host,action:a,...extra});
 assert.throws(()=>action({...guest,action:'start'}),/host/);
 doHost('start');
 const room=rooms.get(host.code);
 assert.equal(snapshot(room,host.id).board[0].text,null);
 assert.throws(()=>action({action:'join',code:host.code,name:'Late'}),/started/);
 for(let round=0;round<5;round++){
  const answer=room.round.answers[0];
  doHost('guess',{guess:answer[0]});
  const before=room.players[1].score;
  action({...guest,action:'guess',guess:answer[0]});
  assert.equal(room.players[1].score,before);
  assert.equal(snapshot(room,host.id).board[0].text,answer[0]);
  assert.equal(snapshot(room,host.id).board[1].text,null);
  doHost('reveal');
  assert.ok(snapshot(room,host.id).board.every(a=>a.text));
  doHost('next');
 }
 assert.equal(room.status,'finished');
 assert.ok(room.players[0].score>0);
 assert.equal(snapshot(room,host.id).teamScores[0],room.players[0].score);
 doHost('restart');assert.equal(room.status,'lobby');assert.equal(room.players[0].score,0);
});
test('attempt cap, team requirements and malformed guesses',()=>{
 const host=action({action:'create',name:'One',mode:'team'});
 action({action:'join',code:host.code,name:'Two'});
 assert.throws(()=>action({...host,action:'start'}),/Both teams/);
 action({action:'join',code:host.code,name:'Three',team:1});
 action({...host,action:'start'});
 assert.throws(()=>action({...host,action:'guess',guess:''}),/Enter/);
 for(let i=0;i<5;i++)action({...host,action:'guess',guess:'not an answer'});
 assert.throws(()=>action({...host,action:'guess',guess:'another'}),/five guesses/);
});
test('bots join both modes, obey host controls and submit paced guesses',async()=>{
 const matches=['solo','team'].map(mode=>{
  const host=action({action:'create',name:'Human',mode});
  action({...host,action:'addBot'});
  const room=rooms.get(host.code),bot=room.players.find(p=>p.bot);
  assert.ok(bot);assert.equal(bot.team,1);
  assert.throws(()=>action({code:host.code,token:bot.token,action:'addBot'}),/host/);
  action({...host,action:'start'});
  assert.equal(bot.attempts,0);
  assert.throws(()=>action({...host,action:'addBot'}),/before starting/);
  return {host,room,bot};
 });
 await new Promise(resolve=>setTimeout(resolve,11200));
 for(const {host,room,bot}of matches){
  assert.equal(bot.attempts,1);
  assert.ok(bot.score===0||room.round.answers.some(a=>a[1]===bot.score));
  action({...host,action:'reveal'});assert.equal(room.botTimers.length,0);
  action({...host,action:'next'});assert.equal(bot.attempts,0);assert.ok(room.botTimers.length>=3&&room.botTimers.length<=5);
  action({...host,action:'reveal'});
 }
});
