package dev.astra.voice;

import baritone.api.BaritoneAPI;
import baritone.api.IBaritone;
import baritone.api.pathing.goals.Goal;
import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.Vec3;

/** Owns a Baritone task for the same local player. All calls run on the client thread. */
final class BaritoneActions {
    private IBaritone bot;
    private boolean oldBreak, oldPlace, oldSprint;

    void move(Vec3 target, double radius, boolean canDig, boolean sprint) {
        begin(canDig, sprint);
        bot.getCustomGoalProcess().setGoalAndPath(new ArrivalGoal(target, radius));
    }
    void mine(BlockPos position) {
        begin(true, false);
        // A one-block air schematic gives Baritone an EXACT target, rather than mining
        // any block of the same type elsewhere. Completion is checked by our controller.
        bot.getBuilderProcess().clearArea(position, position);
    }
    private void begin(boolean canDig, boolean sprint) {
        stop();
        bot = BaritoneAPI.getProvider().getPrimaryBaritone();
        var settings = BaritoneAPI.getSettings();
        oldBreak = settings.allowBreak.value;
        oldPlace = settings.allowPlace.value;
        oldSprint = settings.allowSprint.value;
        settings.allowBreak.value = canDig;
        settings.allowPlace.value = false;
        settings.allowSprint.value = sprint;
    }
    boolean running() {
        return bot != null && (bot.getCustomGoalProcess().isActive()
            || bot.getBuilderProcess().isActive() || bot.getPathingBehavior().isPathing()
            || bot.getPathingBehavior().getInProgress().isPresent());
    }
    void stop() {
        if (bot == null) return;
        bot.getPathingBehavior().cancelEverything();
        bot.getInputOverrideHandler().clearAllKeys();
        var settings = BaritoneAPI.getSettings();
        settings.allowBreak.value = oldBreak;
        settings.allowPlace.value = oldPlace;
        settings.allowSprint.value = oldSprint;
        bot = null;
    }

    /** The planner and result verifier use the same arrival tolerance. */
    record ArrivalGoal(Vec3 target, double radius) implements Goal {
        @Override public boolean isInGoal(int x, int y, int z) {
            return arrived(target, radius, new Vec3(x + 0.5, y, z + 0.5));
        }
        @Override public double heuristic(int x, int y, int z) {
            return Math.max(0, Math.hypot(x + 0.5 - target.x, z + 0.5 - target.z) - radius)
                + Math.max(0, Math.abs(y - target.y) - 0.79);
        }
    }
    static boolean arrived(Vec3 target, double radius, Vec3 player) {
        return Math.hypot(player.x - target.x, player.z - target.z) <= radius
            && Math.abs(player.y - target.y) < 0.8;
    }
}
