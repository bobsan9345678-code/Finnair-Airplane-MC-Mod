import { world, system } from "@minecraft/server";

const planesData = new Map();

system.runInterval(() => {
  for (const dimension of ["overworld", "nether", "the_end"]) {
    const dim = world.getDimension(dimension);
    const planes = dim.getEntities({ type: "custom:finnair_plane" });

    for (const plane of planes) {
      const riders = plane.getComponent("minecraft:rideable")?.getRiders();
      const pilot = riders && riders.length > 0 ? riders[0] : null;

      let data = planesData.get(plane.id) || {
        fuelTicks: 1200,
        noFuelTimer: 0,
        isWarning: false
      };

      const inv = plane.getComponent("minecraft:inventory")?.container;
      if (inv) {
        for (let i = 0; i < inv.size; i++) {
          const item = inv.getItem(i);
          if (item && (item.typeId === "minecraft:coal" || item.typeId === "minecraft:charcoal")) {
            inv.setItem(i, null);
            data.fuelTicks += 400;
            data.noFuelTimer = 0;
            data.isWarning = false;
            dim.runCommand(`stopsound @a[x=${plane.location.x},y=${plane.location.y},z=${plane.location.z},r=50] custom.alarm`);
          }
        }
      }

      if (pilot && data.fuelTicks > 0) {
        data.fuelTicks--;

        if (system.currentTick % 20 === 0) {
          dim.runCommand(`playsound custom.engine_fly @a[x=${plane.location.x},y=${plane.location.y},z=${plane.location.z},r=30] ~ ~ ~ 0.8`);
        }

        const viewVec = pilot.getViewDirection();

        if (viewVec.y < -0.6 && plane.location.y < 80) {
          triggerAlarm(dim, plane, data);
        } else if (data.fuelTicks > 0) {
          if (data.isWarning && data.noFuelTimer === 0) {
            data.isWarning = false;
            dim.runCommand(`stopsound @a[x=${plane.location.x},y=${plane.location.y},z=${plane.location.z},r=50] custom.alarm`);
          }
        }

        plane.applyImpulse({
          x: viewVec.x * 0.4,
          y: viewVec.y * 0.4,
          z: viewVec.z * 0.4
        });

      } else {
        data.noFuelTimer++;
        triggerAlarm(dim, plane, data);

        if (data.noFuelTimer >= 240 || plane.isOnGround || plane.isInWater) {
          crashAndExplode(dim, plane);
          planesData.delete(plane.id);
          continue;
        }
      }

      planesData.set(plane.id, data);
    }
  }
}, 1);

function triggerAlarm(dimension, plane, data) {
  if (!data.isWarning) {
    data.isWarning = true;
    dimension.runCommand(`playsound custom.alarm @a[x=${plane.location.x},y=${plane.location.y},z=${plane.location.z},r=50] ~ ~ ~ 1.0`);
  }
}

function crashAndExplode(dimension, plane) {
  const loc = plane.location;
  dimension.runCommand(`stopsound @a[x=${loc.x},y=${loc.y},z=${loc.z},r=60] custom.alarm`);
  dimension.runCommand(`playsound custom.crash @a[x=${loc.x},y=${loc.y},z=${loc.z},r=100] ~ ~ ~ 1.0`);
  dimension.createExplosion(loc, 6, { causesFire: true, breaksBlocks: true });
  plane.remove();
}
