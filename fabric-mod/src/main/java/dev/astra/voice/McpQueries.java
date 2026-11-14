package dev.astra.voice;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.function.BiConsumer;
import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.Vec3;

/** Read-only MCP observations, always accessed on the Minecraft tick thread. */
final class McpQueries {
    private static final ArrayDeque<String> chat = new ArrayDeque<>();
    static void recordChat(String text) { if (text.length() > 4096) text = text.substring(0,4096); chat.addLast(text); while(chat.size()>100)chat.removeFirst(); }
    static void clearChat() { chat.clear(); }
    private final Minecraft client;
    private final BiConsumer<JsonObject,JsonObject> reply;
    private JsonObject request;
    private Iterator<BlockPos> positions;
    private String blockType;
    private int wanted;
    private double radius;
    private Vec3 origin;
    private long deadline;
    private final java.util.PriorityQueue<BlockPos> found = new java.util.PriorityQueue<>((a,b)->Double.compare(origin.distanceToSqr(Vec3.atCenterOf(b)),origin.distanceToSqr(Vec3.atCenterOf(a))));
    McpQueries(Minecraft client, BiConsumer<JsonObject,JsonObject> reply) { this.client=client;this.reply=reply; }
    void cancel(String reason) { if(request!=null)finish(false,reason,null); }
    void start(JsonObject req) {
        if(request!=null){JsonObject error=new JsonObject();error.addProperty("success",false);error.addProperty("reason","Another block search is still running");reply.accept(req,error);return;}
        request=req;
        try {
            JsonObject wrapper=ActionValidation.object(req,"arguments"), args=ActionValidation.object(wrapper,"args");
            String tool=ActionValidation.string(wrapper,"tool","",64);
            JsonObject data=new JsonObject();
            switch(tool) {
                case "detect-gamemode" -> data.addProperty("gamemode",client.gameMode.getPlayerMode().getName());
                case "get-block-info" -> {
                    BlockPos pos=BlockPos.containing(ActionValidation.number(args,"x",Double.NaN,-30000000,30000000),ActionValidation.number(args,"y",Double.NaN,-2048,2048),ActionValidation.number(args,"z",Double.NaN,-30000000,30000000));
                    if(!client.level.hasChunkAt(pos))throw new IllegalArgumentException("The target chunk is not loaded");
                    data=WorldSnapshot.block(client,pos);
                }
                case "find-blocks" -> {
                    blockType=ActionValidation.string(args,"blockType","",128).replace("minecraft:","");
                    boolean known=BuiltInRegistries.BLOCK.keySet().stream().anyMatch(key->key.getPath().equals(blockType));
                    if(!known)throw new IllegalArgumentException("Unknown block type");
                    radius=ActionValidation.number(args,"maxDistance",16,0,128);
                    wanted=Math.min(256,(int)ActionValidation.number(args,"count",1,1,Integer.MAX_VALUE));
                    origin=client.player.position();int r=(int)Math.ceil(radius);BlockPos p=client.player.blockPosition();
                    positions=BlockPos.betweenClosed(p.offset(-r,-r,-r),p.offset(r,r,r)).iterator();found.clear();deadline=System.nanoTime()+25_000_000_000L;
                    return;
                }
                case "find-entity" -> {
                    String type=ActionValidation.string(args,"type","",128).toLowerCase();double range=ActionValidation.number(args,"maxDistance",16,0,512);Entity best=null;double distance=range*range;
                    for(Entity e:client.level.entitiesForRendering()){
                        if(e==client.player||!e.isAlive())continue;
                        String id=BuiltInRegistries.ENTITY_TYPE.getKey(e.getType()).getPath();
                        boolean match=type.isEmpty()||id.contains(type)||(type.equals("player")&&e instanceof net.minecraft.world.entity.player.Player)||(type.equals("mob")&&e instanceof net.minecraft.world.entity.Mob);
                        double d=e.distanceToSqr(client.player);if(match&&d<=distance){best=e;distance=d;}
                    }
                    if(best==null)data.addProperty("found",false);else{data.addProperty("found",true);data.addProperty("type",BuiltInRegistries.ENTITY_TYPE.getKey(best.getType()).getPath());data.addProperty("name",best.getName().getString());data.add("position",WorldSnapshot.position(best.position()));data.addProperty("distance",Math.sqrt(distance));}
                }
                case "read-chat" -> {int count=(int)ActionValidation.number(args,"count",10,0,100);JsonArray messages=new JsonArray();int skip=Math.max(0,chat.size()-count),index=0;for(String text:chat)if(index++>=skip)messages.add(text);data.add("messages",messages);}
                default -> throw new IllegalArgumentException("Unknown read-only MCP query");
            }
            finish(true,null,data);
        }catch(RuntimeException error){finish(false,error.getMessage(),null);}
    }
    void tick() {
        if(request==null||positions==null)return;
        if(client.level==null||client.player==null){finish(false,"World closed",null);return;}
        if(System.nanoTime()>deadline){finish(false,"Loaded-block search timed out; try a smaller maxDistance",null);return;}
        // Bound work per tick so a large query cannot freeze the game window.
        for(int i=0;i<4096&&positions.hasNext();i++){
            BlockPos pos=positions.next();
            if(!client.level.hasChunkAt(pos)||origin.distanceToSqr(Vec3.atCenterOf(pos))>radius*radius)continue;
            if(BuiltInRegistries.BLOCK.getKey(client.level.getBlockState(pos).getBlock()).getPath().equals(blockType)) {
                if(found.size()<wanted)found.add(pos.immutable());
                else if(origin.distanceToSqr(Vec3.atCenterOf(pos))<origin.distanceToSqr(Vec3.atCenterOf(found.peek()))){found.poll();found.add(pos.immutable());}
            }
        }
        if(positions.hasNext())return;
        ArrayList<BlockPos> ordered=new ArrayList<>(found);ordered.sort(Comparator.comparingDouble(p->origin.distanceToSqr(Vec3.atCenterOf(p))));JsonObject data=new JsonObject();JsonArray blocks=new JsonArray();for(BlockPos pos:ordered)blocks.add(WorldSnapshot.block(client,pos));data.add("blocks",blocks);data.addProperty("loadedOnly",true);finish(true,null,data);
    }
    private void finish(boolean success,String reason,JsonObject data){JsonObject req=request;request=null;positions=null;found.clear();JsonObject result=new JsonObject();result.addProperty("success",success);result.addProperty("action","mcp_query");if(reason!=null)result.addProperty("reason",reason);if(data!=null)result.add("data",data);if(req!=null)reply.accept(req,result);}
}
