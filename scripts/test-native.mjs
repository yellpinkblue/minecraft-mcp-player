import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import crypto from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {WebSocket} from 'ws';
import os from 'node:os';
class MinecraftMCP {
 async connect(_port,_username,options) {
  this.client=new Client({name:'native-contract',version:'1.0.0'});
  this.transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'dist/main.js'),'--control','player','--player-config',options.playerConfig],cwd:root,stderr:'pipe'});
  this.transport.stderr?.on('data',()=>{});
  await this.client.connect(this.transport);
  return (await this.client.listTools()).tools;
 }
 call(name,args,options={}) { return this.client.callTool({name,arguments:args},undefined,options); }
 async execute(name,raw,signal) {
  try {const value=await this.call(name.replace(/^mc_/,'').replaceAll('_','-'),JSON.parse(raw),{signal});return {success:!value.isError};}
  catch {return {success:false};}
 }
 async close(){await this.client?.close();}
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtureDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'minecraft-mcp-contract-'));
const configFile=path.join(fixtureDirectory,'config.json'),token=crypto.randomBytes(32).toString('hex');
fs.writeFileSync(configFile,JSON.stringify({bridgePort:17965,voicePort:17966,token}));
const mcp=new MinecraftMCP(root),out={cloudCalls:0,kind:'MCP transport and native dispatch contract; simulated Fabric peer'};let peer;let cancelSeen=false,delayAction=false;const actions=[];
const state={connected:true,position:{x:0,y:64,z:0},inventory:{items:[{name:'dirt',count:64,slot:0},{name:'oak_log',count:4,slot:1},{name:'oak_planks',count:8,slot:2},{name:'raw_iron',count:3,slot:3},{name:'coal',count:3,slot:4}]},mainHand:{name:'dirt',count:64},gameMode:'creative'};
try{
 const tools=await mcp.connect(0,'',{control:'player',playerConfig:configFile});out.toolCount=tools.length;
 assert.equal(tools.length,24);const before=await mcp.call('get-state',{});assert(before.isError);
 peer=new WebSocket('ws://127.0.0.1:17965/astra',{headers:{Authorization:'Bearer '+token}});await new Promise((resolve,reject)=>{peer.once('open',resolve);peer.once('error',reject);});
 const sendState=()=>peer.send(JSON.stringify({type:'state',sessionId:'fixture-session',controlEpoch:0,controlsEnabled:true,state}));
 peer.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome'){sendState();return;}if(m.type==='cancel'){cancelSeen=true;return;}if(m.type!=='action')return;actions.push({action:m.action,args:m.arguments});if(delayAction&&m.action==='move_near')return;
  sendState();peer.send(JSON.stringify({type:'result',sessionId:'fixture-session',requestId:m.requestId,result:{success:true,data:{verified:true,fixture:true}}}));
 });
 peer.send(JSON.stringify({type:'hello',protocolVersion:2,sessionId:'fixture-session',username:'MCPFixture',worldId:'fixture-only',controlEpoch:0,controlsEnabled:true,supportedActions:['mcp_query','control_player','move_near','look_at','mine_block','place_block','craft_item','smelt_item','equip_item','fly_to','say']}));
 await new Promise(r=>setTimeout(r,100));
 const check=JSON.parse((await mcp.call('get-state',{})).content[0].text);assert.equal(check.control.username,'MCPFixture');assert.equal(check.executor,'native-player');
 const xyz={x:1,y:64,z:1};
 const cases={
 'get-position':{},'move-to-position':xyz,'look-at':xyz,'jump':{},'move-in-direction':{direction:'back',duration:100},
 'list-inventory':{},'find-item':{nameOrType:'dirt'},'equip-item':{itemName:'dirt'},'place-block':xyz,'dig-block':xyz,
 'get-block-info':xyz,'find-blocks':{blockType:'dirt',count:2,maxDistance:4},'find-entity':{type:'cow'},'send-chat':{message:'hello'},'read-chat':{count:5},
 'fly-to':xyz,'detect-gamemode':{},'list-recipes':{outputItem:'oak_planks'},'craft-item':{outputItem:'oak_planks',amount:1},'get-recipe':{itemName:'oak_planks'},'can-craft':{itemName:'oak_planks'},
 'smelt-item':{...xyz,inputItem:'raw_iron',inputCount:2,fuelItem:'coal',fuelCount:1,takeOutput:false}
 };
 out.tested=[];for(const [name,args] of Object.entries(cases)){const value=await mcp.call(name,args);assert(!value.isError,`${name}: ${JSON.stringify(value)}`);out.tested.push(name);}
 assert.equal(out.tested.length,22);
 assert(actions.some(a=>a.action==='control_player'&&a.args.direction==='backward'));
 assert(actions.some(a=>a.action==='craft_item'&&a.args.amount===4));
 assert(actions.some(a=>a.action==='smelt_item'&&a.args.take_output===false&&a.args.fuel_count===1));
 delayAction=true;cancelSeen=false;const controller=new AbortController();const moving=mcp.execute('mc_move_to_position',JSON.stringify(xyz),controller.signal);await new Promise(r=>setTimeout(r,100));controller.abort();const interrupted=await moving;assert.equal(interrupted.success,false);await new Promise(r=>setTimeout(r,100));assert(cancelSeen,'Cancellation must reach the native player');
 out.cancelled=true;out.success=true;
}catch(error){out.success=false;out.error=error.stack;process.exitCode=1;}finally{await mcp.close();peer?.terminate();fs.rmSync(fixtureDirectory,{recursive:true,force:true});console.log(JSON.stringify(out));}
