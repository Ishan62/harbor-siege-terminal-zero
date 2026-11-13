import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import crypto from 'node:crypto';

const app=express();
app.use(cors({origin:process.env.CLIENT_ORIGIN?.split(',')||'*'}));
app.get('/health',(req,res)=>res.json({ok:true,service:'harbor-siege-server',rooms:rooms.size}));
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.CLIENT_ORIGIN?.split(',')||'*',methods:['GET','POST']},pingInterval:10000,pingTimeout:20000});
const rooms=new Map();
const MAX_PLAYERS=6;
const cleanName=n=>String(n||'Operator').replace(/[<>]/g,'').trim().slice(0,18)||'Operator';
function code(){let c;do{c=crypto.randomBytes(4).toString('base64url').replace(/[-_]/g,'').slice(0,6).toUpperCase();}while(rooms.has(c));return c;}
function snapshot(r){return {code:r.code,hostId:r.hostId,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready}))};}
function emitRoom(r){io.to(r.code).emit('room:update',snapshot(r));}
function error(s,message){s.emit('room:error',{message});}
function leave(s){const code=s.data.room;if(!code)return;const r=rooms.get(code);if(!r)return;r.players.delete(s.id);s.leave(code);s.data.room=null;for(const p of r.players.values())io.to(p.id).emit('player:remove',s.id);io.to(code).emit('player:left',{name:s.data.name||'Operator'});if(!r.players.size){rooms.delete(code);return;}if(r.hostId===s.id){r.hostId=r.players.keys().next().value;const host=r.players.get(r.hostId);if(host)host.ready=true;io.to(code).emit('room:host-changed',{hostId:r.hostId});}emitRoom(r);}
io.on('connection',s=>{
 s.on('room:create',({name})=>{if(s.data.room)leave(s);const c=code(),p={id:s.id,name:cleanName(name),ready:true};const r={code:c,hostId:s.id,players:new Map([[s.id,p]]),started:false,created:Date.now()};rooms.set(c,r);s.data.room=c;s.data.name=p.name;s.join(c);s.emit('room:created',snapshot(r));});
 s.on('room:join',({name,code:c})=>{c=String(c||'').toUpperCase().slice(0,6);const r=rooms.get(c);if(!r)return error(s,'INVALID OR EXPIRED ROOM CODE.');if(r.started)return error(s,'MATCH ALREADY IN PROGRESS.');if(r.players.size>=MAX_PLAYERS)return error(s,'ROOM FULL — MAXIMUM 6 PLAYERS ALLOWED.');if(s.data.room)leave(s);const p={id:s.id,name:cleanName(name),ready:false};r.players.set(s.id,p);s.data.room=c;s.data.name=p.name;s.join(c);s.emit('room:joined',snapshot(r));s.to(c).emit('player:joined',{name:p.name});emitRoom(r);});
 s.on('room:ready',({ready})=>{const r=rooms.get(s.data.room);if(!r)return;const p=r.players.get(s.id);if(p)p.ready=!!ready;emitRoom(r);});
 s.on('room:leave',()=>leave(s));
 s.on('match:start',()=>{const r=rooms.get(s.data.room);if(!r)return;if(r.hostId!==s.id)return error(s,'ONLY THE HOST CAN START THE MATCH.');if(r.players.size<2)return error(s,'AT LEAST TWO PLAYERS ARE REQUIRED.');if([...r.players.values()].some(p=>!p.ready))return error(s,'WAITING FOR ALL PLAYERS TO READY UP.');r.started=true;io.to(r.code).emit('match:started',{code:r.code,seed:Date.now()});});
 s.on('player:state',state=>{const r=rooms.get(s.data.room);if(!r||!r.started)return;const safe={id:s.id,x:clamp(state.x,-65,65),y:clamp(state.y,0,8),z:clamp(state.z,-58,42),yaw:clamp(state.yaw,-100,100),pitch:clamp(state.pitch,-2,2)};s.to(r.code).emit('player:state',safe);});
 s.on('combat:fire',data=>{const r=rooms.get(s.data.room);if(!r||!r.started)return;const w=Math.max(0,Math.min(2,Number(data.weapon)||0));s.to(r.code).emit('combat:fire',{id:s.id,weapon:w});});
 s.on('disconnect',()=>leave(s));
});
function clamp(v,min,max){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):0;}
setInterval(()=>{const now=Date.now();for(const [c,r] of rooms)if(!r.players.size||now-r.created>6*60*60*1000)rooms.delete(c);},60000).unref();
const PORT=process.env.PORT||3001;
server.listen(PORT,'0.0.0.0',()=>console.log(`Harbor Siege server listening on ${PORT}`));
