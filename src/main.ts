#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupStdioFiltering } from './stdio-filter.js';
import { log } from './logger.js';
import { parseConfig } from './config.js';
import { BotConnection } from './bot-connection.js';
import { PlayerConnection } from './player-connection.js';
import { ToolFactory } from './tool-factory.js';
import { MessageStore } from './message-store.js';
import { registerPositionTools } from './tools/position-tools.js';
import { registerInventoryTools } from './tools/inventory-tools.js';
import { registerBlockTools } from './tools/block-tools.js';
import { registerEntityTools } from './tools/entity-tools.js';
import { registerChatTools } from './tools/chat-tools.js';
import { registerFlightTools } from './tools/flight-tools.js';
import { registerGameStateTools } from './tools/gamestate-tools.js';
import { registerCraftingTools } from './tools/crafting-tools.js';
import { registerFurnaceTools } from './tools/furnace-tools.js';

setupStdioFiltering();

process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  log('error', `Uncaught exception: ${error}`);
});

async function main() {
  const config = parseConfig();
  const messageStore = new MessageStore();

  const connection = config.control === 'player' ? new PlayerConnection(config) : new BotConnection(
    config,
    {
      onLog: log,
      onChatMessage: (username, message) => messageStore.addMessage(username, message)
    }
  );

  await connection.connect();

  const server = new McpServer({
    name: "minecraft-mcp-server",
    version: "2.0.4"
  });

  const factory = new ToolFactory(server, connection);
  const getBot = () => connection.getBot()!;

  factory.registerTool("stop-actions", "Immediately cancel pathfinding, digging and movement controls", {}, async () => {
    const bot = getBot();
    (bot as any).controlEpoch = ((bot as any).controlEpoch || 0) + 1;
    bot.pathfinder.setGoal(null);
    bot.clearControlStates();
    bot.stopDigging();
    return factory.createResponse("Stopped current movement and digging.");
  });
  factory.registerTool("get-state", "Inspect actual position, yaw, pitch, health, hunger, inventory, nearby players and the block in front of the bot", {}, async () => {
    const bot = getBot();
    const block = bot.blockAtCursor(5);
    return factory.createResponse(JSON.stringify({position:bot.entity.position,yaw:bot.entity.yaw,pitch:bot.entity.pitch,onGround:bot.entity.onGround,health:bot.health,food:bot.food,inventory:bot.inventory.items().map(i=>({name:i.name,count:i.count})),players:Object.values(bot.players).filter(p=>p.entity && p.username!==bot.username).map(p=>({name:p.username,position:p.entity!.position})),targetBlock:block?{name:block.name,position:block.position}:null}));
  });
  registerPositionTools(factory, getBot);
  registerInventoryTools(factory, getBot);
  registerBlockTools(factory, getBot);
  registerEntityTools(factory, getBot);
  registerChatTools(factory, getBot, messageStore);
  registerFlightTools(factory, getBot);
  registerGameStateTools(factory, getBot);
  registerCraftingTools(factory, getBot);
  registerFurnaceTools(factory, getBot);

  process.stdin.on('end', async () => {
    await connection.cleanup();
    log('info', 'MCP Client has disconnected. Shutting down...');
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  log('error', `Fatal error in main(): ${error}`);
  process.exit(1);
});
