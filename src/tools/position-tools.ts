import { z } from "zod";
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import { ToolFactory } from '../tool-factory.js';
import { coerceCoordinates } from './coordinate-utils.js';

type Direction = 'forward' | 'back' | 'left' | 'right';

export function registerPositionTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  factory.registerTool(
    "get-position",
    "Get the current position of the bot",
    {},
    async () => {
      const bot = getBot();
      const position = bot.entity.position;
      const pos = {
        x: Math.floor(position.x),
        y: Math.floor(position.y),
        z: Math.floor(position.z)
      };
      return factory.createResponse(`Current position: (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  );

  factory.registerTool(
    "move-to-position",
    "Move the bot to a specific position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
      range: z.coerce.number().finite().optional().describe("How close to get to the target (default: 1)"),
      timeoutMs: z.number().int().min(50).optional().describe("Timeout in milliseconds before cancelling (min: 50, default: no timeout)")
    },
    async ({ x, y, z, range = 1, timeoutMs }: { x: number; y: number; z: number; range?: number; timeoutMs?: number }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));

      const bot = getBot();
      const goal = new goals.GoalNear(x, y, z, range);
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let timeoutPromise: Promise<never> | null = null;
      let timedOut = false;

      if (timeoutMs !== undefined) {
        timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            reject(new Error(`Move timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });
      }

      const gotoPromise = bot.pathfinder.goto(goal);

      try {
        if (timeoutPromise) {
          await Promise.race([gotoPromise, timeoutPromise]);
        } else {
          await gotoPromise;
        }
        return factory.createResponse(`Successfully moved to position near (${x}, ${y}, ${z})`);
      } catch (error) {
        if (timedOut) {
          throw new Error(`Move timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (timedOut) {
          bot.pathfinder.stop();
          gotoPromise.catch(() => {});
        }
      }
    }
  );

  factory.registerTool(
    "look-at",
    "Make the bot look at a specific position",
    {
      x: z.coerce.number().describe("X coordinate"),
      y: z.coerce.number().describe("Y coordinate"),
      z: z.coerce.number().describe("Z coordinate"),
    },
    async ({ x, y, z }) => {
      ({ x, y, z } = coerceCoordinates(x, y, z));

      const bot = getBot();
      await bot.lookAt(new Vec3(x, y, z), true);
      return factory.createResponse(`Looking at position (${x}, ${y}, ${z})`);
    }
  );

  factory.registerTool(
    "jump",
    "Make the bot jump",
    {},
    async () => {
      const bot = getBot();
      const startY = bot.entity.position.y;
      const epoch = ((bot as any).controlEpoch || 0);
      let peakY = startY;
      bot.setControlState('jump', true);
      try {
        for (let i = 0; i < 12; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          peakY = Math.max(peakY, bot.entity.position.y);
          if (((bot as any).controlEpoch || 0) !== epoch) return factory.createErrorResponse("Jump interrupted");
          if (i === 4) bot.setControlState('jump', false);
        }
      } finally { if (((bot as any).controlEpoch || 0) === epoch) bot.setControlState('jump', false); }
      return peakY - startY > 0.1 ? factory.createResponse(`Jump observed; vertical rise ${Math.round((peakY-startY)*100)/100} blocks.`) : factory.createErrorResponse("Jump was requested, but no upward movement was observed. Check space above and ground contact.");
    }
  );

  factory.registerTool(
    "move-in-direction",
    "Move the bot in a specific direction for a duration",
    {
      direction: z.enum(['forward', 'back', 'left', 'right']).describe("Direction to move"),
      duration: z.number().min(50).max(10000).optional().describe("Duration in milliseconds (default: 1000)")
    },
    async ({ direction, duration = 1000 }: { direction: Direction, duration?: number }) => {
      const bot = getBot();
      const epoch = ((bot as any).controlEpoch || 0);
      const start = bot.entity.position.clone();
      return new Promise((resolve) => {
        bot.setControlState(direction, true);
        setTimeout(() => {
          if (((bot as any).controlEpoch || 0) !== epoch) return resolve(factory.createErrorResponse("Movement interrupted"));
          bot.setControlState(direction, false);
          const distance = start.distanceTo(bot.entity.position);
          resolve(distance > 0.05 ? factory.createResponse(`Moved ${direction}; observed displacement ${distance.toFixed(2)} blocks.`) : factory.createErrorResponse("Movement requested, but no displacement observed."));
        }, duration);
      });
    }
  );
}
