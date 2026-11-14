import fs from 'node:fs';
import path from 'node:path';
import {createServer, type Server} from 'node:http';
import {randomUUID, timingSafeEqual} from 'node:crypto';
import {createRequire} from 'node:module';
import minecraftData from 'minecraft-data';
import {ServerConfig} from './config.js';

type Args = Record<string, any>;
type Result = {content:{type:'text';text:string}[];isError?:boolean;[key:string]:unknown};
const result=(value:unknown,error=false):Result=>({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}],...(error?{isError:true}:{})});
const coord=(a:Args)=>({x:Number(a.x),y:Number(a.y),z:Number(a.z)});
const normalize=(s:string)=>s.toLowerCase().replace(/^minecraft:/,'').replace(/\s+/g,'_');

/** MCP backend for the logged-in client player. Never creates a Mineflayer connection. */
export class PlayerConnection {
 private server?:Server;private sockets:any;private socket:any;private heartbeat?:NodeJS.Timeout;
 private session:any;private state:any;private stateAt=0;private token='';private nativePort=8765;
 private pending=new Map<string,{resolve:(v:any)=>void;timer:NodeJS.Timeout;epoch:number;cleanup:()=>void}>();
 private data:any=minecraftData('1.21.11');private quitting=false;
 constructor(private config:ServerConfig){}
 getBot():never {throw Error('Mineflayer is disabled: this MCP controls the native Minecraft player');}
 isConnected(){return Boolean(this.socket?.readyState===1&&this.session&&this.state?.connected&&Date.now()-this.stateAt<3000);}
 async checkConnectionAndReconnect(){return this.isConnected()?{connected:true}:{connected:false,message:'Open Minecraft Fabric 1.21.11 and enter a world. No LAN opening or second player is required.'};}
 async connect(){
  if(!this.config.playerConfig)throw Error('--player-config must point to Minecraft config/astra-voice.json');
  const pair=JSON.parse(fs.readFileSync(this.config.playerConfig,'utf8').replace(/^\uFEFF/,''));
  this.token=pair.token;this.nativePort=pair.bridgePort;
  if(!/^[a-fA-F0-9]{64}$/.test(this.token)||!Number.isInteger(this.nativePort)||this.nativePort<1024||this.nativePort>65535)throw Error('Invalid local Fabric pairing settings');
  const require=createRequire(import.meta.url);
  const ws=require(process.env.MINECRAFT_PLAYER_PROJECT?path.join(process.env.MINECRAFT_PLAYER_PROJECT,'node_modules','ws'):'ws');
  this.sockets=new ws.WebSocketServer({noServer:true,maxPayload:512*1024,perMessageDeflate:false});
  this.server=createServer((req,res)=>{
   if(req.url!=='/astra/health'){res.writeHead(404);res.end();return;}
   if(!this.authorized(req)){res.writeHead(403);res.end();return;}
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({app:'astra-fabric-backend',protocolVersion:2,voicePort:pair.voicePort,ready:true}));
  });
  this.server.on('upgrade',(req,socket,head)=>{if(req.url!=='/astra'||!this.authorized(req)||this.socket){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}this.sockets.handleUpgrade(req,socket,head,(client:any)=>{
   this.socket=client;
   const deadline=setTimeout(()=>{if(!this.session)client.terminate();},5000);
   client.on('message',(raw:Buffer,binary:boolean)=>{if(this.socket!==client)return;if(binary){client.terminate();return;}try{this.receive(JSON.parse(raw.toString()));}catch{client.terminate();}});
   client.on('error',()=>{});client.on('close',()=>{clearTimeout(deadline);if(this.socket===client){this.cancel('Minecraft disconnected');this.socket=null;this.session=null;this.state=null;}});
  });});
  await new Promise<void>((resolve,reject)=>{this.server!.once('error',reject);this.server!.listen(this.nativePort,'127.0.0.1',()=>resolve());});
  this.heartbeat=setInterval(()=>{this.send({type:'heartbeat'});if(this.state&&Date.now()-this.stateAt>3000)this.socket?.terminate();},1000);
 }
 private authorized(req:any){const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');return req.headers.host===`127.0.0.1:${this.nativePort}`&&!req.headers.origin&&/^[a-fA-F0-9]{64}$/.test(supplied)&&timingSafeEqual(Buffer.from(supplied),Buffer.from(this.token));}
 private send(value:any){if(this.socket?.readyState===1)this.socket.send(JSON.stringify(value));}
 private receive(m:any){
  if(m.type==='hello'){
   if(m.protocolVersion!==2||typeof m.sessionId!=='string'||!Array.isArray(m.supportedActions)||!Number.isInteger(m.controlEpoch))throw Error('Invalid Fabric hello');
   this.cancel('World changed');this.state=null;this.session=m;
   this.send({type:'welcome',protocolVersion:2,sessionId:m.sessionId,unrestricted:true,nativeMcp:true});return;
  }
  if(!this.session||m.sessionId!==this.session.sessionId)return;
  if(m.type==='session_end'){this.cancel('World closed');this.session=null;this.state=null;return;}
  if(m.type==='result'){const pending=this.pending.get(m.requestId);if(pending&&pending.epoch===this.session.controlEpoch){this.pending.delete(m.requestId);pending.cleanup();pending.resolve(m.result);}return;}
  if(m.type!=='state'&&m.type!=='control')return;
  if(!Number.isInteger(m.controlEpoch)||m.controlEpoch<this.session.controlEpoch)return;
  if(m.controlEpoch>this.session.controlEpoch)this.cancel('Player control changed');
  this.session.controlEpoch=m.controlEpoch;this.session.controlsEnabled=m.type==='state'?m.controlsEnabled:m.enabled;
  if(m.type==='state'){
   if(!m.state?.connected||!['x','y','z'].every(k=>Number.isFinite(m.state.position?.[k]))||!Array.isArray(m.state.inventory?.items))throw Error('Invalid player snapshot');
   this.state=m.state;this.stateAt=Date.now();
  }
 }
 private cancel(reason:string){this.send({type:'cancel',sessionId:this.session?.sessionId,reason});for(const p of this.pending.values()){p.cleanup();p.resolve({success:false,reason});}this.pending.clear();}
 private async action(action:string,args:Args,signal?:AbortSignal,timeout=60000):Promise<any>{
  if(!this.isConnected())throw Error('No fresh native player connection');
  if(!this.session.supportedActions.includes(action))throw Error(`Update the Fabric mod: ${action} is unavailable`);
  if(action!=='mcp_query'&&!this.session.controlsEnabled)throw Error('Player control was stopped. Press F8 in Minecraft to re-enable it.');
  if(action!=='mcp_query'&&this.state.screen)throw Error('Close the Minecraft menu ('+this.state.screen+') before performing game actions.');
  if(signal?.aborted)throw Error('Action cancelled');
  const requestId=randomUUID();
  const value=await new Promise<any>(resolve=>{
   const abort=()=>this.cancel('Action interrupted');
   const timer=setTimeout(()=>{this.send({type:'cancel',sessionId:this.session?.sessionId,requestId,reason:'MCP action timed out'});const p=this.pending.get(requestId);if(p){this.pending.delete(requestId);p.cleanup();resolve({success:false,reason:'MCP action timed out'});}},timeout+1500);
   this.pending.set(requestId,{resolve,timer,epoch:this.session.controlEpoch,cleanup:()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);}});
   signal?.addEventListener('abort',abort,{once:true});
   this.send({type:'action',sessionId:this.session.sessionId,controlEpoch:this.session.controlEpoch,requestId,action,arguments:args,timeoutMs:timeout});
  });
  if(!value?.success)throw Error(value?.reason||'Minecraft did not confirm the action');
  return value.data??value;
 }
 private snapshot(){if(!this.isConnected())throw Error('Minecraft is not connected');return structuredClone(this.state);}
 private items(){return this.snapshot().inventory.items;}
 private resolveItem(query:string){const name=normalize(query);const items=this.items();return items.find((i:any)=>i.name===name)||items.find((i:any)=>i.name.includes(name));}
 private recipes(query:string){
  const name=normalize(query);const candidates=Object.values(this.data.itemsByName).filter((i:any)=>i.name===name||i.name.includes(name)).sort((a:any,b:any)=>Number(b.name===name)-Number(a.name===name)) as any[];
  return candidates.flatMap(item=>(this.data.recipes[item.id]||[]).flatMap((r:any)=>{
   const width=(r.ingredients?.length||0)<=4?2:3;
   const shape=r.inShape||(r.ingredients?Array.from({length:Math.ceil(r.ingredients.length/width)},(_,row)=>r.ingredients.slice(row*width,row*width+width)):[]);
   if(!shape.length||shape.length>3||shape.some((row:any)=>row.length>3))return [];
   let valid=true;const ingredients:Record<string,number>={};
   const grid=shape.map((row:any)=>row.map((id:any)=>{if(id===null||id===-1)return null;const n=this.data.items[id]?.name;if(!n){valid=false;return null;}ingredients[n]=(ingredients[n]||0)+1;return n;}));
   return valid?[{output:item.name,count:r.result.count,ingredients,grid,table:grid.length>2||grid.some((row:any)=>row.length>2)}]:[];
  }));
 }
 private crafting(query:string){const counts:Record<string,number>={};for(const i of this.items())counts[i.name]=(counts[i.name]||0)+i.count;return this.recipes(query).map(r=>({...r,missing:Object.entries(r.ingredients as Record<string,number>).filter(([n,c])=>(counts[n]||0)<c).map(([name,count])=>({name,count:count-(counts[name]||0)}))}));}
 async callTool(name:string,a:Args,signal?:AbortSignal):Promise<Result>{
  try{
   if(name==='stop-actions'){this.cancel('Stopped by user');return result('Stopped player actions');}
   if(name==='get-state')return result({...this.snapshot(),control:{enabled:this.session.controlsEnabled,username:this.session.username},executor:'native-player'});
   if(name==='get-position')return result(this.snapshot().position);
   if(name==='list-inventory')return result(this.items());
   if(name==='find-item')return result(this.resolveItem(a.nameOrType)||'No matching item in your inventory');
   if(['get-block-info','find-blocks','find-entity','detect-gamemode','read-chat'].includes(name))return result(await this.action('mcp_query',{tool:name,args:a},signal,30000));
   if(['get-recipe','can-craft','list-recipes'].includes(name)){
    const recipes=this.crafting(a.itemName||a.outputItem||'');
    if(name==='can-craft')return result({canCraft:recipes.some(r=>!r.missing.length),recipes});
    return result(name==='list-recipes'?recipes.filter(r=>!r.missing.length):recipes);
   }
   if(name==='equip-item'){const item=this.resolveItem(a.itemName);if(!item)throw Error('Item is not in your inventory');return result(await this.action('equip_item',{item:item.name,destination:a.destination||'hand'},signal));}
   if(name==='look-at')return result(await this.action('look_at',{target:coord(a)},signal));
   if(name==='jump'||name==='move-in-direction'){
    const before=this.snapshot().position;
    const command=name==='jump'?'jump':'walk',duration=name==='jump'?350:(a.duration??1000);
    const data=await this.action('control_player',{command,direction:a.direction==='back'?'backward':a.direction,duration_ms:duration},signal,Math.max(2000,duration+1000));
    return result({command,before,after:this.snapshot().position,...data});
   }
   if(name==='move-to-position')return result(await this.action('move_near',{position:coord(a),radius:a.range??1,can_dig:false},signal,a.timeoutMs??60000));
   if(name==='dig-block')return result(await this.action('mine_block',{position:coord(a)},signal,60000));
   if(name==='place-block'){
    const held=this.snapshot().mainHand;
    if(!held?.name)throw Error('Equip a placeable block first');
    const p=this.snapshot().position;
    if(Math.hypot(a.x-p.x,a.y-p.y,a.z-p.z)>4)await this.action('move_near',{position:coord(a),radius:2,can_dig:false},signal,45000);
    return result(await this.action('place_block',{position:coord(a),item:held.name,face_direction:a.faceDirection||'down'},signal));
   }
   if(name==='fly-to')return result(await this.action('fly_to',{position:coord(a)},signal,20000));
   if(name==='send-chat')return result(await this.action('say',{message:a.message},signal));
   if(name==='craft-item'){
    const recipe=this.crafting(a.outputItem).find(r=>!r.missing.length);if(!recipe)throw Error('No supported recipe with sufficient ingredients');
    return result(await this.action('craft_item',{item:recipe.output,amount:recipe.count*(a.amount??1),grid:recipe.grid,output_count:recipe.count,table:recipe.table,allow_place:true},signal));
   }
   if(name==='smelt-item')return result(await this.action('smelt_item',{input:a.inputItem,amount:a.inputCount??1,fuel:a.fuelItem,fuel_count:a.fuelCount??1,take_output:a.takeOutput??true,furnace_position:coord(a),mcp:true},signal,a.timeoutMs??60000));
   throw Error(`No native player implementation for ${name}`);
  }catch(error){return result(error instanceof Error?error.message:String(error),true);}
 }
 async cleanup(){if(this.quitting)return;this.quitting=true;clearInterval(this.heartbeat);this.cancel('MCP closed');this.socket?.terminate();this.socket=null;await new Promise<void>(resolve=>{if(this.server?.listening)this.server.close(()=>resolve());else resolve();});this.sockets?.close();}
}
