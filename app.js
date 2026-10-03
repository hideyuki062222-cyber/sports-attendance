const sb=supabase.createClient('https://eqzpoplauarzeclhcjwt.supabase.co','sb_publishable_EH3jJho-TELIKMAHN3HHwQ_nUBY7X_3');const joinCode=new URLSearchParams(location.search).get('join')||'';let user=null,club=null,events=[],cursor=new Date(),playerRows=[],responses=[],teamGroups=[],playerTeamLinks=[],eventTeamLinks=[],appRole='guardian',signupMode=localStorage.getItem('signupMode')||'',currentFormationEvent=null,currentFormationDate='',formationCurrentType='4-4-2',formationAssignments={},formationCoords={},formationSelectedPlayer='',formationAdjustMode=false;const $=id=>document.getElementById(id);const msg=(id,t)=>$(id).textContent=t;async function boot(){const {data}=await sb.auth.getSession();user=data.session?.user||null;if(joinCode){await showTeamJoin();return}if(!user)return;await enter()}async function enter(){ $('auth').classList.add('hidden');const {data:owned}=await sb.from('clubs').select('*').eq('created_by',user.id).limit(1);let c=owned?.[0],roleHint=c?'admin':null;if(!c){const {data:mc,error:mce}=await sb.functions.invoke('get-my-club',{body:{}});if(!mce&&mc?.club){c=mc.club;roleHint=mc.role}}if(!c){if(signupMode==='guardian'){$('guardianSetup').classList.remove('hidden')}else{$('setup').classList.remove('hidden')}return}club=c;const {data:mem}=await sb.from('club_memberships').select('role').eq('club_id',club.id).eq('user_id',user.id).maybeSingle();appRole=(roleHint==='admin'||club.created_by===user.id||mem?.role==='admin')?'admin':'guardian';$('setup').classList.add('hidden');$('app').classList.remove('hidden');$('clubTitle').textContent=club.name+'｜'+club.sport;$('roleBadge').textContent=appRole==='admin'?'管理者':'選手・保護者';applyRoleUI();await load()}async function load(){const {data}=await sb.from('events').select('*').eq('club_id',club.id).order('event_date');events=data||[];const {data:r}=await sb.from('attendance_responses').select('*');responses=r||[];await loadTeamGroups();await loadEventTeamLinks();await players();await loadVenues();await loadEventTitles();render();checkSystemAdmin()}let authMode='';function showAuthMode(mode){authMode=mode;$('authChoice').classList.add('hidden');$('authForm').classList.remove('hidden');$('authTitle').textContent=mode==='guardian'?'👤 選手・保護者ログイン・登録':'⚙️ 管理者ログイン・登録';$('authHelp').textContent=mode==='guardian'?'初めての方は、管理者から受け取った招待コードを用意して新規登録してください。':'システム管理者から登録されたチーム管理者専用です。';$('signupCurrent').textContent='選手・保護者として新規登録';$('signupCurrent').classList.toggle('hidden',mode!=='guardian');if($('adminLoginNote'))$('adminLoginNote').classList.toggle('hidden',mode!=='admin')}$('chooseGuardian').onclick=()=>showAuthMode('guardian');$('chooseAdmin').onclick=()=>showAuthMode('admin');$('authBack').onclick=()=>{$('authForm').classList.add('hidden');$('authChoice').classList.remove('hidden');if($('adminLoginNote'))$('adminLoginNote').classList.add('hidden');msg('msg','')};$('login').onclick=async()=>{const email=$('email').value.trim();if(!email.includes('@'))return msg('msg','メールアドレスを入力してください。');const {data,error}=await sb.auth.signInWithPassword({email,password:$('password').value});if(error)return msg('msg',error.message);user=data.user;enter()};async function doSignup(mode){signupMode=mode;localStorage.setItem('signupMode',mode);const email=$('email').value.trim(),password=$('password').value;if(!email||password.length<6)return msg('msg','メールアドレスと6文字以上のパスワードを入力してください。');if(mode==='guardian'){const code=prompt('管理者から受け取った招待コードを入力してください');if(code===null)return;if(!code.trim())return msg('msg','招待コードを入力してください。');msg('msg','登録しています…');const {data,error}=await sb.functions.invoke('register-guardian',{body:{email,password,code:code.trim()}});if(error||data?.error){let t=data?.error||error?.message||'登録できませんでした。';try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{}return msg('msg',t)}const login=await sb.auth.signInWithPassword({email,password});if(login.error)return msg('msg','登録できました。もう一度ログインしてください。');user=login.data.user;localStorage.removeItem('signupMode');msg('msg','✓ 登録できました！');return enter()}const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:'https://hideyuki062222-cyber.github.io/sports-attendance/'}});if(error)return msg('msg',error.message==='email rate limit exceeded'?'現在、管理者登録メールの送信上限に達しています。時間をおいてお試しください。':error.message);msg('msg','管理者登録しました。クラブを作成してください。');if(data.session){user=data.user;enter()}}$('signupCurrent').onclick=()=>doSignup('guardian');$('logout').onclick=async()=>{const b=$('logout');b.disabled=true;b.textContent='ログアウト中…';localStorage.removeItem('signupMode');try{const {error}=await sb.auth.signOut({scope:'local'});if(error)console.error('logout',error)}catch(e){console.error('logout',e)}finally{localStorage.removeItem('sb-eqzpoplauarzeclhcjwt-auth-token');user=null;club=null;events=[];responses=[];playerRows=[];window.location.replace('https://hideyuki062222-cyber.github.io/sports-attendance/')}};$('createClub').onclick=async()=>{const {data,error}=await sb.from('clubs').insert({name:$('clubName').value.trim(),sport:$('sport').value,created_by:user.id}).select().single();if(error)return alert(error.message);await sb.from('club_memberships').insert({club_id:data.id,user_id:user.id,role:'admin'});club=data;enter()};if($('renameClub'))$('renameClub').onclick=async()=>{if(!club||appRole!=='admin')return;const n=prompt('新しいチーム名を入力してください',club.name||'');if(n===null)return;const name=n.trim();if(!name)return alert('チーム名を入力してください。');if(name===club.name)return;const {data,error}=await sb.from('clubs').update({name}).eq('id',club.id).eq('created_by',user.id).select('id,name,sport,created_by').single();if(error)return alert('チーム名を変更できませんでした：'+error.message);club={...club,...data};$('clubTitle').textContent=club.name+'｜'+club.sport;showToast('✓ チーム名を変更しました')};document.querySelectorAll('nav button').forEach(b=>b.onclick=async()=>{document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));$(b.dataset.tab).classList.remove('hidden');b.classList.add('active');if(b.dataset.tab==='members'){await players();await loadMemberOnboarding()}});$('saveEvent').onclick=async()=>{if(!$('eventDate').value||!$('eventTitle').value.trim())return msg('eventMsg','日付と予定名を入力してください。');const body={club_id:club.id,event_date:$('eventDate').value,event_type:$('eventType').value,title:$('eventTitle').value.trim(),place:$('place').value,meeting_time:$('meet').value||null,end_time:$('end').value||null,notes:$('notes').value,created_by:user.id,updated_at:new Date().toISOString()},id=$('editingEventId').value,groupIds=selectedGroupIds('eventTeamGroups');const q=id?sb.from('events').update(body).eq('id',id).select('id').single():sb.from('events').insert(body).select('id').single();const {data:saved,error}=await q;if(error)return msg('eventMsg',error.message);const eventId=saved?.id||id;const del=await sb.from('event_team_groups').delete().eq('event_id',eventId);if(del.error)return msg('eventMsg','予定は保存されましたが、対象チームの更新に失敗しました：'+del.error.message);if(groupIds.length){const ins=await sb.from('event_team_groups').insert(groupIds.map(team_group_id=>({event_id:eventId,team_group_id})));if(ins.error)return msg('eventMsg','予定は保存されましたが、対象チームの更新に失敗しました：'+ins.error.message)}msg('eventMsg',id?'✓ 予定を更新しました！':'✓ 予定を保存しました！');resetEventForm();await load()};$('categorySelect').onchange=()=>{$('categoryOther').classList.toggle('hidden',$('categorySelect').value!=='その他')};if($('editCategorySelect'))$('editCategorySelect').onchange=()=>{$('editCategoryOther').classList.toggle('hidden',$('editCategorySelect').value!=='その他')};
function selectedGroupIds(id){return [...($(id)?.querySelectorAll('input[type="checkbox"]:checked')||[])].map(x=>x.value)}
function setGroupChecks(id,ids=[]){const set=new Set(ids);$(id)?.querySelectorAll('input[type="checkbox"]').forEach(x=>x.checked=set.has(x.value))}
function playerGroupIds(playerId){return playerTeamLinks.filter(x=>x.player_id===playerId).map(x=>x.team_group_id)}
function eventGroupIds(eventId){return eventTeamLinks.filter(x=>x.event_id===eventId).map(x=>x.team_group_id)}
function groupNames(ids){const set=new Set(ids);return teamGroups.filter(g=>set.has(g.id)).map(g=>g.name)}
function eventGroupLabel(e){const names=groupNames(eventGroupIds(e.id));return names.length?names.join('・'):'全体'}
function playerGroupLabel(p){const names=groupNames(playerGroupIds(p.id));return names.length?names.join('・'):'所属チーム未設定'}
function renderGroupChecks(id,selected=[]){const el=$(id);if(!el)return;const set=new Set(selected);el.innerHTML=teamGroups.length?teamGroups.map(g=>'<label class="teamGroupCheck"><input type="checkbox" value="'+g.id+'" '+(set.has(g.id)?'checked':'')+'><span>'+esc(g.name)+'</span></label>').join(''):'<p class="muted">所属チームがまだ登録されていません。</p>'}
function renderTeamGroupControls(){renderGroupChecks('newPlayerGroups');renderGroupChecks('eventTeamGroups');const filter=$('memberGroupFilter');if(filter){const cur=filter.value;filter.innerHTML='<option value="">すべて</option>'+teamGroups.map(g=>'<option value="'+g.id+'">'+esc(g.name)+'</option>').join('');filter.value=teamGroups.some(g=>g.id===cur)?cur:''}const list=$('teamGroupList');if(list){list.innerHTML=teamGroups.length?teamGroups.map(g=>'<div class="teamGroupRow"><b>'+esc(g.name)+'</b><button class="small danger deleteTeamGroup" data-id="'+g.id+'">削除</button></div>').join(''):'<p class="muted">まだ所属チームはありません。</p>';document.querySelectorAll('.deleteTeamGroup').forEach(b=>b.onclick=async()=>{const g=teamGroups.find(x=>x.id===b.dataset.id);if(!g||!confirm('「'+g.name+'」を削除しますか？'))return;const {error}=await sb.from('team_groups').delete().eq('id',g.id);if(error)return alert(error.code==='23503'?'このチームはメンバーまたは予定で使用中です。先に所属・対象チームを外してください。':'削除できませんでした：'+error.message);showToast('✓ 所属チームを削除しました');await loadTeamGroups();await players();render()})}}
async function loadTeamGroups(){if(!club)return;const {data,error}=await sb.from('team_groups').select('id,name,sort_order').eq('club_id',club.id).order('sort_order').order('name');if(error){console.error('team groups load',error);teamGroups=[];return}teamGroups=data||[];renderTeamGroupControls()}
async function loadPlayerTeamLinks(){if(!playerRows.length){playerTeamLinks=[];return}const {data,error}=await sb.from('player_team_groups').select('player_id,team_group_id').in('player_id',playerRows.map(p=>p.id));if(error){console.error('player team links load',error);playerTeamLinks=[];return}playerTeamLinks=data||[]}
async function loadEventTeamLinks(){if(!events.length){eventTeamLinks=[];return}const {data,error}=await sb.from('event_team_groups').select('event_id,team_group_id').in('event_id',events.map(e=>e.id));if(error){console.error('event team links load',error);eventTeamLinks=[];return}eventTeamLinks=data||[]}
if($('addTeamGroup'))$('addTeamGroup').onclick=async()=>{const n=$('newTeamGroup').value.trim();if(!n)return alert('チーム名を入力してください。');const {error}=await sb.from('team_groups').insert({club_id:club.id,name:n});if(error){if(error.code==='23505')return alert('そのチーム名はすでに登録されています。');return alert('登録できませんでした：'+error.message)}$('newTeamGroup').value='';await loadTeamGroups();showToast('✓ '+n+' を追加しました')};
if($('memberGroupFilter'))$('memberGroupFilter').onchange=()=>renderPlayerList();function academicYear(d=new Date()){return d.getMonth()>=3?d.getFullYear():d.getFullYear()-1}
function calcAge(ds){if(!ds)return null;const p=String(ds).split('-').map(Number);if(p.length!==3||!p[0])return null;const n=new Date();let a=n.getFullYear()-p[0];if(n.getMonth()+1<p[1]||(n.getMonth()+1===p[1]&&n.getDate()<p[2]))a--;return a>=0?a:null}
const japaneseEras=[
 {name:'令和',base:2018,start:'2019-05-01',end:'9999-12-31'},
 {name:'平成',base:1988,start:'1989-01-08',end:'2019-04-30'},
 {name:'昭和',base:1925,start:'1926-12-25',end:'1989-01-07'},
 {name:'大正',base:1911,start:'1912-07-30',end:'1926-12-24'},
 {name:'明治',base:1867,start:'1868-01-25',end:'1912-07-29'}
];
function isoDateParts(ds){if(!/^\d{4}-\d{2}-\d{2}$/.test(ds||''))return null;const [y,m,d]=ds.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;return{y,m,d}}
function westernToJapanese(ds){const p=isoDateParts(ds);if(!p)return null;const era=japaneseEras.find(e=>ds>=e.start&&ds<=e.end);if(!era)return null;return{era:era.name,year:p.y-era.base,month:p.m,day:p.d}}
function japaneseToISO(eraName,year,month,day){const era=japaneseEras.find(e=>e.name===eraName),y=Number(year),m=Number(month),d=Number(day);if(!era||!Number.isInteger(y)||y<1||!Number.isInteger(m)||m<1||m>12||!Number.isInteger(d)||d<1||d>31)return null;const gy=era.base+y,ds=String(gy).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');if(!isoDateParts(ds)||ds<era.start||ds>era.end)return null;return ds}
function formatJapaneseDate(ds){const j=westernToJapanese(ds);if(!j)return'';return j.era+(j.year===1?'元':j.year)+'年'+j.month+'月'+j.day+'日'}
function formatWesternDate(ds){const p=isoDateParts(ds);return p?p.y+'年'+p.m+'月'+p.d+'日':''}
function formatBirthDateBoth(ds){if(!ds)return'';const w=formatWesternDate(ds),j=formatJapaneseDate(ds);return w+(j?'（'+j+'）':'')}
function syncBirthModeUI(prefix){const mode=$(prefix+'BirthMode')?.value||'western';$(prefix+'WesternBirth')?.classList.toggle('hidden',mode!=='western');$(prefix+'JapaneseBirth')?.classList.toggle('hidden',mode!=='japanese')}
function setBirthInputValue(prefix,canonicalId,ds){const canon=$(canonicalId);if(canon)canon.value=ds||'';const g=$(prefix+'BirthGregorian');if(g)g.value=ds||'';const j=westernToJapanese(ds||'');if(j){if($(prefix+'BirthEra'))$(prefix+'BirthEra').value=j.era;if($(prefix+'BirthEraYear'))$(prefix+'BirthEraYear').value=j.year;if($(prefix+'BirthMonth'))$(prefix+'BirthMonth').value=j.month;if($(prefix+'BirthDay'))$(prefix+'BirthDay').value=j.day}else{if($(prefix+'BirthEraYear'))$(prefix+'BirthEraYear').value='';if($(prefix+'BirthMonth'))$(prefix+'BirthMonth').value='';if($(prefix+'BirthDay'))$(prefix+'BirthDay').value=''}const pv=$(prefix+'BirthPreview');if(pv)pv.textContent=ds?'表示：'+formatBirthDateBoth(ds):''}
function readBirthInput(prefix,canonicalId){const mode=$(prefix+'BirthMode')?.value||'western';let ds='';if(mode==='western'){ds=$(prefix+'BirthGregorian')?.value||'';if(ds&&!isoDateParts(ds))return{error:'生年月日を確認してください。'}}else{const y=$(prefix+'BirthEraYear')?.value||'',m=$(prefix+'BirthMonth')?.value||'',d=$(prefix+'BirthDay')?.value||'';if(!y&&!m&&!d){ds=''}else{ds=japaneseToISO($(prefix+'BirthEra')?.value||'',Number(y),Number(m),Number(d));if(!ds)return{error:'和暦の生年月日を確認してください。'}}}setBirthInputValue(prefix,canonicalId,ds);return{value:ds||null}}
function previewBirthInput(prefix,canonicalId){const r=readBirthInput(prefix,canonicalId);const pv=$(prefix+'BirthPreview');if(r.error&&pv)pv.textContent='入力中：'+r.error.replace('。','')}
function setupBirthInput(prefix,canonicalId){const mode=$(prefix+'BirthMode');if(!mode)return;mode.onchange=()=>{syncBirthModeUI(prefix);previewBirthInput(prefix,canonicalId)};const g=$(prefix+'BirthGregorian');if(g){g.onchange=()=>previewBirthInput(prefix,canonicalId);g.oninput=()=>previewBirthInput(prefix,canonicalId)};[prefix+'BirthEra',prefix+'BirthEraYear',prefix+'BirthMonth',prefix+'BirthDay'].forEach(id=>{const el=$(id);if(el){el.onchange=()=>previewBirthInput(prefix,canonicalId);el.oninput=()=>previewBirthInput(prefix,canonicalId)}});syncBirthModeUI(prefix)}
setupBirthInput('new','birthDate');setupBirthInput('edit','editBirthDate');setupBirthInput('guardian','guardianBirthDate');setupBirthInput('join','joinBirthDate');
function parseMemberCategory(cn){let m;if((m=cn.match(/^小学([1-6])年生$/)))return{member_kind:'student',school_stage:'elementary',grade_base:Number(m[1]),grade_base_academic_year:academicYear()};if((m=cn.match(/^中学([1-3])年生$/)))return{member_kind:'student',school_stage:'junior_high',grade_base:Number(m[1]),grade_base_academic_year:academicYear()};if((m=cn.match(/^高校([1-3])年生$/)))return{member_kind:'student',school_stage:'high_school',grade_base:Number(m[1]),grade_base_academic_year:academicYear()};if((m=cn.match(/^大学([1-4])年生$/)))return{member_kind:'student',school_stage:'university',grade_base:Number(m[1]),grade_base_academic_year:academicYear()};if((m=cn.match(/^専門学校([1-9])年生$/)))return{member_kind:'student',school_stage:'vocational',grade_base:Number(m[1]),grade_base_academic_year:academicYear()};if(cn==='社会人')return{member_kind:'adult',school_stage:null,grade_base:null,grade_base_academic_year:null};return{member_kind:'other',school_stage:null,grade_base:null,grade_base_academic_year:null}}
function currentGradeLabel(p){if(p.member_kind!=='student'||!p.school_stage||!p.grade_base||!p.grade_base_academic_year)return p.categories?.name||'区分未設定';let g=Number(p.grade_base)+(academicYear()-Number(p.grade_base_academic_year));if(p.school_stage==='vocational')return '専門学校'+Math.max(1,g)+'年生';if(p.school_stage==='other_student')return '学生'+Math.max(1,g)+'年生';const stages=[['elementary','小学',6],['junior_high','中学',3],['high_school','高校',3],['university','大学',4]];let i=stages.findIndex(x=>x[0]===p.school_stage);if(i<0)return p.categories?.name||'学生';while(i<stages.length&&g>stages[i][2]){g-=stages[i][2];i++}if(i>=stages.length)return'卒業後';return stages[i][1]+Math.max(1,g)+'年生'}
async function ensureCategory(cn){let {data:c,error}=await sb.from('categories').select('id').eq('club_id',club.id).eq('name',cn).maybeSingle();if(error)return{error};if(!c){const r=await sb.from('categories').insert({club_id:club.id,name:cn}).select('id').single();if(r.error)return{error:r.error};c=r.data}return{data:c}}
async function syncStudentCategories(rows){if(appRole!=='admin')return rows;for(const p of rows){const label=currentGradeLabel(p);if(p.member_kind==='student'&&label&&label!=='卒業後'&&label!==p.categories?.name){const r=await ensureCategory(label);if(r.data){const u=await sb.from('players').update({category_id:r.data.id}).eq('id',p.id);if(!u.error){p.category_id=r.data.id;p.categories={name:label}}}}}return rows}
$('addPlayer').onclick=async()=>{const br=readBirthInput('new','birthDate');if(br.error)return msg('playerMsg',br.error);const n=$('playerName').value.trim(),cn=$('categorySelect').value==='その他'?$('categoryOther').value.trim():$('categorySelect').value,birth=br.value,groupIds=selectedGroupIds('newPlayerGroups');if(!n)return msg('playerMsg','選手名を入力してください。');if(!cn)return msg('playerMsg','区分・学年を入力してください。');msg('playerMsg','登録しています…');const cr=await ensureCategory(cn);if(cr.error)return msg('playerMsg','区分登録エラー：'+cr.error.message);const cid=cr.data.id;const existing=playerRows.find(p=>p.name.trim().replace(/\s+/g,' ')===n.replace(/\s+/g,' ')&&p.category_id===cid);if(existing){msg('playerMsg','ℹ️ '+n+' はすでに '+cn+' に登録されています。');await players();return}const info=parseMemberCategory(cn);const {data:newPlayer,error}=await sb.from('players').insert({club_id:club.id,name:n,category_id:cid,birth_date:birth,...info}).select('id,name,category_id,birth_date,member_kind,school_stage,grade_base,grade_base_academic_year').single();if(error){if(error.code==='23505'){msg('playerMsg','ℹ️ '+n+' はすでに '+cn+' に登録されています。');await players();return}return msg('playerMsg','メンバー登録エラー：'+error.message)}if(!newPlayer)return msg('playerMsg','メンバーを保存できませんでした。もう一度お試しください。');if(groupIds.length){const link=await sb.from('player_team_groups').insert(groupIds.map(team_group_id=>({player_id:newPlayer.id,team_group_id})));if(link.error){await sb.from('players').delete().eq('id',newPlayer.id);return msg('playerMsg','所属チームの登録に失敗しました：'+link.error.message)}}$('playerName').value='';setBirthInputValue('new','birthDate','');$('categoryOther').value='';setGroupChecks('newPlayerGroups',[]);msg('playerMsg','✅ '+n+' を登録しました！');await players()};
function renderPlayerList(){if(!$('playerList'))return;const filter=$('memberGroupFilter')?.value||'',rows=filter?playerRows.filter(p=>playerGroupIds(p.id).includes(filter)):playerRows;$('playerList').innerHTML=rows.map(p=>{const age=calcAge(p.birth_date),label=currentGradeLabel(p),meta=label+(age!==null?'・'+age+'歳':'');return '<div class="person"><div><b>'+esc(p.name)+'</b><div class="muted">'+esc(meta)+'</div><div class="teamBadges">'+groupNames(playerGroupIds(p.id)).map(n=>'<span>'+esc(n)+'</span>').join('')+(playerGroupIds(p.id).length?'':'<span class="empty">未設定</span>')+'</div>'+(p.birth_date?'<div class="muted">生年月日 '+esc(formatBirthDateBoth(p.birth_date))+'</div>':'')+'</div>'+(appRole==='admin'?'<div class="personActions"><button class="small editPlayer" data-id="'+p.id+'">編集</button><button class="small danger deletePlayer" data-id="'+p.id+'">削除</button></div>':'')+'</div>'}).join('')||'<p class="muted">該当するメンバーはいません。</p>';if(appRole==='admin')bindPlayerActions()}
async function players(){if(!club)return;const {data,error}=await sb.from('players').select('id,name,category_id,birth_date,member_kind,school_stage,grade_base,grade_base_academic_year,categories(name)').eq('club_id',club.id).eq('active',true).order('name');if(error){console.error('players load',error);if($('playerMsg'))msg('playerMsg','メンバー一覧の読み込みエラー：'+error.message);return}playerRows=await syncStudentCategories(data||[]);await loadPlayerTeamLinks();renderPlayerList();if($('replyPlayer'))$('replyPlayer').innerHTML='<option value="">選手を選択</option>'+playerRows.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');if($('invitePlayer'))$('invitePlayer').innerHTML='<option value="">選手を選択</option>'+playerRows.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');if(appRole==='admin')loadResetGuardianRecipients();if(appRole==='guardian'){const cp=$('childPicker');const prior=$('replyPlayer')?.value;cp.innerHTML=playerRows.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');if(playerRows.length){const keep=playerRows.some(p=>p.id===prior)?prior:playerRows[0].id;$('replyPlayer').value=cp.value=keep}else cp.innerHTML='<option value="">連携された選手がいません</option>';renderGuardianPlayerProfile()}}
function eventVisibleForPlayer(e,pid){const targets=eventGroupIds(e.id);if(!targets.length||appRole==='admin'||!pid)return true;const mine=playerGroupIds(pid);return targets.some(x=>mine.includes(x))}
function visibleEvents(){const pid=appRole==='guardian'?$('replyPlayer')?.value:'';return events.filter(e=>eventVisibleForPlayer(e,pid))}
function focusJump(el,offset=18){if(!el)return;const go=()=>{const y=Math.max(0,el.getBoundingClientRect().top+window.pageYOffset-offset);window.scrollTo(0,y);el.classList.add('jumpFocus')};go();setTimeout(go,80);setTimeout(go,220);setTimeout(()=>el.classList.remove('jumpFocus'),1400)}
function scrollMonthEventToDate(ds){setTimeout(()=>{const el=document.querySelector('.monthEventItem[data-date="'+ds+'"]');if(el)focusJump(el,18)},0)}
function renderMonthEventList(y,m,sel){if(!$('monthEventList'))return;const prefix=y+'-'+String(m+1).padStart(2,'0')+'-',wd=['日','月','火','水','木','金','土'];const rows=visibleEvents().filter(e=>e.event_date?.startsWith(prefix)).slice().sort((a,b)=>(a.event_date+(a.meeting_time||'')).localeCompare(b.event_date+(b.meeting_time||'')));if(!rows.length){$('monthEventList').innerHTML='<p class="muted monthNoEvents">この月の予定はありません。</p>';return}$('monthEventList').innerHTML=rows.map(e=>{const p=e.event_date.split('-').map(Number),d=new Date(p[0],p[1]-1,p[2]),dateText=p[1]+'/'+p[2]+'（'+wd[d.getDay()]+'）',time=(e.meeting_time||'').slice(0,5),answer=appRole==='guardian'&&$('replyPlayer')?.value?responses.find(r=>r.event_id===e.id&&r.player_id===$('replyPlayer').value)?.status:'';return '<button class="monthEventItem '+(sel===e.event_date?'selected':'')+'" data-date="'+e.event_date+'" data-event="'+e.id+'"><span class="monthEventDate">'+esc(dateText)+'</span><span class="monthEventMain"><b>'+esc(e.event_type)+'｜'+esc(e.title)+'</b><small>対象：'+esc(eventGroupLabel(e))+'　'+esc(e.place||'場所未設定')+(time?'　'+esc(time)+'〜':'')+(answer?'　回答：'+esc(answer):'')+'</small></span><span class="monthEventArrow">›</span></button>'}).join('');document.querySelectorAll('.monthEventItem').forEach(b=>b.onclick=()=>{const ds=b.dataset.date,eventId=b.dataset.event;render(ds);setTimeout(()=>{const card=document.querySelector('.eventCard[data-event="'+eventId+'"]')||$('dayEvents');focusJump(card,18)},0)})}
function render(sel){const y=cursor.getFullYear(),m=cursor.getMonth(),ve=visibleEvents();$('month').textContent=y+'年 '+(m+1)+'月';const first=new Date(y,m,1),last=new Date(y,m+1,0);let h='';for(let i=0;i<first.getDay();i++)h+='<div></div>';for(let d=1;d<=last.getDate();d++){const ds=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),dayEvents=ve.filter(e=>e.event_date===ds),has=dayEvents.length>0;let state='';if(appRole==='guardian'&&$('replyPlayer')?.value&&has){const pid=$('replyPlayer').value,answers=dayEvents.map(e=>responses.find(r=>r.event_id===e.id&&r.player_id===pid)?.status).filter(Boolean);if(answers.length)state=answers[0]}h+='<div class="day '+(has?'eventday ':'')+(state?'answer-'+state+' ':'')+(sel===ds?'selected':'')+'" data-date="'+ds+'" data-has-event="'+(has?'1':'0')+'">'+d+(has?'<span class="dot">'+(state?({'出席':'○','欠席':'×','遅刻':'遅','早退':'早','未定':'△'}[state]):'●')+'</span>':'')+'</div>'}$('days').innerHTML=h;document.querySelectorAll('.day').forEach(x=>x.onclick=()=>{const ds=x.dataset.date,has=x.dataset.hasEvent==='1';render(ds);if(has)scrollMonthEventToDate(ds);else setTimeout(()=>focusJump($('dayEvents'),18),0)});renderMonthEventList(y,m,sel);if(sel)showDay(sel)}
function showDay(ds){const es=visibleEvents().filter(e=>e.event_date===ds);$('dayEvents').innerHTML=es.length?'<h3>'+ds+' の予定</h3>'+es.map(e=>'<div class="eventCard" data-event="'+e.id+'"><b>'+esc(e.event_type)+'｜'+esc(e.title)+'</b><div class="eventGroupTag">対象：'+esc(eventGroupLabel(e))+'</div>'+(appRole==='admin'?'<button class="small formationEvent" data-id="'+e.id+'">'+formationActionLabel()+'</button><button class="small secondary duplicateEvent" data-id="'+e.id+'">予定を複製</button><button class="small secondary editEvent" data-id="'+e.id+'">予定を編集</button><button class="small danger deleteEvent" data-id="'+e.id+'">予定を削除</button>':'')+'<div>'+esc(e.place||'場所未設定')+'　'+esc((e.meeting_time||'').slice(0,5))+'〜'+esc((e.end_time||'').slice(0,5))+'</div><div class="muted">'+esc(e.notes||'')+'</div>'+attendanceSummary(e)+'</div>').join(''):'<p class="muted">この日の予定はありません。</p>';bindAttendance();bindEventEdits();bindFormationButtons()}
const formationSchemas={
 '4-4-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:70},{key:'DF2',label:'DF',x:38,y:70},{key:'DF3',label:'DF',x:62,y:70},{key:'DF4',label:'DF',x:86,y:70},
  {key:'MF1',label:'MF',x:14,y:45},{key:'MF2',label:'MF',x:38,y:45},{key:'MF3',label:'MF',x:62,y:45},{key:'MF4',label:'MF',x:86,y:45},
  {key:'FW1',label:'FW',x:35,y:18},{key:'FW2',label:'FW',x:65,y:18}
 ],
 '4-3-3':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:70},{key:'DF2',label:'DF',x:38,y:70},{key:'DF3',label:'DF',x:62,y:70},{key:'DF4',label:'DF',x:86,y:70},
  {key:'MF1',label:'MF',x:25,y:46},{key:'MF2',label:'MF',x:50,y:46},{key:'MF3',label:'MF',x:75,y:46},
  {key:'FW1',label:'FW',x:18,y:18},{key:'FW2',label:'FW',x:50,y:18},{key:'FW3',label:'FW',x:82,y:18}
 ],
 '4-2-3-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:72},{key:'DF2',label:'DF',x:38,y:72},{key:'DF3',label:'DF',x:62,y:72},{key:'DF4',label:'DF',x:86,y:72},
  {key:'DM1',label:'DM',x:38,y:56},{key:'DM2',label:'DM',x:62,y:56},
  {key:'AM1',label:'AM',x:18,y:37},{key:'AM2',label:'AM',x:50,y:37},{key:'AM3',label:'AM',x:82,y:37},
  {key:'FW1',label:'FW',x:50,y:16}
 ],
 '4-1-4-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:72},{key:'DF2',label:'DF',x:38,y:72},{key:'DF3',label:'DF',x:62,y:72},{key:'DF4',label:'DF',x:86,y:72},
  {key:'DM1',label:'DM',x:50,y:56},
  {key:'MF1',label:'MF',x:14,y:39},{key:'MF2',label:'MF',x:38,y:39},{key:'MF3',label:'MF',x:62,y:39},{key:'MF4',label:'MF',x:86,y:39},
  {key:'FW1',label:'FW',x:50,y:16}
 ],
 '4-1-2-3':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:72},{key:'DF2',label:'DF',x:38,y:72},{key:'DF3',label:'DF',x:62,y:72},{key:'DF4',label:'DF',x:86,y:72},
  {key:'DM1',label:'DM',x:50,y:56},
  {key:'CM1',label:'CM',x:35,y:40},{key:'CM2',label:'CM',x:65,y:40},
  {key:'FW1',label:'FW',x:18,y:17},{key:'FW2',label:'FW',x:50,y:14},{key:'FW3',label:'FW',x:82,y:17}
 ],
 '4-3-1-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:72},{key:'DF2',label:'DF',x:38,y:72},{key:'DF3',label:'DF',x:62,y:72},{key:'DF4',label:'DF',x:86,y:72},
  {key:'MF1',label:'MF',x:22,y:49},{key:'MF2',label:'MF',x:50,y:52},{key:'MF3',label:'MF',x:78,y:49},
  {key:'AM1',label:'AM',x:50,y:34},
  {key:'FW1',label:'FW',x:34,y:15},{key:'FW2',label:'FW',x:66,y:15}
 ],
 '4-3-2-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:72},{key:'DF2',label:'DF',x:38,y:72},{key:'DF3',label:'DF',x:62,y:72},{key:'DF4',label:'DF',x:86,y:72},
  {key:'MF1',label:'MF',x:22,y:51},{key:'MF2',label:'MF',x:50,y:53},{key:'MF3',label:'MF',x:78,y:51},
  {key:'AM1',label:'AM',x:35,y:32},{key:'AM2',label:'AM',x:65,y:32},
  {key:'FW1',label:'FW',x:50,y:14}
 ],
 '4-5-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:14,y:72},{key:'DF2',label:'DF',x:38,y:72},{key:'DF3',label:'DF',x:62,y:72},{key:'DF4',label:'DF',x:86,y:72},
  {key:'MF1',label:'MF',x:10,y:43},{key:'MF2',label:'MF',x:30,y:43},{key:'MF3',label:'MF',x:50,y:43},{key:'MF4',label:'MF',x:70,y:43},{key:'MF5',label:'MF',x:90,y:43},
  {key:'FW1',label:'FW',x:50,y:16}
 ],
 '3-4-3':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:70},{key:'DF2',label:'DF',x:50,y:70},{key:'DF3',label:'DF',x:76,y:70},
  {key:'MF1',label:'MF',x:12,y:45},{key:'MF2',label:'MF',x:38,y:45},{key:'MF3',label:'MF',x:62,y:45},{key:'MF4',label:'MF',x:88,y:45},
  {key:'FW1',label:'FW',x:18,y:18},{key:'FW2',label:'FW',x:50,y:18},{key:'FW3',label:'FW',x:82,y:18}
 ],
 '3-5-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:70},{key:'DF2',label:'DF',x:50,y:70},{key:'DF3',label:'DF',x:76,y:70},
  {key:'MF1',label:'MF',x:10,y:45},{key:'MF2',label:'MF',x:30,y:45},{key:'MF3',label:'MF',x:50,y:45},{key:'MF4',label:'MF',x:70,y:45},{key:'MF5',label:'MF',x:90,y:45},
  {key:'FW1',label:'FW',x:35,y:18},{key:'FW2',label:'FW',x:65,y:18}
 ],
 '3-4-1-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:72},{key:'DF2',label:'DF',x:50,y:72},{key:'DF3',label:'DF',x:76,y:72},
  {key:'MF1',label:'MF',x:12,y:48},{key:'MF2',label:'MF',x:38,y:48},{key:'MF3',label:'MF',x:62,y:48},{key:'MF4',label:'MF',x:88,y:48},
  {key:'AM1',label:'AM',x:50,y:32},
  {key:'FW1',label:'FW',x:35,y:14},{key:'FW2',label:'FW',x:65,y:14}
 ],
 '3-4-2-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:72},{key:'DF2',label:'DF',x:50,y:72},{key:'DF3',label:'DF',x:76,y:72},
  {key:'MF1',label:'MF',x:12,y:48},{key:'MF2',label:'MF',x:38,y:48},{key:'MF3',label:'MF',x:62,y:48},{key:'MF4',label:'MF',x:88,y:48},
  {key:'AM1',label:'AM',x:35,y:30},{key:'AM2',label:'AM',x:65,y:30},
  {key:'FW1',label:'FW',x:50,y:13}
 ],
 '3-1-4-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:73},{key:'DF2',label:'DF',x:50,y:73},{key:'DF3',label:'DF',x:76,y:73},
  {key:'DM1',label:'DM',x:50,y:58},
  {key:'MF1',label:'MF',x:12,y:41},{key:'MF2',label:'MF',x:38,y:41},{key:'MF3',label:'MF',x:62,y:41},{key:'MF4',label:'MF',x:88,y:41},
  {key:'FW1',label:'FW',x:35,y:16},{key:'FW2',label:'FW',x:65,y:16}
 ],
 '5-3-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:10,y:70},{key:'DF2',label:'DF',x:30,y:70},{key:'DF3',label:'DF',x:50,y:70},{key:'DF4',label:'DF',x:70,y:70},{key:'DF5',label:'DF',x:90,y:70},
  {key:'MF1',label:'MF',x:25,y:44},{key:'MF2',label:'MF',x:50,y:44},{key:'MF3',label:'MF',x:75,y:44},
  {key:'FW1',label:'FW',x:35,y:18},{key:'FW2',label:'FW',x:65,y:18}
 ],
 '5-4-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:9,y:71},{key:'DF2',label:'DF',x:29,y:71},{key:'DF3',label:'DF',x:50,y:71},{key:'DF4',label:'DF',x:71,y:71},{key:'DF5',label:'DF',x:91,y:71},
  {key:'MF1',label:'MF',x:14,y:43},{key:'MF2',label:'MF',x:38,y:43},{key:'MF3',label:'MF',x:62,y:43},{key:'MF4',label:'MF',x:86,y:43},
  {key:'FW1',label:'FW',x:50,y:16}
 ],
 '5-2-3':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:9,y:72},{key:'DF2',label:'DF',x:29,y:72},{key:'DF3',label:'DF',x:50,y:72},{key:'DF4',label:'DF',x:71,y:72},{key:'DF5',label:'DF',x:91,y:72},
  {key:'MF1',label:'MF',x:37,y:45},{key:'MF2',label:'MF',x:63,y:45},
  {key:'FW1',label:'FW',x:18,y:17},{key:'FW2',label:'FW',x:50,y:14},{key:'FW3',label:'FW',x:82,y:17}
 ],
 '3-3-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:68},{key:'DF2',label:'DF',x:50,y:68},{key:'DF3',label:'DF',x:76,y:68},
  {key:'MF1',label:'MF',x:24,y:43},{key:'MF2',label:'MF',x:50,y:43},{key:'MF3',label:'MF',x:76,y:43},
  {key:'FW1',label:'FW',x:50,y:18}
 ],
 '2-3-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:35,y:68},{key:'DF2',label:'DF',x:65,y:68},
  {key:'MF1',label:'MF',x:22,y:43},{key:'MF2',label:'MF',x:50,y:43},{key:'MF3',label:'MF',x:78,y:43},
  {key:'FW1',label:'FW',x:35,y:18},{key:'FW2',label:'FW',x:65,y:18}
 ],
 '3-2-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:68},{key:'DF2',label:'DF',x:50,y:68},{key:'DF3',label:'DF',x:76,y:68},
  {key:'MF1',label:'MF',x:36,y:43},{key:'MF2',label:'MF',x:64,y:43},
  {key:'FW1',label:'FW',x:35,y:18},{key:'FW2',label:'FW',x:65,y:18}
 ],
 '2-4-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:35,y:68},{key:'DF2',label:'DF',x:65,y:68},
  {key:'MF1',label:'MF',x:12,y:43},{key:'MF2',label:'MF',x:38,y:43},{key:'MF3',label:'MF',x:62,y:43},{key:'MF4',label:'MF',x:88,y:43},
  {key:'FW1',label:'FW',x:50,y:18}
 ],
 '3-1-3':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:24,y:68},{key:'DF2',label:'DF',x:50,y:68},{key:'DF3',label:'DF',x:76,y:68},
  {key:'MF1',label:'MF',x:50,y:44},
  {key:'FW1',label:'FW',x:20,y:18},{key:'FW2',label:'FW',x:50,y:15},{key:'FW3',label:'FW',x:80,y:18}
 ],
 '2-2-3':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'DF1',label:'DF',x:35,y:68},{key:'DF2',label:'DF',x:65,y:68},
  {key:'MF1',label:'MF',x:36,y:43},{key:'MF2',label:'MF',x:64,y:43},
  {key:'FW1',label:'FW',x:20,y:18},{key:'FW2',label:'FW',x:50,y:15},{key:'FW3',label:'FW',x:80,y:18}
 ],
 '1-2-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'FIXO',label:'FIXO',x:50,y:68},
  {key:'ALA1',label:'ALA',x:25,y:44},{key:'ALA2',label:'ALA',x:75,y:44},
  {key:'PIVO',label:'PIVO',x:50,y:18}
 ],
 '2-2':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'BACK1',label:'BACK',x:30,y:62},{key:'BACK2',label:'BACK',x:70,y:62},
  {key:'FRONT1',label:'FRONT',x:30,y:25},{key:'FRONT2',label:'FRONT',x:70,y:25}
 ],
 '3-1':[
  {key:'GK',label:'GK',x:50,y:90},
  {key:'ALA1',label:'ALA',x:22,y:55},{key:'FIXO',label:'FIXO',x:50,y:62},{key:'ALA2',label:'ALA',x:78,y:55},
  {key:'PIVO',label:'PIVO',x:50,y:18}
 ]
};

Object.assign(formationSchemas,{
 'volley-6-basic':[
  {key:'V4',label:'前衛左',x:20,y:32},{key:'V3',label:'前衛中',x:50,y:32},{key:'V2',label:'前衛右',x:80,y:32},
  {key:'V5',label:'後衛左',x:20,y:74},{key:'V6',label:'後衛中',x:50,y:74},{key:'V1',label:'後衛右',x:80,y:74}
 ],
 'volley-6-receive-w':[
  {key:'V4',label:'前衛左',x:18,y:28},{key:'V3',label:'前衛中',x:50,y:24},{key:'V2',label:'前衛右',x:82,y:28},
  {key:'V5',label:'レシーブ',x:24,y:68},{key:'V6',label:'レシーブ',x:50,y:80},{key:'V1',label:'レシーブ',x:76,y:68}
 ],
 'volley-6-receive-3':[
  {key:'V4',label:'前衛左',x:18,y:28},{key:'V3',label:'前衛中',x:50,y:25},{key:'V2',label:'前衛右',x:82,y:28},
  {key:'V5',label:'レシーブ',x:22,y:72},{key:'V6',label:'レシーブ',x:50,y:72},{key:'V1',label:'レシーブ',x:78,y:72}
 ],
 'volley-9-basic':[
  {key:'VF1',label:'前衛左',x:20,y:25},{key:'VF2',label:'前衛中',x:50,y:25},{key:'VF3',label:'前衛右',x:80,y:25},
  {key:'VM1',label:'中衛左',x:20,y:50},{key:'VM2',label:'中衛中',x:50,y:50},{key:'VM3',label:'中衛右',x:80,y:50},
  {key:'VB1',label:'後衛左',x:20,y:78},{key:'VB2',label:'後衛中',x:50,y:78},{key:'VB3',label:'後衛右',x:80,y:78}
 ],
 'basket-positions':[
  {key:'PG',label:'PG',x:50,y:78},{key:'SG',label:'SG',x:20,y:58},{key:'SF',label:'SF',x:80,y:58},{key:'PF',label:'PF',x:32,y:28},{key:'C',label:'C',x:68,y:28}
 ],
 'basket-5-out':[
  {key:'P1',label:'トップ',x:50,y:76},{key:'P2',label:'左45°',x:20,y:58},{key:'P3',label:'右45°',x:80,y:58},{key:'P4',label:'左コーナー',x:14,y:25},{key:'P5',label:'右コーナー',x:86,y:25}
 ],
 'basket-4out1in':[
  {key:'P1',label:'トップ',x:50,y:78},{key:'P2',label:'左45°',x:20,y:56},{key:'P3',label:'右45°',x:80,y:56},{key:'P4',label:'コーナー',x:14,y:25},{key:'P5',label:'インサイド',x:60,y:24}
 ],
 'basket-3out2in':[
  {key:'P1',label:'トップ',x:50,y:78},{key:'P2',label:'左ウイング',x:18,y:52},{key:'P3',label:'右ウイング',x:82,y:52},{key:'P4',label:'左インサイド',x:35,y:24},{key:'P5',label:'右インサイド',x:65,y:24}
 ],
 'basket-zone-2-3':[
  {key:'Z1',label:'上左',x:35,y:68},{key:'Z2',label:'上右',x:65,y:68},{key:'Z3',label:'下左',x:18,y:36},{key:'Z4',label:'中央',x:50,y:28},{key:'Z5',label:'下右',x:82,y:36}
 ],
 'basket-zone-3-2':[
  {key:'Z1',label:'上左',x:25,y:66},{key:'Z2',label:'上中',x:50,y:72},{key:'Z3',label:'上右',x:75,y:66},{key:'Z4',label:'下左',x:32,y:30},{key:'Z5',label:'下右',x:68,y:30}
 ],
 'basket-zone-1-2-2':[
  {key:'Z1',label:'トップ',x:50,y:75},{key:'Z2',label:'中左',x:28,y:54},{key:'Z3',label:'中右',x:72,y:54},{key:'Z4',label:'下左',x:28,y:27},{key:'Z5',label:'下右',x:72,y:27}
 ],
 'baseball-defense':[
  {key:'C',label:'C',x:50,y:90},{key:'P',label:'P',x:50,y:62},{key:'1B',label:'1B',x:76,y:58},{key:'2B',label:'2B',x:66,y:42},{key:'SS',label:'SS',x:34,y:42},{key:'3B',label:'3B',x:24,y:58},{key:'LF',label:'LF',x:18,y:24},{key:'CF',label:'CF',x:50,y:12},{key:'RF',label:'RF',x:82,y:24}
 ],
 'baseball-shift-left':[
  {key:'C',label:'C',x:50,y:90},{key:'P',label:'P',x:50,y:62},{key:'1B',label:'1B',x:73,y:56},{key:'2B',label:'2B',x:58,y:43},{key:'SS',label:'SS',x:28,y:42},{key:'3B',label:'3B',x:17,y:58},{key:'LF',label:'LF',x:13,y:24},{key:'CF',label:'CF',x:43,y:12},{key:'RF',label:'RF',x:75,y:25}
 ],
 'baseball-shift-right':[
  {key:'C',label:'C',x:50,y:90},{key:'P',label:'P',x:50,y:62},{key:'1B',label:'1B',x:83,y:58},{key:'2B',label:'2B',x:72,y:42},{key:'SS',label:'SS',x:42,y:43},{key:'3B',label:'3B',x:27,y:56},{key:'LF',label:'LF',x:25,y:25},{key:'CF',label:'CF',x:57,y:12},{key:'RF',label:'RF',x:87,y:24}
 ],
 'tennis-singles':[{key:'T1',label:'選手',x:50,y:72}],
 'tennis-doubles':[{key:'T1',label:'左',x:30,y:72},{key:'T2',label:'右',x:70,y:72}],
 'badminton-singles':[{key:'B1',label:'選手',x:50,y:72}],
 'badminton-doubles':[{key:'B1',label:'左',x:30,y:72},{key:'B2',label:'右',x:70,y:72}],
 'generic-5':[{key:'G1',label:'1',x:50,y:78},{key:'G2',label:'2',x:25,y:55},{key:'G3',label:'3',x:75,y:55},{key:'G4',label:'4',x:30,y:28},{key:'G5',label:'5',x:70,y:28}],
 'generic-6':[{key:'G1',label:'1',x:20,y:70},{key:'G2',label:'2',x:50,y:70},{key:'G3',label:'3',x:80,y:70},{key:'G4',label:'4',x:20,y:30},{key:'G5',label:'5',x:50,y:30},{key:'G6',label:'6',x:80,y:30}],
 'generic-8':[{key:'G1',label:'1',x:18,y:75},{key:'G2',label:'2',x:50,y:75},{key:'G3',label:'3',x:82,y:75},{key:'G4',label:'4',x:28,y:50},{key:'G5',label:'5',x:72,y:50},{key:'G6',label:'6',x:18,y:24},{key:'G7',label:'7',x:50,y:24},{key:'G8',label:'8',x:82,y:24}],
 'generic-11':[{key:'G1',label:'1',x:50,y:88},{key:'G2',label:'2',x:15,y:68},{key:'G3',label:'3',x:38,y:68},{key:'G4',label:'4',x:62,y:68},{key:'G5',label:'5',x:85,y:68},{key:'G6',label:'6',x:18,y:43},{key:'G7',label:'7',x:50,y:43},{key:'G8',label:'8',x:82,y:43},{key:'G9',label:'9',x:20,y:18},{key:'G10',label:'10',x:50,y:14},{key:'G11',label:'11',x:80,y:18}]
});

const sportFormationConfigs={
 'サッカー':{icon:'⚽',heading:'サッカー フォーメーション',action:'⚽ フォーメーション',label:'フォーメーション',pitch:'sport-soccer',defaultType:'4-4-2',guide:'11人制・8人制のフォーメーションを選べます。微調整ONなら各ポジションを自由に動かせます。',groups:[
  {label:'11人制',options:[['4-4-2','4-4-2'],['4-3-3','4-3-3'],['4-2-3-1','4-2-3-1'],['4-1-4-1','4-1-4-1'],['4-1-2-3','4-1-2-3'],['4-3-1-2','4-3-1-2'],['4-3-2-1','4-3-2-1'],['4-5-1','4-5-1'],['3-4-3','3-4-3'],['3-5-2','3-5-2'],['3-4-1-2','3-4-1-2'],['3-4-2-1','3-4-2-1'],['3-1-4-2','3-1-4-2'],['5-3-2','5-3-2'],['5-4-1','5-4-1'],['5-2-3','5-2-3']]},
  {label:'8人制',options:[['3-3-1','3-3-1'],['2-3-2','2-3-2'],['3-2-2','3-2-2'],['2-4-1','2-4-1'],['3-1-3','3-1-3'],['2-2-3','2-2-3']]}
 ]},
 'フットサル':{icon:'⚽',heading:'フットサル フォーメーション',action:'⚽ フォーメーション',label:'フォーメーション',pitch:'sport-futsal',defaultType:'1-2-1',guide:'フットサル用の配置だけを表示します。',groups:[{label:'フットサル',options:[['1-2-1','1-2-1（ダイヤ）'],['2-2','2-2（ボックス）'],['3-1','3-1']]}]},
 'バレーボール':{icon:'🏐',heading:'バレーボール コート配置',action:'🏐 コート配置',label:'配置パターン',pitch:'sport-volleyball',defaultType:'volley-6-basic',guide:'6人制・9人制のコート配置を選べます。選手を登録する前でも位置を調整できます。',groups:[
  {label:'6人制',options:[['volley-6-basic','6人制 基本配置'],['volley-6-receive-w','6人制 サーブレシーブ W型'],['volley-6-receive-3','6人制 サーブレシーブ 3人']]},
  {label:'9人制',options:[['volley-9-basic','9人制 基本配置']]}
 ]},
 'バスケットボール':{icon:'🏀',heading:'バスケットボール コート配置',action:'🏀 コート配置',label:'配置パターン',pitch:'sport-basketball',defaultType:'basket-positions',guide:'ポジション配置・オフェンス配置・ゾーン守備から選べます。',groups:[
  {label:'基本',options:[['basket-positions','PG・SG・SF・PF・C']]},
  {label:'オフェンス',options:[['basket-5-out','5アウト'],['basket-4out1in','4アウト1イン'],['basket-3out2in','3アウト2イン']]},
  {label:'ゾーン守備',options:[['basket-zone-2-3','2-3ゾーン'],['basket-zone-3-2','3-2ゾーン'],['basket-zone-1-2-2','1-2-2ゾーン']]}
 ]},
 '野球':{icon:'⚾',heading:'野球 守備位置',action:'⚾ 守備位置',label:'守備配置',pitch:'sport-baseball',defaultType:'baseball-defense',guide:'出席者から守備位置を組めます。守備シフトも選択・微調整できます。',groups:[{label:'守備',options:[['baseball-defense','基本守備'],['baseball-shift-left','左寄りシフト'],['baseball-shift-right','右寄りシフト']]}]},
 'テニス':{icon:'🎾',heading:'テニス コート配置',action:'🎾 コート配置',label:'種目',pitch:'sport-tennis',defaultType:'tennis-singles',guide:'シングルス・ダブルスの配置を選べます。',groups:[{label:'テニス',options:[['tennis-singles','シングルス'],['tennis-doubles','ダブルス']]}]},
 'バドミントン':{icon:'🏸',heading:'バドミントン コート配置',action:'🏸 コート配置',label:'種目',pitch:'sport-badminton',defaultType:'badminton-singles',guide:'シングルス・ダブルスの配置を選べます。',groups:[{label:'バドミントン',options:[['badminton-singles','シングルス'],['badminton-doubles','ダブルス']]}]},
 'その他':{icon:'📍',heading:'選手配置',action:'📍 選手配置',label:'人数・配置',pitch:'sport-generic',defaultType:'generic-6',guide:'競技に合わせて人数を選び、位置を自由に調整できます。',groups:[{label:'自由配置',options:[['generic-5','5人'],['generic-6','6人'],['generic-8','8人'],['generic-11','11人']]}]}
};
function formationSportConfig(){return sportFormationConfigs[club?.sport]||sportFormationConfigs['その他']}
function formationAllowedTypes(cfg=formationSportConfig()){return cfg.groups.flatMap(g=>g.options.map(o=>o[0]))}
function formationActionLabel(){return formationSportConfig().action}
function populateFormationTypeOptions(preferred){const cfg=formationSportConfig(),sel=$('formationType');if(!sel)return cfg.defaultType;sel.innerHTML=cfg.groups.map(g=>'<optgroup label="'+esc(g.label)+'">'+g.options.map(o=>'<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>').join('')+'</optgroup>').join('');const allowed=formationAllowedTypes(cfg),picked=allowed.includes(preferred)?preferred:cfg.defaultType;sel.value=picked;return picked}
function applyFormationSportUI(preferred){const cfg=formationSportConfig();if($('formationHeading'))$('formationHeading').textContent=cfg.icon+' '+cfg.heading;if($('formationSelectLabel'))$('formationSelectLabel').textContent=cfg.label;if($('formationGuide'))$('formationGuide').textContent=cfg.guide;const pitch=$('formationPitch');if(pitch){pitch.classList.remove('sport-soccer','sport-futsal','sport-volleyball','sport-basketball','sport-baseball','sport-tennis','sport-badminton','sport-generic');pitch.classList.add(cfg.pitch)}return populateFormationTypeOptions(preferred)}

function formationEligiblePlayers(e){if(!e)return[];const targets=eventGroupIds(e.id),eligible=playerRows.filter(p=>(!e.category_id||p.category_id===e.category_id)&&(!targets.length||playerGroupIds(p.id).some(x=>targets.includes(x))));const attending=new Set(responses.filter(r=>r.event_id===e.id&&r.status==='出席').map(r=>r.player_id));return eligible.filter(p=>attending.has(p.id))}
function formationPlayerName(id){return playerRows.find(p=>p.id===id)?.name||'選手'}
function bindFormationButtons(){document.querySelectorAll('.formationEvent').forEach(b=>b.onclick=()=>openFormation(b.dataset.id))}
function formationDefaultCoord(slotKey){const schema=formationSchemas[formationCurrentType]||formationSchemas[formationSportConfig().defaultType]||[];const s=schema.find(x=>x.key===slotKey);return s?{x:s.x,y:s.y}:{x:50,y:50}}
async function openFormation(eventId){if(appRole!=='admin')return;const e=events.find(x=>x.id===eventId);if(!e)return;currentFormationEvent=e;currentFormationDate=e.event_date;formationSelectedPlayer='';formationAdjustMode=false;msg('formationMsg','読み込んでいます…');const [{data:f,error:fe},{data:pos,error:pe}]=await Promise.all([sb.from('event_formations').select('event_id,formation_type,custom_layout').eq('event_id',e.id).maybeSingle(),sb.from('formation_positions').select('slot_key,player_id,x_pct,y_pct').eq('event_id',e.id)]);if(fe||pe){msg('formationMsg','配置を読み込めませんでした。');return}formationCurrentType=applyFormationSportUI(f?.formation_type);const allowed=new Set(formationEligiblePlayers(e).map(p=>p.id)),schema=formationSchemas[formationCurrentType]||formationSchemas[formationSportConfig().defaultType];formationAssignments={};formationCoords={};const savedLayout=(f?.formation_type===formationCurrentType&&f?.custom_layout&&typeof f.custom_layout==='object'&&!Array.isArray(f.custom_layout))?f.custom_layout:{};schema.forEach(slot=>{const c=savedLayout[slot.key];if(c&&Number.isFinite(Number(c.x))&&Number.isFinite(Number(c.y)))formationCoords[slot.key]={x:Math.max(5,Math.min(95,Number(c.x))),y:Math.max(5,Math.min(95,Number(c.y)))}});(pos||[]).forEach(x=>{if(f?.formation_type===formationCurrentType&&allowed.has(x.player_id)&&schema.some(s=>s.key===x.slot_key)){formationAssignments[x.slot_key]=x.player_id;if(!formationCoords[x.slot_key]&&x.x_pct!==null&&x.y_pct!==null)formationCoords[x.slot_key]={x:Number(x.x_pct),y:Number(x.y_pct)}}});$('formationEventInfo').innerHTML='<b>'+esc(e.event_date)+'｜'+esc(e.title)+'</b><div class="muted">'+esc(club?.sport||'スポーツ')+'｜'+esc(e.place||'場所未設定')+'　対象：'+esc(eventGroupLabel(e))+'</div>';document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));$('formation').classList.remove('hidden');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));msg('formationMsg','');updateFormationAdjustUI();renderFormation();setTimeout(()=>focusJump($('formation'),8),0)}
function assignFormationPlayer(slotKey,playerId){if(!currentFormationEvent)return;const allowed=new Set(formationEligiblePlayers(currentFormationEvent).map(p=>p.id));if(!allowed.has(playerId))return;Object.keys(formationAssignments).forEach(k=>{if(formationAssignments[k]===playerId)delete formationAssignments[k]});formationAssignments[slotKey]=playerId;formationSelectedPlayer='';renderFormation()}
function updateFormationAdjustUI(){if(!$('toggleFormationAdjust'))return;$('toggleFormationAdjust').textContent=formationAdjustMode?'↔️ 位置を微調整：ON':'↔️ 位置を微調整：OFF';$('toggleFormationAdjust').classList.toggle('active',formationAdjustMode);$('formationAdjustHelp')?.classList.toggle('hidden',!formationAdjustMode);$('formationPitch')?.classList.toggle('formationAdjustMode',formationAdjustMode)}
function moveFormationSlotFromPointer(b,ev){const pitch=$('formationPitch'),rect=pitch.getBoundingClientRect(),key=b.dataset.slot;if(!formationAdjustMode||!rect.width||!rect.height)return;const offX=Number(b.dataset.dragOffsetX||0),offY=Number(b.dataset.dragOffsetY||0),x=Math.max(5,Math.min(95,((ev.clientX-rect.left-offX)/rect.width)*100)),y=Math.max(5,Math.min(95,((ev.clientY-rect.top-offY)/rect.height)*100));formationCoords[key]={x:Math.round(x*100)/100,y:Math.round(y*100)/100};b.style.left=x+'%';b.style.top=y+'%'}
function renderFormation(){if(!currentFormationEvent)return;const schema=formationSchemas[formationCurrentType]||formationSchemas[formationSportConfig().defaultType],attending=formationEligiblePlayers(currentFormationEvent),assignedIds=new Set(Object.values(formationAssignments));$('formationCount').textContent='出席 '+attending.length+'名｜配置 '+assignedIds.size+'名｜控え '+Math.max(0,attending.length-assignedIds.size)+'名';$('formationPitch').innerHTML=schema.map(slot=>{const pid=formationAssignments[slot.key],name=pid?formationPlayerName(pid):slot.label,coord=formationCoords[slot.key]||{x:slot.x,y:slot.y};return '<button class="formationSlot '+(pid?'occupied':'')+'" data-slot="'+slot.key+'" style="left:'+coord.x+'%;top:'+coord.y+'%" title="'+esc(slot.label)+'">'+(pid?'<span class="formationPlayerName">'+esc(name)+'</span><small>'+esc(slot.label)+'</small>':'<span>'+esc(slot.label)+'</span>')+'</button>'}).join('');const bench=attending.filter(p=>!assignedIds.has(p.id));$('formationBenchList').innerHTML=bench.length?bench.map(p=>'<button class="formationPlayerChip '+(formationSelectedPlayer===p.id?'selected':'')+'" draggable="true" data-player="'+p.id+'">'+esc(p.name)+'</button>').join(''):'<p class="muted">控え選手はいません。</p>';document.querySelectorAll('.formationPlayerChip').forEach(b=>{b.onclick=()=>{formationSelectedPlayer=formationSelectedPlayer===b.dataset.player?'':b.dataset.player;renderFormation()};b.ondragstart=ev=>ev.dataTransfer.setData('text/plain',b.dataset.player)});document.querySelectorAll('.formationSlot').forEach(b=>{b.onclick=()=>{if(b.dataset.justDragged==='1')return;const key=b.dataset.slot;if(formationSelectedPlayer){assignFormationPlayer(key,formationSelectedPlayer)}else if(!formationAdjustMode&&formationAssignments[key]){delete formationAssignments[key];delete formationCoords[key];renderFormation()}};b.ondragover=ev=>ev.preventDefault();b.ondrop=ev=>{ev.preventDefault();const pid=ev.dataTransfer.getData('text/plain');if(pid)assignFormationPlayer(b.dataset.slot,pid)};b.onpointerdown=ev=>{if(!formationAdjustMode)return;ev.preventDefault();const r=b.getBoundingClientRect();b.dataset.dragStartX=String(ev.clientX);b.dataset.dragStartY=String(ev.clientY);b.dataset.dragOffsetX=String(ev.clientX-(r.left+r.width/2));b.dataset.dragOffsetY=String(ev.clientY-(r.top+r.height/2));b.dataset.justDragged='0';try{b.setPointerCapture(ev.pointerId)}catch{}};b.onpointermove=ev=>{if(!formationAdjustMode||!b.hasPointerCapture?.(ev.pointerId))return;const dx=Math.abs(ev.clientX-Number(b.dataset.dragStartX||ev.clientX)),dy=Math.abs(ev.clientY-Number(b.dataset.dragStartY||ev.clientY));if(dx>3||dy>3)b.dataset.justDragged='1';moveFormationSlotFromPointer(b,ev)};b.onpointerup=ev=>{if(!formationAdjustMode)return;moveFormationSlotFromPointer(b,ev);try{b.releasePointerCapture(ev.pointerId)}catch{};if(b.dataset.justDragged==='1')setTimeout(()=>{b.dataset.justDragged='0'},180)}});updateFormationAdjustUI()}
if($('toggleFormationAdjust'))$('toggleFormationAdjust').onclick=()=>{formationAdjustMode=!formationAdjustMode;formationSelectedPlayer='';updateFormationAdjustUI();renderFormation()};
if($('resetFormationPositions'))$('resetFormationPositions').onclick=()=>{if(Object.keys(formationCoords).length&&!confirm('微調整した位置を初期位置に戻しますか？'))return;formationCoords={};renderFormation();msg('formationMsg','位置を初期位置に戻しました。保存すると反映されます。')};
if($('formationType'))$('formationType').onchange=()=>{const next=$('formationType').value;if(next===formationCurrentType)return;if((Object.keys(formationAssignments).length||Object.keys(formationCoords).length)&&!confirm('配置パターンを変更すると現在の配置をリセットします。よろしいですか？')){$('formationType').value=formationCurrentType;return}formationCurrentType=next;formationAssignments={};formationCoords={};formationSelectedPlayer='';formationAdjustMode=false;updateFormationAdjustUI();renderFormation()};
if($('formationBack'))$('formationBack').onclick=()=>{$('formation').classList.add('hidden');$('calendar').classList.remove('hidden');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));document.querySelector('[data-tab="calendar"]')?.classList.add('active');render(currentFormationDate);setTimeout(()=>$('dayEvents')?.scrollIntoView({behavior:'smooth',block:'start'}),50)};
if($('clearFormation'))$('clearFormation').onclick=()=>{if(Object.keys(formationAssignments).length&&!confirm('現在の配置をすべて外しますか？'))return;formationAssignments={};formationCoords={};formationSelectedPlayer='';renderFormation();msg('formationMsg','配置をリセットしました。保存すると反映されます。')};
if($('saveFormation'))$('saveFormation').onclick=async()=>{if(!currentFormationEvent)return;const e=currentFormationEvent,allowed=new Set(formationEligiblePlayers(e).map(p=>p.id)),schema=formationSchemas[formationCurrentType],valid=Object.entries(formationAssignments).filter(([slot,pid])=>allowed.has(pid)&&schema.some(s=>s.key===slot)),layout={};schema.forEach(slot=>{const c=formationCoords[slot.key];if(c)layout[slot.key]={x:Number(c.x),y:Number(c.y)}});msg('formationMsg','保存しています…');const {error:fe}=await sb.from('event_formations').upsert({event_id:e.id,formation_type:formationCurrentType,custom_layout:layout,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'event_id'});if(fe)return msg('formationMsg','保存できませんでした：'+fe.message);const {error:de}=await sb.from('formation_positions').delete().eq('event_id',e.id);if(de)return msg('formationMsg','配置を更新できませんでした：'+de.message);if(valid.length){const rows=valid.map(([slot_key,player_id])=>{const c=formationCoords[slot_key];return{event_id:e.id,slot_key,player_id,x_pct:c?.x??null,y_pct:c?.y??null}});const {error:ie}=await sb.from('formation_positions').insert(rows);if(ie)return msg('formationMsg','配置を保存できませんでした：'+ie.message)}msg('formationMsg','✅ 配置を保存しました！');showToast('✓ 配置を保存しました')};

function attendanceSummary(e){const targets=eventGroupIds(e.id),eligible=playerRows.filter(p=>(!e.category_id||p.category_id===e.category_id)&&(!targets.length||playerGroupIds(p.id).some(x=>targets.includes(x)))),eligibleIds=new Set(eligible.map(p=>p.id)),rr=responses.filter(r=>r.event_id===e.id&&eligibleIds.has(r.player_id)),sts=['出席','欠席','遅刻','早退','未定'];let h='<div class="summary">'+sts.map(st=>'<span>'+st+' '+rr.filter(r=>r.status===st).length+'</span>').join('')+'<span>未回答 '+Math.max(0,eligible.length-rr.length)+'</span></div>'+(appRole==='admin'?'<p class="muted adminAttendanceHelp">📱 携帯を持っていない選手は、管理者がここで出欠を登録できます。</p>':'')+'<details class="attendanceMembers" open><summary>出欠メンバー '+eligible.length+'名</summary>'+eligible.map(p=>{const r=rr.find(x=>x.player_id===p.id);if(appRole==='admin'){return '<div class="memberStatus adminMemberStatus"><b>'+esc(p.name)+'</b><select class="adminAttendanceSelect" data-event="'+e.id+'" data-player="'+p.id+'" aria-label="'+esc(p.name)+'の出欠"><option value="" '+(!r?'selected':'')+'>未回答</option>'+sts.map(st=>'<option value="'+st+'" '+(r?.status===st?'selected':'')+'>'+st+'</option>').join('')+'</select>'+(r?.reason?'<small>'+esc(r.reason)+'</small>':'')+'</div>'}return '<div class="memberStatus"><b>'+esc(p.name)+'</b><span class="statusLabel '+(r?'answer-'+r.status:'')+'">'+esc(r?.status||'未回答')+'</span>'+(r?.reason?'<small>'+esc(r.reason)+'</small>':'')+'</div>'}).join('')+'</details>';const pid=$('replyPlayer')?.value;if(pid&&eligible.some(p=>p.id===pid)){const cur=rr.find(r=>r.player_id===pid);h+='<div class="reply" data-event="'+e.id+'" data-player="'+pid+'"><div class="statusBtns">'+sts.map(st=>'<button class="status '+(cur?.status===st?'chosen':'')+'" data-status="'+st+'">'+st+'</button>').join('')+'</div><textarea class="reason" placeholder="欠席理由・連絡事項">'+esc(cur?.reason||'')+'</textarea></div>'}return h}
function bindAttendance(){document.querySelectorAll('.reply .status').forEach(b=>b.onclick=async()=>{const box=b.closest('.reply'),reason=box.querySelector('.reason').value,status=b.dataset.status;b.closest('.statusBtns').querySelectorAll('.status').forEach(x=>x.classList.remove('chosen'));b.classList.add('chosen');const old=b.textContent;b.textContent='保存中…';b.disabled=true;const {error}=await sb.from('attendance_responses').upsert({event_id:box.dataset.event,player_id:box.dataset.player,status,reason,responded_by:user.id,responded_at:new Date().toISOString()},{onConflict:'event_id,player_id'});b.disabled=false;b.textContent=old;if(error)return alert(error.message);showToast('✓ '+status+'で回答しました');await load()});document.querySelectorAll('.adminAttendanceSelect').forEach(sel=>sel.onchange=async()=>{const eventId=sel.dataset.event,playerId=sel.dataset.player,status=sel.value,oldResponse=responses.find(r=>r.event_id===eventId&&r.player_id===playerId),oldValue=oldResponse?.status||'';sel.disabled=true;let error=null;if(status){const result=await sb.from('attendance_responses').upsert({event_id:eventId,player_id:playerId,status,reason:oldResponse?.reason||'',responded_by:user.id,responded_at:new Date().toISOString()},{onConflict:'event_id,player_id'});error=result.error}else{const result=await sb.from('attendance_responses').delete().eq('event_id',eventId).eq('player_id',playerId);error=result.error}sel.disabled=false;if(error){sel.value=oldValue;return alert('出欠を保存できませんでした：'+error.message)}if(status){const saved={event_id:eventId,player_id:playerId,status,reason:oldResponse?.reason||'',responded_by:user.id,responded_at:new Date().toISOString()};const idx=responses.findIndex(r=>r.event_id===eventId&&r.player_id===playerId);if(idx>=0)responses[idx]={...responses[idx],...saved};else responses.push(saved)}else responses=responses.filter(r=>!(r.event_id===eventId&&r.player_id===playerId));const p=playerRows.find(x=>x.id===playerId);showToast('✓ '+(p?.name||'選手')+'：'+(status||'未回答')+'に変更しました');const selected=document.querySelector('.day.selected')?.dataset.date;render(selected)})}function showToast(t){let x=document.getElementById('toast');if(!x){x=document.createElement('div');x.id='toast';document.body.appendChild(x)}x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}
$('prev').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render()};$('next').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render()};function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}boot();
if($('replyPlayer'))$('replyPlayer').onchange=()=>{const d=document.querySelector('.day.selected')?.dataset.date;render(d)};

async function showTeamJoin(){
  $('auth')?.classList.add('hidden');$('guardianSetup')?.classList.add('hidden');$('setup')?.classList.add('hidden');$('app')?.classList.add('hidden');$('teamJoin')?.classList.remove('hidden');
  msg('teamJoinMsg','');
  const {data,error}=await sb.functions.invoke('team-register',{body:{action:'preview',code:joinCode}});
  if(error||data?.error){
    let t=data?.error||error?.message||'登録用QRコードを確認できませんでした。';
    try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{}
    $('joinClubInfo').innerHTML='<b>登録用QRコードを確認できません</b>';
    msg('teamJoinMsg',t);$('submitTeamJoin').disabled=true;return;
  }
  const c=data.club||{};
  $('joinClubInfo').innerHTML='<b>'+esc(c.name||'チーム')+'</b><div class="muted">'+esc(c.sport||'')+'</div>';
}
if($('joinCategorySelect'))$('joinCategorySelect').onchange=()=>{$('joinCategoryOther').classList.toggle('hidden',$('joinCategorySelect').value!=='その他')};
if($('joinExit'))$('joinExit').onclick=()=>location.replace('https://hideyuki062222-cyber.github.io/sports-attendance/');
if($('submitTeamJoin'))$('submitTeamJoin').onclick=async()=>{
  const br=readBirthInput('join','joinBirthDate');if(br.error)return msg('teamJoinMsg',br.error);
  const name=$('joinPlayerName').value.trim(),cn=$('joinCategorySelect').value==='その他'?$('joinCategoryOther').value.trim():$('joinCategorySelect').value;
  if(!name)return msg('teamJoinMsg','選手名を入力してください。');
  if(!cn)return msg('teamJoinMsg','区分・学年を入力してください。');
  const body={action:'register',code:joinCode,player_name:name,birth_date:br.value,category_name:cn,email:$('joinEmail').value.trim(),password:$('joinPassword').value};
  if(!body.email.includes('@'))return msg('teamJoinMsg','メールアドレスを入力してください。');
  if(body.password.length<6)return msg('teamJoinMsg','パスワードは6文字以上にしてください。');
  const b=$('submitTeamJoin');b.disabled=true;const old=b.textContent;b.textContent='送信しています…';msg('teamJoinMsg','');
  const {data,error}=await sb.functions.invoke('team-register',{body});b.disabled=false;b.textContent=old;
  if(error||data?.error){let t=data?.error||error?.message||'登録申請を送信できませんでした。';try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{}return msg('teamJoinMsg',t)}
  msg('teamJoinMsg','✅ 登録申請を送信しました。管理者の承認をお待ちください。');b.disabled=true;
  $('joinPlayerName').disabled=true;$('joinCategorySelect').disabled=true;
  showToast('✓ 登録申請を送信しました');
};

let onboardingState={link:null,requests:[]};
function renderJoinQRCode(url){
  const box=$('joinQRCode');if(!box)return;box.innerHTML='';
  try{
    if(typeof QRCode==='function'){
      new QRCode(box,{text:url,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});
    }else box.innerHTML='<p class="muted">QRコードを表示できません。下のリンクを共有してください。</p>';
  }catch(e){console.error('qr',e);box.innerHTML='<p class="muted">QRコードを表示できません。下のリンクを共有してください。</p>'}
}
function renderOnboarding(){
  if(appRole!=='admin'||!$('memberOnboarding'))return;
  const link=onboardingState.link,requests=onboardingState.requests||[];
  $('pendingJoinCount').textContent=String(requests.length);
  if(link){
    $('joinQRArea').classList.remove('hidden');$('joinURL').value=link.url||'';renderJoinQRCode(link.url||'');
    const exp=link.expires_at?new Date(link.expires_at).toLocaleDateString('ja-JP'):'';
    $('joinQRMeta').textContent=exp?'有効期限：'+exp:'';
    $('createJoinQR').textContent='QRコードを作り直す';
  }else{
    $('joinQRArea').classList.add('hidden');$('joinURL').value='';$('joinQRCode').innerHTML='';$('joinQRMeta').textContent='';$('createJoinQR').textContent='登録QRコードを作成';
  }
  $('pendingJoinList').innerHTML=requests.length?requests.map(r=>{
    const birth=r.birth_date?formatBirthDateBoth(r.birth_date):'未登録';
    return '<div class="pendingJoinRow"><div><b>'+esc(r.player_name)+'</b><div class="muted">'+esc(r.category_name)+'｜生年月日 '+esc(birth)+'</div><div class="muted">'+esc(r.guardian_email_masked||'')+'</div></div><div class="pendingJoinActions"><button class="small approveJoin" data-id="'+r.id+'">承認</button><button class="small danger rejectJoin" data-id="'+r.id+'">却下</button></div></div>'
  }).join(''):'<p class="muted">現在、承認待ちはありません。</p>';
  document.querySelectorAll('.approveJoin').forEach(b=>b.onclick=()=>reviewJoinRequest(b.dataset.id,'approve'));
  document.querySelectorAll('.rejectJoin').forEach(b=>b.onclick=()=>reviewJoinRequest(b.dataset.id,'reject'));
}
async function loadMemberOnboarding(){
  if(appRole!=='admin'||!club||!$('memberOnboarding'))return;
  const {data,error}=await sb.functions.invoke('team-onboarding-admin',{body:{action:'status',club_id:club.id}});
  if(error||data?.error){let t=data?.error||error?.message||'QR登録情報を読み込めませんでした。';try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{};$('pendingJoinList').innerHTML='<p class="muted">'+esc(t)+'</p>';return}
  onboardingState={link:data.link||null,requests:data.requests||[]};renderOnboarding();
}
async function reviewJoinRequest(id,action){
  const r=onboardingState.requests.find(x=>x.id===id);if(!r)return;
  const word=action==='approve'?'承認':'却下';if(!confirm(r.player_name+' の登録申請を'+word+'しますか？'))return;
  const {data,error}=await sb.functions.invoke('team-onboarding-admin',{body:{action,club_id:club.id,request_id:id}});
  if(error||data?.error){let t=data?.error||error?.message||'処理できませんでした。';try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{}return alert(t)}
  showToast('✓ '+r.player_name+' を'+word+'しました');await loadMemberOnboarding();if(action==='approve')await players();
}
if($('createJoinQR'))$('createJoinQR').onclick=async()=>{
  if(onboardingState.link&&!confirm('現在のQRコードを停止して、新しいQRコードを作りますか？'))return;
  const b=$('createJoinQR');b.disabled=true;const old=b.textContent;b.textContent='作成中…';
  const {data,error}=await sb.functions.invoke('team-onboarding-admin',{body:{action:'create_link',club_id:club.id}});b.disabled=false;b.textContent=old;
  if(error||data?.error){let t=data?.error||error?.message||'作成できませんでした。';try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{}return alert(t)}
  onboardingState.link=data.link;renderOnboarding();showToast('✓ 登録QRコードを作成しました');
};
if($('deactivateJoinQR'))$('deactivateJoinQR').onclick=async()=>{
  if(!confirm('この登録QRコードを停止しますか？'))return;
  const {data,error}=await sb.functions.invoke('team-onboarding-admin',{body:{action:'deactivate_link',club_id:club.id}});
  if(error||data?.error)return alert(data?.error||error?.message||'停止できませんでした。');
  onboardingState.link=null;renderOnboarding();showToast('✓ 登録QRコードを停止しました');
};
if($('copyJoinURL'))$('copyJoinURL').onclick=async()=>{
  const url=$('joinURL').value;if(!url)return;
  try{await navigator.clipboard.writeText(url);showToast('✓ 登録リンクをコピーしました')}catch{ $('joinURL').focus();$('joinURL').select();document.execCommand('copy');showToast('✓ 登録リンクをコピーしました') }
};

function inviteCode(){return Array.from(crypto.getRandomValues(new Uint8Array(6))).map(x=>(x%36).toString(36)).join('').toUpperCase()}
if($('makeInvite'))$('makeInvite').onclick=async()=>{const pid=$('invitePlayer').value;if(!pid)return alert('選手を選択してください');const code=inviteCode();const {error}=await sb.from('guardian_invites').insert({club_id:club.id,player_id:pid,code,created_by:user.id});if(error)return alert(error.message);$('inviteResult').innerHTML='<div class="inviteCode">招待コード <b>'+code+'</b></div><p class="muted">このコードを保護者へ伝えてください。有効期限は30日です。</p>'};
if($('claimInvite'))$('claimInvite').onclick=async()=>{const code=$('inviteCode').value.trim();if(!code)return msg('claimMsg','招待コードを入力してください。');msg('claimMsg','連携しています…');const {data,error}=await sb.functions.invoke('claim-guardian-invite',{body:{code}});if(error){let t=error.message;try{const j=await error.context.json();t=j.error||t}catch{}return msg('claimMsg',t)}msg('claimMsg','連携できました！');setTimeout(()=>location.reload(),700)};

function applyRoleUI(){const admin=appRole==='admin';document.querySelector('[data-tab="event"]').classList.toggle('hidden',!admin);document.querySelector('[data-tab="teams"]').classList.toggle('hidden',!admin);document.querySelector('[data-tab="members"]').classList.toggle('hidden',!admin);$('guardianPicker').classList.toggle('hidden',admin);$('inviteAdmin').classList.toggle('hidden',!admin);$('guardianArea').classList.toggle('hidden',admin);if($('renameClub'))$('renameClub').classList.toggle('hidden',!admin);if(!admin){document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));$('calendar').classList.remove('hidden');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));document.querySelector('[data-tab="calendar"]').classList.add('active')}}
function renderGuardianPlayerProfile(){if(appRole!=='guardian'||!$('guardianPlayerProfile'))return;const pid=$('childPicker')?.value||$('replyPlayer')?.value,p=playerRows.find(x=>x.id===pid);if(!p){$('guardianPlayerName').value='';setBirthInputValue('guardian','guardianBirthDate','');$('guardianPlayerMeta').textContent='編集する選手がありません。';$('saveGuardianPlayer').disabled=true;return}$('saveGuardianPlayer').disabled=false;$('guardianPlayerName').value=p.name||'';setBirthInputValue('guardian','guardianBirthDate',p.birth_date||'');const age=calcAge(p.birth_date),grade=currentGradeLabel(p),teams=groupNames(playerGroupIds(p.id));$('guardianPlayerMeta').textContent='区分・学年：'+grade+(age!==null?'｜年齢：'+age+'歳':'')+'｜所属：'+(teams.length?teams.join('・'):'未設定');msg('guardianPlayerMsg','')}
if($('childPicker'))$('childPicker').onchange=()=>{$('replyPlayer').value=$('childPicker').value;if($('guardianPlayerProfile'))$('guardianPlayerProfile').open=false;renderGuardianPlayerProfile();render()};
if($('saveGuardianPlayer'))$('saveGuardianPlayer').onclick=async()=>{const br=readBirthInput('guardian','guardianBirthDate');if(br.error)return msg('guardianPlayerMsg',br.error);const pid=$('childPicker')?.value||'',name=$('guardianPlayerName').value.trim(),birth=br.value;if(!pid)return msg('guardianPlayerMsg','選手を選択してください。');if(!name)return msg('guardianPlayerMsg','選手名を入力してください。');msg('guardianPlayerMsg','保存しています…');const {data,error}=await sb.functions.invoke('update-player-profile',{body:{player_id:pid,name,birth_date:birth}});if(error){let t=error.message;try{const j=await error.context.json();t=j.error||t}catch{}return msg('guardianPlayerMsg','更新できませんでした：'+t)}if(data?.error)return msg('guardianPlayerMsg','更新できませんでした：'+data.error);await players();renderGuardianPlayerProfile();render(document.querySelector('.day.selected')?.dataset.date);msg('guardianPlayerMsg','✅ 選手情報を更新しました！');showToast('✓ 選手情報を更新しました');if($('guardianPlayerProfile'))$('guardianPlayerProfile').open=false};

async function claimFirstInvite(){const code=$('firstInviteCode').value.trim();if(!code)return msg('firstClaimMsg','招待コードを入力してください。');msg('firstClaimMsg','連携しています…');const {error}=await sb.functions.invoke('claim-guardian-invite',{body:{code}});if(error){let t=error.message;try{const j=await error.context.json();t=j.error||t}catch{}return msg('firstClaimMsg',t)}msg('firstClaimMsg','連携できました！');localStorage.removeItem('signupMode');setTimeout(()=>location.reload(),600)}
$('firstClaimInvite').onclick=claimFirstInvite;
$('guardianBack').onclick=()=>{$('guardianSetup').classList.add('hidden');$('auth').classList.remove('hidden');sb.auth.signOut();localStorage.removeItem('signupMode')};

function openPlayerEdit(p){if(!p||!$('editPlayerBox'))return;$('editPlayerId').value=p.id;$('editPlayerName').value=p.name||'';setBirthInputValue('edit','editBirthDate',p.birth_date||'');const cn=currentGradeLabel(p)||p.categories?.name||'その他',sel=$('editCategorySelect'),has=[...sel.options].some(o=>o.value===cn);sel.value=has?cn:'その他';$('editCategoryOther').value=has?'':cn;$('editCategoryOther').classList.toggle('hidden',has);renderGroupChecks('editPlayerGroups',playerGroupIds(p.id));msg('editPlayerMsg','');$('editPlayerBox').classList.remove('hidden');$('editPlayerBox').scrollIntoView({behavior:'smooth',block:'start'})}
if($('cancelPlayerEdit'))$('cancelPlayerEdit').onclick=()=>{$('editPlayerBox').classList.add('hidden');msg('editPlayerMsg','')};
if($('savePlayerEdit'))$('savePlayerEdit').onclick=async()=>{const br=readBirthInput('edit','editBirthDate');if(br.error)return msg('editPlayerMsg',br.error);const id=$('editPlayerId').value,n=$('editPlayerName').value.trim(),birth=br.value,cn=$('editCategorySelect').value==='その他'?$('editCategoryOther').value.trim():$('editCategorySelect').value,groupIds=selectedGroupIds('editPlayerGroups');if(!id)return msg('editPlayerMsg','編集するメンバーを選んでください。');if(!n)return msg('editPlayerMsg','選手名を入力してください。');if(!cn)return msg('editPlayerMsg','区分・学年を入力してください。');msg('editPlayerMsg','保存しています…');const cr=await ensureCategory(cn);if(cr.error)return msg('editPlayerMsg','区分登録エラー：'+cr.error.message);const info=parseMemberCategory(cn);const {error}=await sb.from('players').update({name:n,birth_date:birth,category_id:cr.data.id,...info}).eq('id',id);if(error)return msg('editPlayerMsg',error.code==='23505'?'同じ選手がすでに登録されています。':'更新できませんでした：'+error.message);const del=await sb.from('player_team_groups').delete().eq('player_id',id);if(del.error)return msg('editPlayerMsg','基本情報は更新しましたが、所属チームの更新に失敗しました：'+del.error.message);if(groupIds.length){const ins=await sb.from('player_team_groups').insert(groupIds.map(team_group_id=>({player_id:id,team_group_id})));if(ins.error)return msg('editPlayerMsg','基本情報は更新しましたが、所属チームの更新に失敗しました：'+ins.error.message)}$('editPlayerBox').classList.add('hidden');msg('playerMsg','✅ メンバー情報を更新しました！');await players();render()};
function bindPlayerActions(){
 document.querySelectorAll('.deletePlayer').forEach(b=>b.onclick=async()=>{const p=playerRows.find(x=>x.id===b.dataset.id);if(!p||!confirm(p.name+' を削除しますか？\n\nこの選手の出欠回答・フォーメーション配置・招待情報も削除されます。'))return;b.disabled=true;const old=b.textContent;b.textContent='削除中…';const {data,error}=await sb.functions.invoke('delete-player',{body:{player_id:p.id}});b.disabled=false;b.textContent=old;if(error||data?.error){let t=data?.error||error?.message||'削除できませんでした';try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{}return alert(t)}showToast('✓ '+p.name+' を削除しました');await load()});
 document.querySelectorAll('.editPlayer').forEach(b=>b.onclick=()=>{const p=playerRows.find(x=>x.id===b.dataset.id);if(p)openPlayerEdit(p)})
}
let resetGuardianRecipients=[];
function maskEmail(email){const s=String(email||''),at=s.indexOf('@');if(at<1)return'';const name=s.slice(0,at),domain=s.slice(at+1);return name.slice(0,1)+'***@'+domain}
async function loadResetGuardianRecipients(){if(appRole!=='admin'||!$('resetGuardianSelect'))return;const sel=$('resetGuardianSelect');sel.innerHTML='<option value="">読み込み中…</option>';const {data,error}=await sb.functions.invoke('list-club-guardians',{body:{}});if(error){sel.innerHTML='<option value="">読み込めませんでした</option>';msg('resetGuardianMsg','送信先を読み込めませんでした。');return}resetGuardianRecipients=(data?.guardians||[]).filter(g=>g.club_id===club.id&&g.email&&(g.players||[]).filter(Boolean).length);const options=resetGuardianRecipients.map((g,i)=>{const names=(g.players||[]).filter(Boolean),label=(names.length?names.join('・'):'選手未連携')+'（'+maskEmail(g.email)+'）';return'<option value="'+i+'">'+esc(label)+'</option>'}).join('');sel.innerHTML='<option value="">選手名を選択</option>'+options;if(!resetGuardianRecipients.length)msg('resetGuardianMsg','再設定メールを送れる登録者はいません。');else msg('resetGuardianMsg','')}
if($('sendGuardianReset'))$('sendGuardianReset').onclick=async()=>{const v=$('resetGuardianSelect')?.value;if(v==='')return msg('resetGuardianMsg','選手名を選択してください。');const g=resetGuardianRecipients[Number(v)];if(!g?.email)return msg('resetGuardianMsg','送信先を確認できませんでした。');const names=(g.players||[]).filter(Boolean).join('・')||'選択した登録者';if(!confirm(names+' の登録メールへ再設定メールを送りますか？'))return;msg('resetGuardianMsg','送信しています…');const {error}=await sb.auth.resetPasswordForEmail(g.email,{redirectTo:'https://hideyuki062222-cyber.github.io/sports-attendance/'});if(error)return msg('resetGuardianMsg','送信できませんでした：'+error.message);msg('resetGuardianMsg','✅ 再設定メールを送信しました。');showToast('✓ 再設定メールを送りました')};

if($('showAddChild'))$('showAddChild').onclick=()=>{$('addChildBox').classList.remove('hidden');$('showAddChild').classList.add('hidden');$('addChildCode').focus()};
if($('cancelAddChild'))$('cancelAddChild').onclick=()=>{$('addChildBox').classList.add('hidden');$('showAddChild').classList.remove('hidden');$('addChildCode').value='';msg('addChildMsg','')};
if($('addChildClaim'))$('addChildClaim').onclick=async()=>{const code=$('addChildCode').value.trim();if(!code)return msg('addChildMsg','招待コードを入力してください。');msg('addChildMsg','追加しています…');const {data,error}=await sb.functions.invoke('claim-guardian-invite',{body:{code}});if(error){let t=error.message;try{const j=await error.context.json();t=j.error||t}catch{}return msg('addChildMsg',t)}msg('addChildMsg','✓ 選手を追加しました！');showToast('✓ 選手を追加しました');setTimeout(async()=>{await players();$('addChildBox').classList.add('hidden');$('showAddChild').classList.remove('hidden');$('addChildCode').value='';render()},700)};

let venues=[];
let eventTitlePresets=[];
async function loadEventTitles(){if(!club||!$('eventTitlePreset'))return;const {data,error}=await sb.from('event_title_presets').select('id,name').eq('club_id',club.id).order('name');if(error){console.error('event title presets load',error);return}eventTitlePresets=data||[];const cur=$('eventTitlePreset').value;$('eventTitlePreset').innerHTML='<option value="">直接入力する</option>'+eventTitlePresets.map(x=>'<option value="'+esc(x.name)+'">'+esc(x.name)+'</option>').join('');if(eventTitlePresets.some(x=>x.name===cur))$('eventTitlePreset').value=cur}
if($('eventTitlePreset'))$('eventTitlePreset').onchange=()=>{if($('eventTitlePreset').value)$('eventTitle').value=$('eventTitlePreset').value};
if($('addEventTitle'))$('addEventTitle').onclick=async()=>{const n=$('newEventTitle').value.trim();if(!n)return alert('予定名を入力してください。');const {error}=await sb.from('event_title_presets').insert({club_id:club.id,name:n});if(error){if(error.code==='23505')return alert('その予定名はすでに登録されています。');return alert(error.message)}$('newEventTitle').value='';await loadEventTitles();$('eventTitlePreset').value=n;$('eventTitle').value=n;showToast('✓ 予定名を登録しました')};
if($('deleteEventTitle'))$('deleteEventTitle').onclick=async()=>{const n=$('eventTitlePreset').value;if(!n)return alert('削除する予定名を選択してください。');if(!confirm(n+' を予定名一覧から削除しますか？\n過去の予定に登録済みの予定名は残ります。'))return;const {error}=await sb.from('event_title_presets').delete().eq('club_id',club.id).eq('name',n);if(error)return alert(error.message);await loadEventTitles();$('eventTitlePreset').value='';if($('eventTitle').value===n)$('eventTitle').value='';showToast('✓ 予定名を削除しました')};
async function loadVenues(){if(!club||!$('place'))return;const {data}=await sb.from('venues').select('*').eq('club_id',club.id).order('name');venues=data||[];const cur=$('place').value;$('place').innerHTML='<option value="">場所を選択</option>'+venues.map(v=>'<option value="'+esc(v.name)+'">'+esc(v.name)+'</option>').join('');if(venues.some(v=>v.name===cur))$('place').value=cur}
$('addVenue').onclick=async()=>{const n=$('newVenue').value.trim();if(!n)return alert('場所名を入力してください。');const {error}=await sb.from('venues').insert({club_id:club.id,name:n});if(error){if(error.code==='23505')return alert('その場所はすでに登録されています。');return alert(error.message)}$('newVenue').value='';await loadVenues();$('place').value=n;showToast('✓ 場所を登録しました')};
$('deleteVenue').onclick=async()=>{const n=$('place').value;if(!n)return alert('削除する場所を選択してください。');if(!confirm(n+' を場所一覧から削除しますか？\n過去の予定に登録済みの場所名は残ります。'))return;const {error}=await sb.from('venues').delete().eq('club_id',club.id).eq('name',n);if(error)return alert(error.message);await loadVenues();showToast('✓ 場所を削除しました')};
function nextWeekDate(ds){const p=ds.split('-').map(Number),d=new Date(p[0],p[1]-1,p[2]);d.setDate(d.getDate()+7);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function openEventPanel(){document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));$('event').classList.remove('hidden');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));document.querySelector('[data-tab="event"]').classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
function bindEventEdits(){document.querySelectorAll('.duplicateEvent').forEach(b=>b.onclick=()=>{const e=events.find(x=>x.id===b.dataset.id);if(!e)return;resetEventForm();$('editingEventId').value='';$('eventDate').value=nextWeekDate(e.event_date);$('eventType').value=e.event_type;$('eventTitle').value=e.title;if($('eventTitlePreset'))$('eventTitlePreset').value=eventTitlePresets.some(x=>x.name===e.title)?e.title:'';$('place').value=e.place||'';$('meet').value=(e.meeting_time||'').slice(0,5);$('end').value=(e.end_time||'').slice(0,5);$('notes').value=e.notes||'';setGroupChecks('eventTeamGroups',eventGroupIds(e.id));$('saveEvent').textContent='複製して保存';$('cancelEventEdit').textContent='複製をキャンセル';$('cancelEventEdit').classList.remove('hidden');msg('eventMsg','内容をコピーしました。日付は1週間後にしています。必要なら変更して保存してください。');openEventPanel()});document.querySelectorAll('.editEvent').forEach(b=>b.onclick=()=>{const e=events.find(x=>x.id===b.dataset.id);if(!e)return;$('editingEventId').value=e.id;$('eventDate').value=e.event_date;$('eventType').value=e.event_type;$('eventTitle').value=e.title;if($('eventTitlePreset'))$('eventTitlePreset').value=eventTitlePresets.some(x=>x.name===e.title)?e.title:'';$('place').value=e.place||'';$('meet').value=(e.meeting_time||'').slice(0,5);$('end').value=(e.end_time||'').slice(0,5);$('notes').value=e.notes||'';setGroupChecks('eventTeamGroups',eventGroupIds(e.id));$('saveEvent').textContent='変更を保存';$('cancelEventEdit').textContent='編集をキャンセル';$('cancelEventEdit').classList.remove('hidden');msg('eventMsg','');openEventPanel()});document.querySelectorAll('.deleteEvent').forEach(b=>b.onclick=async()=>{const e=events.find(x=>x.id===b.dataset.id);if(!e)return;if(!confirm('「'+e.title+'」の予定を削除しますか？\n登録済みの出欠回答も削除されます。'))return;const {error}=await sb.from('events').delete().eq('id',e.id).eq('club_id',club.id);if(error)return alert('予定を削除できませんでした：'+error.message);showToast('✓ 予定を削除しました');await load();render(e.event_date)})}
function resetEventForm(){$('editingEventId').value='';$('eventDate').value='';$('eventTitle').value='';if($('eventTitlePreset'))$('eventTitlePreset').value='';$('place').value='';$('meet').value='';$('end').value='';$('notes').value='';setGroupChecks('eventTeamGroups',[]);$('saveEvent').textContent='予定を保存';$('cancelEventEdit').textContent='編集をキャンセル';$('cancelEventEdit').classList.add('hidden');msg('eventMsg','')}
$('cancelEventEdit').onclick=resetEventForm;

async function checkSystemAdmin(){const {data,error}=await sb.functions.invoke('system-admin-teams',{body:{action:'list'}});if(!error&&data?.teams){$('systemAdminBtn').classList.remove('hidden');window._systemTeams=data.teams}}
async function openSystemAdmin(){const {data,error}=await sb.functions.invoke('system-admin-teams',{body:{action:'list'}});if(error||!data?.teams)return alert('システム管理画面を開けませんでした。');document.querySelectorAll('main>section').forEach(x=>x.classList.add('hidden'));$('systemAdmin').classList.remove('hidden');$('systemStats').innerHTML='<div class="adminStats"><div><b>'+data.total+'</b><span>全チーム</span></div><div><b>'+data.active+'</b><span>稼働中</span></div><div><b>'+data.stopped+'</b><span>停止中</span></div></div>';window.systemAdminTeams=data.teams;function bindSystemButtons(){document.querySelectorAll('.teamDetail').forEach(b=>b.onclick=()=>{const t=window.systemAdminTeams.find(x=>x.id===b.dataset.id);if(!t)return;$('systemTeams').innerHTML='<div class="teamAdminCard detailCard"><button id="detailBack" class="textBack">← 一覧へ戻る</button><h2>'+esc(t.name||'名称未設定')+'</h2><p><b>スポーツ：</b>'+esc(t.sport||'')+'</p><p><b>状態：</b>'+(t.is_active?'稼働中':'停止中')+'</p><p><b>管理者：</b>'+esc(t.admin_email||'不明')+'</p><p><b>選手：</b>'+t.players+'名</p><p><b>保護者：</b>'+t.guardians+'名</p><p><b>登録者数：</b>'+t.total_registered+'名</p><p><b>予定：</b>'+t.events+'件</p><p><b>登録日：</b>'+new Date(t.created_at).toLocaleDateString('ja-JP')+'</p></div>';$('detailBack').onclick=renderSystemTeams});document.querySelectorAll('.toggleTeam').forEach(b=>b.onclick=async()=>{const next=b.dataset.active!=='true';if(!confirm(next?'このチームを再開しますか？':'このチームを停止しますか？'))return;const {error}=await sb.functions.invoke('system-admin-teams',{body:{action:'toggle',club_id:b.dataset.id,is_active:next}});if(error)return alert('変更できませんでした。');showToast(next?'✓ チームを再開しました':'✓ チームを停止しました');openSystemAdmin()});document.querySelectorAll('.changeAdmin').forEach(b=>b.onclick=async()=>{const email=prompt('新しい管理者の登録メールアドレスを入力してください',b.dataset.email);if(email===null)return;if(!email.includes('@'))return alert('メールアドレスを入力してください。');if(!confirm(email+' を新しい管理者にしますか？'))return;const {data,error}=await sb.functions.invoke('system-admin-teams',{body:{action:'change_admin',club_id:b.dataset.id,email:email.trim()}});if(error||data?.error)return alert(data?.error||'管理者を変更できませんでした。');showToast('✓ 管理者を変更しました');openSystemAdmin()});document.querySelectorAll('.deleteTeam').forEach(b=>b.onclick=async()=>{if(!confirm('「'+b.dataset.name+'」を削除しますか？\\n予定・選手・回答など、このチームのデータも削除されます。'))return;if(!confirm('本当に削除しますか？この操作は元に戻せません。'))return;const {data,error}=await sb.functions.invoke('system-admin-teams',{body:{action:'delete',club_id:b.dataset.id}});if(error||!data?.ok)return alert('削除できませんでした。');showToast('✓ チームを削除しました');openSystemAdmin()})}function renderSystemTeams(){const q=($('teamSearch')?.value||'').toLowerCase(),st=$('teamStatus')?.value||'all';const teams=window.systemAdminTeams.filter(t=>(st==='all'||(st==='active'&&t.is_active)||(st==='stopped'&&!t.is_active))&&(!q||[t.name,t.sport,t.admin_email].join(' ').toLowerCase().includes(q)));$('systemTeams').innerHTML=teams.map(t=>'<div class="teamAdminCard"><h3>'+esc(t.name||'名称未設定')+' <span class="teamState '+(t.is_active?'on':'off')+'">'+(t.is_active?'稼働中':'停止中')+'</span></h3><div>'+esc(t.sport||'')+'</div><div class="muted">管理者：'+esc(t.admin_email||'不明')+'</div><div class="muted">選手 '+t.players+'名・保護者 '+t.guardians+'名・予定 '+t.events+'件</div><div class="muted">登録者数 '+t.total_registered+'名</div><div class="muted">登録日 '+new Date(t.created_at).toLocaleDateString('ja-JP')+'</div><button class="secondary teamDetail" data-id="'+t.id+'">チーム詳細</button><button class="secondary toggleTeam" data-id="'+t.id+'" data-active="'+t.is_active+'">'+(t.is_active?'チームを停止':'チームを再開')+'</button><button class="secondary changeAdmin" data-id="'+t.id+'" data-email="'+esc(t.admin_email||'')+'">管理者を変更</button><button class="danger deleteTeam" data-id="'+t.id+'" data-name="'+esc(t.name||'名称未設定')+'">チームを削除</button></div>').join('')||'<p class="muted">条件に一致するチームはありません。</p>';bindSystemButtons()}$('teamSearch').oninput=renderSystemTeams;$('teamStatus').onchange=renderSystemTeams;renderSystemTeams()}
if($('createSystemTeam'))$('createSystemTeam').onclick=async()=>{const name=$('newTeamName').value.trim(),sport=$('newTeamSport').value,email=$('newTeamAdminEmail').value.trim(),password=$('newTeamAdminPassword').value;if(!name)return msg('createSystemTeamMsg','チーム名を入力してください。');if(!email.includes('@'))return msg('createSystemTeamMsg','管理者メールアドレスを入力してください。');if(password.length<6)return msg('createSystemTeamMsg','初期パスワードは6文字以上にしてください。');msg('createSystemTeamMsg','登録しています…');const {data,error}=await sb.functions.invoke('system-admin-teams',{body:{action:'create_team',name,sport,email,password}});if(error||data?.error){let t=data?.error||error?.message||'登録できませんでした。';try{if(error?.context){const j=await error.context.json();t=j.error||t}}catch{}return msg('createSystemTeamMsg',t)}msg('createSystemTeamMsg','✓ チームと管理者を登録しました！');$('newTeamName').value='';$('newTeamAdminEmail').value='';$('newTeamAdminPassword').value='';setTimeout(openSystemAdmin,700)};
$('systemAdminBtn').onclick=openSystemAdmin;$('systemAdminBack').onclick=()=>{ $('systemAdmin').classList.add('hidden');$('app').classList.remove('hidden')};
