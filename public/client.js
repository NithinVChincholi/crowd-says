const $=s=>document.querySelector(s);let session=null,stream,state,checkingSession=false;
try{session=JSON.parse(localStorage.getItem('crowd-session')||'null');}catch{localStorage.removeItem('crowd-session');}
const botNames=['Ram','Rome','Bat','Alexa','Pam','Echo','Orbit','Nova'];
const displayName=s=>String(s??'').replace(/Practice Bot (\d+)/g,(_,number)=>`${botNames[(Number(number)-1)%botNames.length]}${Number(number)>botNames.length?' '+Math.ceil(Number(number)/botNames.length):''} Bot`);
const esc=s=>displayName(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inviteCode=new URLSearchParams(location.search).get('room');
if(inviteCode&&/^[A-Fa-f0-9]{6}$/.test(inviteCode))$('#join input[name="code"]').value=inviteCode.toUpperCase();
function roomInvite(code){const url=new URL(location.origin);url.searchParams.set('room',code);return url.href;}
function showInvite(){
 const local=['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);
 const panel=$('#invite');panel.hidden=false;
 panel.innerHTML=local?'<p>This preview runs on your computer. A friend on another computer needs the publicly deployed website URL and your room code. Public hosting is not set up yet.</p>':`<label>Send this link to a friend<input readonly value="${esc(roomInvite(state.code))}" onclick="this.select()"></label><p class="note">They enter their own name and join before you start the game. This link includes only the room code.</p>`;
}
async function api(action,data={}){const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,action,...data})});const b=await r.json();if(!r.ok)throw Error(b.error);return b;}
$('#practice').onclick=async()=>{
 $('#practice').disabled=true;
 try{
  session=await api('create',{name:$('#create input[name="name"]').value.trim()||'You',mode:'solo'});
  localStorage.setItem('crowd-session',JSON.stringify(session));
  await api('addBot');await api('start');connect();message('');
 }catch(e){message(e.message);if(session)connect();}
 finally{$('#practice').disabled=false;}
};
function message(s){$('#message').textContent=s;}
for(const action of ['create','join'])$('#'+action).onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const data=Object.fromEntries(new FormData(e.target));data.team=Number(data.team||0);session=await api(action,data);localStorage.setItem('crowd-session',JSON.stringify(session));connect();message('');}catch(e){message(e.message);}finally{button.disabled=false;}};
async function checkSession(expected){
 if(checkingSession||!expected)return;checkingSession=true;
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch(`/events?code=${encodeURIComponent(expected.code)}&token=${encodeURIComponent(expected.token)}`,{signal:controller.signal,cache:'no-store'});
  await response.body?.cancel();
  if(session!==expected)return;
  if(response.status===401||response.status===404){leave();message('Your previous room is no longer available. Start a fresh game with “Play against a bot”, or create or join a room below.');}
 }catch{if(session===expected)message('Cannot reach the game server. Your room is saved; reconnecting automatically. You can also leave and try a fresh game.');}
 finally{clearTimeout(timeout);checkingSession=false;}
}
function connect(){
 stream?.close();const expected=session;
 stream=new EventSource(`/events?code=${encodeURIComponent(session.code)}&token=${encodeURIComponent(session.token)}`);
 stream.onmessage=e=>{if(session!==expected)return;state=JSON.parse(e.data);message('');render();};
 stream.onerror=()=>{if(session!==expected)return;message('Connection interrupted. Checking your room…');checkSession(expected);};
 stream.onopen=()=>{if(session===expected)message('');};
 $('#home').hidden=true;$('#game').hidden=false;$('#game').innerHTML='<div class="panel">Connecting to your room… <button onclick="leave()">Leave room</button></div>';
 checkSession(expected);
}
function leave(){stream?.close();session=null;state=null;localStorage.removeItem('crowd-session');$('#home').hidden=false;$('#game').hidden=true;message('');}
async function act(action){try{await api(action);message('');}catch(e){message(e.message);}}
function render(){const s=state,me=s.players.find(p=>p.id===s.you),host=s.hostId===s.you;const sorted=[...s.players].sort((a,b)=>b.score-a.score);let content='';
 if(s.status==='lobby')content=`<div class="panel"><span class="eyebrow">THE WAITING ROOM</span><h2>Good company. Great guesses.</h2><p>Friends need the same publicly hosted website address plus this code. Localhost links cannot be shared across computers. Room code: <b>${esc(s.code)}</b></p><p>Everyone gets 5 guesses each round. The first player to claim an answer gets its points. In team mode, individual points add to your team's total.</p><p>Spelling matters; common synonyms are accepted. No points lost for a miss. Five rounds, 60 seconds each. Highest total wins; ties share the win.</p><p class="note">AI-predicted boards · Fixed answers and scores · No live AI judging</p><p class="note">Testing alone? Add a scripted Practice Bot. Bots make up to five guesses, starting after 7–11 seconds, with the same scoring rules. Bots use independent plausible guesses and may miss answers.</p>${host?'<button onclick="act(\'start\')">Start game ↗</button><button class="secondary" onclick="act(\'addBot\')">Add bot +</button>':'<p>Waiting for the host to start…</p>'}</div>`;
 else if(s.status==='finished'){const best=s.mode==='team'?Math.max(...s.teamScores):sorted[0].score;const winners=s.mode==='team'?s.teamScores.map((v,i)=>v===best?['Coral','Mint'][i]:null).filter(Boolean):sorted.filter(p=>p.score===best).map(p=>p.name);content=`<div class="panel"><span class="eyebrow">THAT'S A WRAP</span><h2 class="winner">${winners.map(esc).join(' & ')} ${winners.length>1?'tie for the win!':'wins!'}</h2><p>${best} points. A crowd-pleasing performance.</p>${host?'<button onclick="act(\'restart\')">Play again ↗</button>':''}</div>`;}
 else content=`<div class="panel"><div class="game-top"><span class="eyebrow">ROUND ${s.roundNumber} OF ${s.totalRounds} · AI PREDICTION</span><span id="timer" class="timer"></span></div><h2 class="question">${esc(s.question)}</h2><div class="board">${s.board.map(a=>`<div class="answer ${a.revealed?'':'hidden'}"><span class="rank">${a.index+1}</span><span>${a.revealed?esc(a.text):'Hidden answer'}${a.by?`<small>Claimed by ${esc(a.by)}</small>`:''}</span><strong>${a.revealed?a.points:'· · ·'}</strong></div>`).join('')}</div>${s.status==='playing'?`<form id="guess"><label>Your guess · ${5-me.attempts} attempts left<input name="guess" maxlength="80" required autocomplete="off" placeholder="What would the crowd say?" ${me.attempts>=5?'disabled':''}></label><button ${me.attempts>=5?'disabled':''}>Lock in guess ↗</button></form>`:'<p>Round complete. Here’s the full board.</p>'}<div class="host-actions">${host?(s.status==='playing'?'<button class="secondary" onclick="act(\'reveal\')">End round & reveal</button>':`<button onclick="act('next')">${s.roundNumber===s.totalRounds?'Show winners':'Next round'} ↗</button>`):s.status==='reveal'?'<span>Waiting for the host to continue…</span>':''}</div><div class="feed">${s.feed.map(esc).join('<br>')}</div></div>`;
 const active=document.activeElement;const draft=active?.name==='guess'?active.value:null;
 $('#game').innerHTML=`<div class="game-top"><div><span class="eyebrow">ROOM CODE</span><div class="room-code">${esc(s.code)}</div></div><div><span class="tag">${s.mode==='team'?'Team play':'Individual play'}</span><button class="secondary" onclick="leave()">Leave room</button></div></div><div class="game-layout">${content}<aside class="panel"><span class="eyebrow">THE LEADERBOARD</span>${s.mode==='team'?`<h2>Coral ${s.teamScores[0]}<br>Mint ${s.teamScores[1]}</h2>`:'<h2>Who’s reading the room?</h2>'}${sorted.map(p=>`<div class="player"><span>${esc(p.name)}${p.id===s.you?' (you)':''}${p.id===s.hostId?' ♛':''}<small>${s.mode==='team'?['Coral','Mint'][p.team]:'Individual competitor'}</small></span><b>${p.score}</b></div>`).join('')}<p class="note">${s.players.length}/24 players · Host controls round progression. Stay in this tab to keep your host controls.</p></aside></div>`;
 if($('#guess')){$('#guess').onsubmit=async e=>{e.preventDefault();const value=e.target.elements.guess.value;e.target.querySelector('button').disabled=true;try{const b=await api('guess',{guess:value});message(b.message);if($('#guess'))$('#guess').reset();}catch(e){message(e.message);}finally{if($('#guess button')&&me.attempts<5)$('#guess button').disabled=false;}};if(draft!==null){$('#guess input').value=draft;$('#guess input').focus();}}
 const top=$('#game .game-top');
 if(top){const inviteButton=document.createElement('button');inviteButton.className='secondary';inviteButton.textContent='Invite a friend ↗';inviteButton.onclick=showInvite;top.appendChild(inviteButton);const panel=document.createElement('div');panel.id='invite';panel.className='panel';panel.hidden=true;top.after(panel);}
 tick();}
function tick(){if($('#timer'))$('#timer').textContent=state.endsAt?Math.max(0,Math.ceil((state.endsAt-Date.now())/1000))+'s':'REVEALED';}setInterval(tick,250);if(session)connect();



