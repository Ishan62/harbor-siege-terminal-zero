import * as THREE from 'three';
import { io } from 'socket.io-client';
import './style.css';

const $ = id => document.getElementById(id);
const socket = io(import.meta.env.VITE_SERVER_URL || window.location.origin, { autoConnect:false, transports:['websocket','polling'] });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9b6550);
scene.fog = new THREE.FogExp2(0x77605a, 0.012);
const camera = new THREE.PerspectiveCamera(76, innerWidth/innerHeight, .1, 350);
const renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('game').appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xb8c9df,0x3d2924,1.65); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb36a,2.4); sun.position.set(-35,55,25); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;scene.add(sun);
const mat=(color,rough=.8,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const groundMat=mat(0x303b40,.92,.15), containerMats=[mat(0x52606a),mat(0x6c4638),mat(0x3f5961),mat(0x77705f),mat(0x394b55)];
function box(x,y,z,sx,sy,sz,material,shadow=true){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m}
box(0,-.35,0,180,.6,180,groundMat);
for(let i=0;i<13;i++){const x=-52+i*8.7;for(let j=0;j<3;j++){let z=-43+j*14;let h=5.4+(j%2)*.1;box(x,h/2-0.1,z,8.2,h,12,containerMats[(i+j)%containerMats.length]);for(let k=0;k<5;k++)box(x-3.3+k*1.65,h/2,z+6.03,.045,h-.25,.04,mat(0x202a30));if(i%3===0)box(x,h+2.7,z,8.2,5.4,12,containerMats[(i+2)%5]);}}
for(let x=-48;x<=48;x+=24){box(x,7,-62,1,14,1,mat(0x303a40));box(x+10,14,-62,21,1,1,mat(0x4b5559));}
box(0,13,-62,100,1,1,mat(0x46535a));
for(let i=0;i<8;i++){let x=-35+i*10;box(x,2.2,18,5,4.4,2.5,mat(0x4a4c49));box(x,4.5,18,5,.25,2.5,mat(0x22282b));}
for(let i=0;i<16;i++){let puddle=new THREE.Mesh(new THREE.CircleGeometry(1.4+(i%3)*.8,20),new THREE.MeshStandardMaterial({color:0x69777a,roughness:.22,metalness:.35,transparent:true,opacity:.38}));puddle.rotation.x=-Math.PI/2;puddle.position.set((i*13%90)-45,.0,(i*19%90)-45);puddle.scale.y=.5;scene.add(puddle);}
const water=box(0,-.2,-100,180,.2,50,mat(0x263e4b,.25,.45),false);
const ship=box(12,2,-92,42,5,12,mat(0x394b52));box(12,5.5,-92,12,2,8,mat(0xb7b0a0));
for(let i=0;i<6;i++)box(-28+i*11,8,-72,.6,16,.6,mat(0x39454c));
const player={pos:new THREE.Vector3(0,1.7,8),vel:new THREE.Vector3(),yaw:0,pitch:0,health:100,armor:150,ammo:30,reserve:120,weapon:0,alive:true,grounded:true,score:0,style:0};
camera.position.copy(player.pos); scene.add(camera);
const gun=new THREE.Group();camera.add(gun);
const gunBody=new THREE.Mesh(new THREE.BoxGeometry(.18,.16,.65),mat(0x252c30,.35,.65));gunBody.position.set(.28,-.25,-.48);gun.add(gunBody);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.55,8),mat(0x14191d,.3,.8));barrel.rotation.x=Math.PI/2;barrel.position.set(.28,-.21,-.95);gun.add(barrel);
const optic=new THREE.Mesh(new THREE.BoxGeometry(.13,.1,.14),mat(0x30383c,.25,.7));optic.position.set(.28,-.12,-.53);gun.add(optic);
const enemies=[], pickups=[], remotePlayers=new Map(), keys={};let running=false,paused=false,mode='survival',wave=1,kills=0,room=null,isHost=false,isReady=false,localId=null,lastShot=0,lastArmorHit=0,toastTimer=0,mouseLocked=false,overdrive=0,gameClock=0;
function makeEnemy(type='merc'){const group=new THREE.Group();const bodyMat=type==='robot'?mat(0xd5d9d8,.38,.65):type==='dog'?mat(0x31383d,.45,.65):mat(0x403b39,.78,.1);const torso=new THREE.Mesh(new THREE.BoxGeometry(type==='dog'?.65:.75,type==='dog'?.5:1.25,type==='dog'?.95:.42),bodyMat);torso.position.y=type==='dog'?.55:1.05;group.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(type==='dog'?.2:.28,10,8),type==='robot'?mat(0xe6e9e7):mat(0x302927));head.position.y=type==='dog'?.72:1.85;group.add(head);if(type==='dog'){const turret=new THREE.Mesh(new THREE.BoxGeometry(.25,.2,.6),mat(0x22292e));turret.position.set(0,.95,-.1);group.add(turret);}group.position.set((Math.random()-.5)*52,0,-25-Math.random()*30);scene.add(group);const e={group,type,hp:type==='robot'?85:type==='dog'?65:55,speed:type==='dog'?4.8:1.7+Math.random(),fire:1+Math.random()*2,alive:true};enemies.push(e);return e;}
function spawnWave(){const n=mode==='ffa'?6:Math.min(4+wave*2,18);for(let i=0;i<n;i++)makeEnemy(i%5===0?'robot':i%7===0?'dog':'merc');updateHud();}
function addPickup(pos,type){const c=type==='health'?0x54db82:type==='armor'?0x4b9de8:0xf2b54c;const m=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.45),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.35}));m.position.copy(pos);m.position.y=.6;scene.add(m);pickups.push({mesh:m,type});}
function notify(t){$('toast').textContent=t;toastTimer=2.2;}
function updateHud(){$('health').textContent=Math.ceil(player.health);$('armor').textContent=Math.ceil(player.armor);$('healthBar').style.width=Math.max(0,player.health)+'%';$('armorBar').style.width=Math.max(0,player.armor/150*100)+'%';$('ammo').textContent=player.ammo+' / '+player.reserve;$('weapon').textContent=['ASSAULT RIFLE','SHOTGUN','ROCKET LAUNCHER'][player.weapon];$('wave').textContent=mode==='survival'?`WAVE ${wave} / 8`:'FREE-FOR-ALL';$('objective').textContent=`HOSTILES REMAINING: ${enemies.filter(e=>e.alive).length}`;$('rank').textContent=`STYLE: ${player.style>12?'ELITE':player.style>5?'VETERAN':'ROOKIE'} · KILLS ${kills}`;}
function startGame(m){mode=m;wave=1;kills=0;player.health=100;player.armor=150;player.ammo=30;player.reserve=120;player.pos.set(0,1.7,8);player.vel.set(0,0,0);player.alive=true;for(const e of enemies)scene.remove(e.group);enemies.length=0;for(const p of pickups)scene.remove(p.mesh);pickups.length=0;$('menu').classList.add('hidden');$('lobby').classList.add('hidden');$('pause').classList.add('hidden');$('gameover').classList.add('hidden');$('hud').classList.remove('hidden');running=true;paused=false;spawnWave();renderer.domElement.requestPointerLock?.();}
function endGame(title,text){running=false;document.exitPointerLock?.();$('hud').classList.add('hidden');$('gameover').classList.remove('hidden');$('endTitle').textContent=title;$('endText').textContent=text;}
function fire(){if(!running||paused||!player.alive)return;const now=performance.now();const delay=player.weapon===1?260:player.weapon===2?850:115;if(now-lastShot<delay)return;lastShot=now;if(player.ammo<=0){notify('OUT OF AMMO — PRESS R');return;}player.ammo--;const dir=new THREE.Vector3();camera.getWorldDirection(dir);const ray=new THREE.Raycaster(camera.position,dir,0,player.weapon===2?65:100);let hit=ray.intersectObjects(scene.children,true).find(h=>h.object.userData.enemy);let target=null;if(hit)target=hit.object.userData.enemy;if(!target){let best=null,bestDot=.985;for(const e of enemies){if(!e.alive)continue;const v=e.group.position.clone().add(new THREE.Vector3(0,1,0)).sub(camera.position).normalize();const d=dir.dot(v);if(d>bestDot){bestDot=d;best=e;}}target=best;}if(target){const damage=(player.weapon===1?22:player.weapon===2?42:95)*1.25;target.hp-=damage;player.style+=.15;if(target.hp<=0){target.alive=false;scene.remove(target.group);kills++;player.score+=100;addPickup(target.group.position.clone(),Math.random()<.3?'health':Math.random()<.5?'armor':'ammo');notify('HOSTILE ELIMINATED +100');} }else{const p=camera.position.clone().add(dir.multiplyScalar(28));const flash=new THREE.Mesh(new THREE.SphereGeometry(.12,6,6),new THREE.MeshBasicMaterial({color:0xffb34d}));flash.position.copy(p);scene.add(flash);setTimeout(()=>scene.remove(flash),80);}gun.position.z=.07;setTimeout(()=>gun.position.z=0,65);updateHud();if(room)socket.emit('combat:fire',{origin:camera.position.toArray(),direction:dir.toArray(),weapon:player.weapon});}
for(const e of enemies){e.group.traverse(o=>{if(o.isMesh)o.userData.enemy=e;});}
function reload(){if(player.reserve<=0||player.ammo>=30)return;const n=Math.min(30-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;updateHud();notify('RELOADED');}
function update(dt){gameClock+=dt;if(!running||paused)return;const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));let move=new THREE.Vector3();if(keys.KeyW)move.add(forward);if(keys.KeyS)move.sub(forward);if(keys.KeyD)move.add(right);if(keys.KeyA)move.sub(right);if(move.lengthSq())move.normalize();const speed=keys.ShiftLeft?9:5.2;player.vel.x=move.x*speed;player.vel.z=move.z*speed;player.vel.y-=20*dt;if(player.grounded&&keys.Space){player.vel.y=7;player.grounded=false;}player.pos.addScaledVector(player.vel,dt);if(player.pos.y<1.7){player.pos.y=1.7;player.vel.y=0;player.grounded=true;}player.pos.x=THREE.MathUtils.clamp(player.pos.x,-65,65);player.pos.z=THREE.MathUtils.clamp(player.pos.z,-58,42);camera.position.copy(player.pos);camera.rotation.order='YXZ';camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
for(const e of enemies){if(!e.alive)continue;const v=player.pos.clone().sub(e.group.position);v.y=0;const d=v.length();if(d>1.7){v.normalize();e.group.position.addScaledVector(v,e.speed*dt);e.group.rotation.y=Math.atan2(v.x,v.z);}e.fire-=dt;if(d<24&&e.fire<=0){e.fire=1.4+Math.random()*1.2;if(Math.random()<.48){const damage=e.type==='robot'?10:7;let absorbed=Math.min(player.armor,damage);player.armor-=absorbed;player.health-=damage-absorbed;lastArmorHit=gameClock;$('damage').style.boxShadow='inset 0 0 65px 15px #9c1010';setTimeout(()=>$('damage').style.boxShadow='',120);if(player.health<=0){player.health=0;player.alive=false;endGame('OPERATOR DOWN',`Final score: ${player.score} · Hostiles eliminated: ${kills}`);}}}}
for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.mesh.rotation.y+=dt*1.5;if(p.mesh.position.distanceTo(player.pos)<1.5){if(p.type==='health')player.health=Math.min(100,player.health+30);else if(p.type==='armor')player.armor=Math.min(150,player.armor+45);else player.reserve+=30;scene.remove(p.mesh);pickups.splice(i,1);notify(p.type.toUpperCase()+' PICKUP');}}
if(gameClock-lastArmorHit>1&&player.armor<150)player.armor=Math.min(150,player.armor+55*dt);
if(enemies.every(e=>!e.alive)){if(mode==='survival'&&wave<8){wave++;notify(`WAVE ${wave} INCOMING`);spawnWave();}else if(mode==='survival'){endGame('TERMINAL SECURED','All eight waves cleared. APEX-08 neutralized.');}else{spawnWave();}}
if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').textContent='';}
updateHud();
if(room&&socket.connected){socket.emit('player:state',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch});}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);update(dt);for(const [id,r] of remotePlayers){r.mesh.position.lerp(new THREE.Vector3(r.state.x,r.state.y-1.7,r.state.z),.35);r.mesh.rotation.y=r.state.yaw;}renderer.render(scene,camera);}
const clock=new THREE.Clock();animate();
renderer.domElement.addEventListener('click',()=>{if(running&&!paused&&!matchMedia('(pointer:coarse)').matches)renderer.domElement.requestPointerLock?.();});
document.addEventListener('pointerlockchange',()=>{mouseLocked=document.pointerLockElement===renderer.domElement;});
document.addEventListener('mousemove',e=>{if(mouseLocked&&running&&!paused){player.yaw-=e.movementX*.0022;player.pitch=THREE.MathUtils.clamp(player.pitch-e.movementY*.0022,-1.45,1.45);}});
document.addEventListener('mousedown',e=>{if(e.button===0)fire();if(e.button===2)camera.fov=52,camera.updateProjectionMatrix();});
document.addEventListener('mouseup',e=>{if(e.button===2)camera.fov=76,camera.updateProjectionMatrix();});
document.addEventListener('contextmenu',e=>e.preventDefault());
// Touch-look support: drag on the 3D view to rotate the camera on phones/tablets.
let touchLook=null;
renderer.domElement.addEventListener('touchstart',e=>{
  if(!matchMedia('(pointer:coarse)').matches || e.touches.length!==1) return;
  const t=e.touches[0]; touchLook={x:t.clientX,y:t.clientY};
},{passive:true});
renderer.domElement.addEventListener('touchmove',e=>{
  if(!touchLook || !running || paused || e.touches.length!==1) return;
  const t=e.touches[0], dx=t.clientX-touchLook.x, dy=t.clientY-touchLook.y;
  player.yaw-=dx*.004; player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.004,-1.35,1.35);
  touchLook={x:t.clientX,y:t.clientY};
  e.preventDefault();
},{passive:false});
renderer.domElement.addEventListener('touchend',()=>touchLook=null,{passive:true});
document.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Escape'&&running){paused=!paused;$('pause').classList.toggle('hidden',!paused);if(paused)document.exitPointerLock?.();}if(e.code==='KeyR')reload();if(e.code==='Digit1')player.weapon=0;if(e.code==='Digit2')player.weapon=1;if(e.code==='Digit3')player.weapon=2;if(e.code==='KeyQ')player.weapon=(player.weapon+1)%3;});
document.addEventListener('keyup',e=>keys[e.code]=false);
$('survivalBtn').onclick=()=>startGame('survival');$('ffaBtn').onclick=()=>{startGame('ffa');notify('SIX HOSTILE BOTS DEPLOYED');};
$('resume').onclick=()=>{$('pause').classList.add('hidden');paused=false;renderer.domElement.requestPointerLock?.();};
$('quit').onclick=()=>{running=false;paused=false;$('pause').classList.add('hidden');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');document.exitPointerLock?.();};
$('again').onclick=()=>{$('gameover').classList.add('hidden');$('menu').classList.remove('hidden');};
$('multiBtn').onclick=()=>{$('menu').classList.add('hidden');$('lobby').classList.remove('hidden');};
$('backMenu').onclick=()=>{$('lobby').classList.add('hidden');$('menu').classList.remove('hidden');};
$('showJoin').onclick=()=>{$('joinArea').classList.remove('hidden');};
$('createRoom').onclick=()=>connectAnd('room:create');
$('joinRoom').onclick=()=>connectAnd('room:join');
$('copyCode').onclick=()=>navigator.clipboard?.writeText($('roomCode').textContent);
$('readyBtn').onclick=()=>{isReady=!isReady;socket.emit('room:ready',{ready:isReady});$('readyBtn').textContent=isReady?'NOT READY':'READY UP';};
$('startMatch').onclick=()=>socket.emit('match:start');
$('leaveRoom').onclick=()=>{socket.emit('room:leave');room=null;$('roomArea').classList.add('hidden');$('lobbyHome').classList.remove('hidden');};
async function connectAnd(action){$('lobbyMessage').textContent='Connecting to multiplayer server...';if(!socket.connected)socket.connect();socket.once('connect',()=>{const name=$('playerName').value.trim()||'Operator';if(action==='room:create')socket.emit(action,{name});else socket.emit(action,{name,code:$('roomInput').value.trim().toUpperCase()});});}
socket.on('connect',()=>{$('network').textContent='ONLINE';$('network').style.color='#77df9b';});
socket.on('disconnect',()=>{$('network').textContent='SERVER OFFLINE';$('network').style.color='#ff7777';});
socket.on('room:created',data=>{room=data.code;isHost=true;showRoom(data);});
socket.on('room:joined',data=>{room=data.code;isHost=data.hostId===socket.id;showRoom(data);});
socket.on('room:update',data=>showRoom(data));
socket.on('room:error',d=>$('lobbyMessage').textContent=d.message);
socket.on('match:started',()=>{startGame('multiplayer');notify('ONLINE MATCH STARTED');});
socket.on('player:joined',d=>notify(`${d.name} JOINED`));
socket.on('player:left',d=>notify(`${d.name} LEFT`));
socket.on('player:state',d=>{if(d.id===socket.id)return;let r=remotePlayers.get(d.id);if(!r){const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.8,3,6),mat(0x75a8c2,.7));scene.add(mesh);r={mesh,state:d};remotePlayers.set(d.id,r);}r.state=d;});
socket.on('player:remove',id=>{const r=remotePlayers.get(id);if(r){scene.remove(r.mesh);remotePlayers.delete(id);}});
socket.on('match:error',d=>notify(d.message));
function showRoom(data){$('lobbyHome').classList.add('hidden');$('joinArea').classList.add('hidden');$('roomArea').classList.remove('hidden');$('roomCode').textContent=data.code;$('players').innerHTML='';for(const p of data.players){const row=document.createElement('div');row.className='player-row';const left=document.createElement('span');left.textContent=p.name+(p.id===data.hostId?' · HOST':'');const right=document.createElement('span');right.textContent=p.ready?'READY':'NOT READY';row.append(left,right);$('players').append(row);} $('roomStatus').textContent=`${data.players.length}/6 OPERATORS CONNECTED`;$('startMatch').classList.toggle('hidden',!isHost);$('lobbyMessage').textContent='Share the code with up to five friends.';}
if(matchMedia('(pointer:coarse)').matches){$('mobileControls').classList.remove('hidden');$('mobileFire').ontouchstart=e=>{e.preventDefault();fire();};$('mobileJump').ontouchstart=()=>{keys.Space=true;setTimeout(()=>keys.Space=false,120);};$('mobileReload').ontouchstart=reload;let stick=$('stick');stick.ontouchstart=e=>{const t=e.touches[0];stick.dataset.x=t.clientX;stick.dataset.y=t.clientY;};stick.ontouchmove=e=>{const t=e.touches[0],dx=t.clientX-Number(stick.dataset.x),dy=t.clientY-Number(stick.dataset.y);keys.KeyW=dy<-12;keys.KeyS=dy>12;keys.KeyA=dx<-12;keys.KeyD=dx>12;};stick.ontouchend=()=>{keys.KeyW=keys.KeyS=keys.KeyA=keys.KeyD=false;};}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));});
