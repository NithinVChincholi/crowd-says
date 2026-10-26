const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const boards = require('./boards');
const botGuesses = require('./bot-guesses');
const rooms = new Map();
const normalize = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
function snapshot(room, id) {
  const round = room.round;
  return {code:room.code,mode:room.mode,status:room.status,hostId:room.hostId,you:id,roundNumber:room.index+1,totalRounds:room.totalRounds,players:room.players.map(p=>({id:p.id,name:p.name,team:p.team,score:p.score,attempts:p.attempts})),teamScores:[0,1].map(t=>room.players.filter(p=>p.team===t).reduce((s,p)=>s+p.score,0)),question:round?.question,endsAt:room.endsAt,feed:room.feed,board:round?.answers.map((a,i)=>({index:i,revealed:room.found.has(i)||room.status==='reveal'||room.status==='finished',text:room.found.has(i)||room.status==='reveal'||room.status==='finished'?a[0]:null,points:room.found.has(i)||room.status==='reveal'||room.status==='finished'?a[1]:null,by:room.found.get(i)||null}))};
}
function broadcast(r){for(const [id,clients] of r.clients)for(const res of clients)res.write(`data: ${JSON.stringify(snapshot(r,id))}\n\n`);}
function stopBots(r){for(const timer of r.botTimers||[])clearTimeout(timer);r.botTimers=[];}
function botPlan(question){
 const candidates=[...(botGuesses[question]||['food','music','friends','water','phone'])];
 for(let i=candidates.length-1;i>0;i--){const j=crypto.randomInt(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 return candidates.slice(0,crypto.randomInt(3,6));
}
function scheduleBots(r){
 stopBots(r);
 for(const bot of r.players.filter(p=>p.bot)){
  const plan=botPlan(r.round.question);let delay=crypto.randomInt(7000,11001);
  plan.forEach((guess)=>{r.botTimers.push(setTimeout(()=>{
   if(r.status==='playing'&&bot.attempts<5)action({action:'guess',code:r.code,token:bot.token,guess});
  },delay));delay+=crypto.randomInt(7000,11001);});
 }
}
function reveal(r){if(r.status!=='playing')return;clearTimeout(r.timer);stopBots(r);r.status='reveal';r.endsAt=null;broadcast(r);}
function nextRound(r){clearTimeout(r.timer);stopBots(r);if(r.index+1>=r.totalRounds){r.status='finished';broadcast(r);return;}r.index++;r.round=r.deck[r.index];r.found=new Map();r.feed=[];r.players.forEach(p=>p.attempts=0);r.status='playing';r.endsAt=Date.now()+60000;r.timer=setTimeout(()=>reveal(r),60000);scheduleBots(r);broadcast(r);}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function action(body){
 const {action,code,token}=body;
 if(action==='create'){
  if(rooms.size>=1000)fail('Server is busy. Please try again shortly.',503);
  let c;do{c=crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(c));
  const r={code:c,mode:body.mode==='team'?'team':'solo',status:'lobby',players:[],clients:new Map(),hostId:null,index:-1,totalRounds:5,found:new Map(),feed:[],created:Date.now()};rooms.set(c,r);return join(r,body);
 }
 const r=rooms.get(String(code||'').toUpperCase());if(!r)fail('Room not found. Check the room code.',404);
 if(action==='join')return join(r,body);
 const p=r.players.find(p=>p.token===token);if(!p)fail('Your room session was not found. Join again.',401);
 if(action==='guess'){
  if(r.status!=='playing')fail('Wait for the next round.');
  if(p.attempts>=5)fail('You have used your five guesses this round.');
  const guess=normalize(String(body.guess||''));if(!guess||guess.length>80)fail('Enter a guess of 1–80 characters.');p.attempts++;
  const i=r.round.answers.findIndex(a=>[a[0],...(a[2]||'').split(',')].some(v=>normalize(v)===guess));
  let message='No match — try another answer.';
  if(i>=0&&!r.found.has(i)){r.found.set(i,p.name);p.score+=r.round.answers[i][1];message=`${r.round.answers[i][0]}! +${r.round.answers[i][1]} points`;r.feed.unshift(`${p.name} found ${r.round.answers[i][0]} (+${r.round.answers[i][1]})`);}
  else if(i>=0)message='That answer has already been claimed.';
  if(r.found.size===r.round.answers.length||r.players.every(p=>p.attempts>=5))reveal(r);else broadcast(r);
  return {message};
 }
 if(p.id!==r.hostId)fail('Only the host can do that.',403);
 if(action==='addBot'){
  if(r.status!=='lobby')fail('Add bots before starting the game.');
  let number=1;while(r.players.some(p=>p.name===`Practice Bot ${number}`))number++;
  const team=[0,1].map(t=>r.players.filter(p=>p.team===t).length);
  const added=join(r,{name:`Practice Bot ${number}`,team:team[0]<=team[1]?0:1});
  r.players.find(p=>p.id===added.id).bot=true;broadcast(r);
 }
 else if(action==='start'){if(r.status!=='lobby')fail('The game has already started.');if(r.players.length<2)fail('At least two players are needed.');if(r.mode==='team'&&!([0,1].every(t=>r.players.some(p=>p.team===t))))fail('Both teams need a player.');r.deck=Array.from(crypto.randomBytes(boards.length),(n,i)=>({n,i})).sort((a,b)=>a.n-b.n).map(v=>boards[v.i]);nextRound(r);}
 else if(action==='reveal'){if(r.status!=='playing')fail('No active round.');reveal(r);}
 else if(action==='next'){if(r.status!=='reveal')fail('Reveal this round first.');nextRound(r);}
 else if(action==='restart'){if(r.status!=='finished')fail('Finish the game first.');r.status='lobby';r.index=-1;r.round=null;r.players.forEach(p=>{p.score=0;p.attempts=0;});r.feed=[];broadcast(r);}
 else fail('Unknown action.');
 return {ok:true};
}
function join(r,body){if(r.status!=='lobby')fail('This game has started. Join a new room.');if(r.players.length>=24)fail('This room is full (24 players).');const name=String(body.name||'').trim().slice(0,24);if(!name)fail('Enter your name.');if(r.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))fail('That name is taken in this room.');const p={id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),name,team:body.team===1?1:0,score:0,attempts:0};r.players.push(p);r.hostId ||= p.id;broadcast(r);return {code:r.code,token:p.token,id:p.id};}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'){res.writeHead(200);res.end('ok');return;}
 if(url.pathname==='/events'){
  const r=rooms.get(url.searchParams.get('code'));const p=r?.players.find(p=>p.token===url.searchParams.get('token'));if(!p){res.writeHead(401);res.end('Invalid session');return;}
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no','Referrer-Policy':'no-referrer'});res.write(`data: ${JSON.stringify(snapshot(r,p.id))}\n\n`);if(!r.clients.has(p.id))r.clients.set(p.id,new Set());r.clients.get(p.id).add(res);const heartbeat=setInterval(()=>res.write(': keepalive\n\n'),20000);req.on('close',()=>{clearInterval(heartbeat);r.clients.get(p.id)?.delete(res);});return;
 }
 if(url.pathname==='/api'&&req.method==='POST'){
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)fail('Request too large.',413);}const result=action(JSON.parse(raw));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));}catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
 }
 const files={'/':'index.html','/style.css':'style.css','/client.js':'client.js'};const file=files[url.pathname];if(!file){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});fs.createReadStream(path.join(__dirname,'public',file)).pipe(res);
});
const cleanup=setInterval(()=>{for(const [code,r]of rooms)if(Date.now()-r.created>12*60*60*1000){clearTimeout(r.timer);for(const clients of r.clients.values())for(const res of clients)res.end();rooms.delete(code);}},60000);cleanup.unref();
if(require.main===module)server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log(`Crowd Says running on port ${process.env.PORT||3000}`));
module.exports={server,action,rooms,snapshot,normalize,botPlan};


