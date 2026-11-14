package dev.astra.voice;

import net.minecraft.world.phys.Vec3;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BaritoneArrivalTest {
    @Test void plannerAndVerifierAgreeAtBlockCenters() {
        Vec3 target = new Vec3(10.5, 64, -3.5);
        var goal = new BaritoneActions.ArrivalGoal(target, 0.7);
        assertTrue(goal.isInGoal(10, 64, -4));
        assertTrue(BaritoneActions.arrived(target, 0.7, new Vec3(10.5, 64, -3.5)));
        assertFalse(goal.isInGoal(11, 64, -4));
    }
    @Test void nearbyOnAnotherFloorIsNotArrival() {
        Vec3 target = new Vec3(10.5, 64, -3.5);
        assertFalse(BaritoneActions.arrived(target, 2, new Vec3(10.5, 65, -3.5)));
        assertFalse(BaritoneActions.arrived(target, 2, new Vec3(10.5, 63, -3.5)));
    }
    @Test void nearGoalDoesNotRequireEnteringSolidTarget() {
        var goal = new BaritoneActions.ArrivalGoal(new Vec3(10.5, 64, -3.5), 1.5);
        assertTrue(goal.isInGoal(11, 64, -4));
        assertFalse(goal.isInGoal(12, 64, -4));
    }
}
