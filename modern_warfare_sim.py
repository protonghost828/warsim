"""Modern warfare simulator.

Run directly to simulate a battle:
    python modern_warfare_sim.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import random
from typing import Dict, List


class Terrain(Enum):
    URBAN = "urban"
    OPEN = "open"
    FOREST = "forest"
    DESERT = "desert"


@dataclass
class Unit:
    name: str
    role: str
    count: int
    firepower: float
    armor: float
    mobility: float
    electronic_warfare: float = 0.0
    air_defense: float = 0.0
    logistics_load: float = 1.0

    def combat_power(self, terrain: Terrain, supply_level: float) -> float:
        terrain_mod = {
            Terrain.URBAN: {"infantry": 1.25, "armor": 0.8, "artillery": 1.0, "drone": 1.1},
            Terrain.OPEN: {"infantry": 0.95, "armor": 1.2, "artillery": 1.1, "drone": 1.0},
            Terrain.FOREST: {"infantry": 1.15, "armor": 0.75, "artillery": 0.95, "drone": 0.9},
            Terrain.DESERT: {"infantry": 0.9, "armor": 1.05, "artillery": 1.05, "drone": 1.15},
        }
        role_mod = terrain_mod[terrain].get(self.role, 1.0)
        readiness = max(0.25, min(1.0, supply_level / max(self.logistics_load, 0.2)))
        return self.count * self.firepower * role_mod * readiness


@dataclass
class Force:
    name: str
    doctrine: str
    units: List[Unit] = field(default_factory=list)
    supply_level: float = 1.0
    morale: float = 1.0
    intel_quality: float = 0.5

    def aggregate(self, terrain: Terrain) -> Dict[str, float]:
        combat = sum(u.combat_power(terrain, self.supply_level) for u in self.units)
        armor = sum(u.count * u.armor for u in self.units)
        ew = sum(u.count * u.electronic_warfare for u in self.units)
        ad = sum(u.count * u.air_defense for u in self.units)
        mobility = sum(u.count * u.mobility for u in self.units)
        personnel = sum(u.count for u in self.units)
        return {
            "combat": combat * self.morale,
            "armor": armor,
            "ew": ew,
            "air_defense": ad,
            "mobility": mobility,
            "personnel": personnel,
        }

    def apply_losses(self, losses: int) -> None:
        if losses <= 0:
            return

        total = sum(u.count for u in self.units)
        if total <= 0:
            return

        # Distribute losses proportionally to unit size, then consume remainder.
        applied = 0
        for unit in self.units:
            if unit.count <= 0:
                continue
            take = min(unit.count, int(losses * (unit.count / total)))
            unit.count -= take
            applied += take

        remaining = max(0, losses - applied)
        for unit in sorted(self.units, key=lambda u: u.count, reverse=True):
            if remaining <= 0:
                break
            if unit.count <= 0:
                continue
            take = min(unit.count, remaining)
            unit.count -= take
            remaining -= take

        self.morale = max(0.45, self.morale - losses / 12000)


@dataclass
class BattleConfig:
    turns: int = 8
    terrain: Terrain = Terrain.OPEN
    weather_penalty: float = 0.0
    civilian_presence: float = 0.1


@dataclass
class BattleTurn:
    turn: int
    blue_losses_inflicted: int
    red_losses_inflicted: int
    blue_remaining: int
    red_remaining: int


class ModernWarfareSimulator:
    def __init__(self, rng_seed: int | None = None):
        self.random = random.Random(rng_seed)

    def _doctrine_mod(self, doctrine: str) -> Dict[str, float]:
        doctrine = doctrine.lower()
        if doctrine == "maneuver":
            return {"offense": 1.12, "defense": 0.95, "ew": 1.0}
        if doctrine == "attrition":
            return {"offense": 0.95, "defense": 1.1, "ew": 1.0}
        if doctrine == "network-centric":
            return {"offense": 1.05, "defense": 1.0, "ew": 1.2}
        return {"offense": 1.0, "defense": 1.0, "ew": 1.0}

    def _compute_effectiveness(self, own: Dict[str, float], enemy: Dict[str, float], doctrine: str, intel: float) -> float:
        d = self._doctrine_mod(doctrine)
        offense = own["combat"] * d["offense"]
        ew_edge = (own["ew"] * d["ew"] + 1.0) / (enemy["ew"] + 1.0)
        intel_edge = 0.8 + max(0.0, min(0.4, intel))
        mobility_edge = (own["mobility"] + 1.0) / (enemy["mobility"] + 1.0)
        air_survival = (own["air_defense"] + 1.0) / (enemy["air_defense"] + 1.0)
        return offense * ew_edge * intel_edge * (0.85 + 0.15 * mobility_edge) * (0.9 + 0.1 * air_survival)

    def _compute_protection(self, force_snapshot: Dict[str, float], doctrine: str) -> float:
        d = self._doctrine_mod(doctrine)
        armor_factor = 1.0 + force_snapshot["armor"] / max(1.0, force_snapshot["personnel"] * 8)
        ad_factor = 1.0 + force_snapshot["air_defense"] / max(1.0, force_snapshot["personnel"] * 15)
        return d["defense"] * armor_factor * ad_factor

    def simulate(self, blue: Force, red: Force, cfg: BattleConfig) -> Dict[str, object]:
        log: List[str] = []
        turns: List[BattleTurn] = []

        for turn in range(1, cfg.turns + 1):
            b = blue.aggregate(cfg.terrain)
            r = red.aggregate(cfg.terrain)

            b_eff = self._compute_effectiveness(b, r, blue.doctrine, blue.intel_quality)
            r_eff = self._compute_effectiveness(r, b, red.doctrine, red.intel_quality)

            b_protection = self._compute_protection(b, blue.doctrine)
            r_protection = self._compute_protection(r, red.doctrine)

            weather_effect = max(0.5, 1.0 - cfg.weather_penalty)
            civilian_constraint = max(0.6, 1.0 - cfg.civilian_presence * 0.2)
            chaos = self.random.uniform(0.9, 1.1)

            b_damage = int(max(0, b_eff / max(1.0, r_protection) / 170 * weather_effect * civilian_constraint * chaos))
            r_damage = int(max(0, r_eff / max(1.0, b_protection) / 170 * weather_effect * civilian_constraint * chaos))

            red.apply_losses(b_damage)
            blue.apply_losses(r_damage)

            blue.supply_level = max(0.35, blue.supply_level - 0.03)
            red.supply_level = max(0.35, red.supply_level - 0.03)

            blue_remaining = sum(u.count for u in blue.units)
            red_remaining = sum(u.count for u in red.units)
            turns.append(
                BattleTurn(
                    turn=turn,
                    blue_losses_inflicted=b_damage,
                    red_losses_inflicted=r_damage,
                    blue_remaining=blue_remaining,
                    red_remaining=red_remaining,
                )
            )

            log.append(
                f"Turn {turn}: Blue inflicted {b_damage} losses, Red inflicted {r_damage} losses. "
                f"Remaining - Blue: {blue_remaining}, Red: {red_remaining}"
            )

            if blue_remaining <= 0 or red_remaining <= 0:
                break

        blue_remaining = sum(u.count for u in blue.units)
        red_remaining = sum(u.count for u in red.units)
        winner = "Draw"
        if blue_remaining > red_remaining:
            winner = blue.name
        elif red_remaining > blue_remaining:
            winner = red.name

        return {
            "winner": winner,
            "blue_remaining": blue_remaining,
            "red_remaining": red_remaining,
            "turns_fought": len(log),
            "battle_log": log,
            "turn_summaries": [t.__dict__ for t in turns],
        }


def _default_forces() -> tuple[Force, Force]:
    blue = Force(
        name="Blue Coalition",
        doctrine="network-centric",
        intel_quality=0.82,
        units=[
            Unit("Mechanized Infantry", "infantry", 4200, 1.05, 0.7, 1.0, electronic_warfare=0.25, air_defense=0.18),
            Unit("Main Battle Tanks", "armor", 520, 2.1, 2.5, 1.15, air_defense=0.06, logistics_load=1.4),
            Unit("Tube/Rocket Artillery", "artillery", 340, 2.6, 0.4, 0.6, logistics_load=1.2),
            Unit("Drone Swarm Units", "drone", 900, 0.75, 0.1, 1.25, electronic_warfare=0.35),
        ],
    )
    red = Force(
        name="Red Front",
        doctrine="attrition",
        intel_quality=0.66,
        units=[
            Unit("Motor Rifle", "infantry", 5000, 0.95, 0.65, 0.9, electronic_warfare=0.15, air_defense=0.2),
            Unit("Armored Battalion", "armor", 600, 1.95, 2.3, 1.05, air_defense=0.08, logistics_load=1.45),
            Unit("Rocket Artillery", "artillery", 420, 2.35, 0.35, 0.55, logistics_load=1.25),
            Unit("EW/Recon Drones", "drone", 760, 0.62, 0.1, 1.2, electronic_warfare=0.3),
        ],
    )
    return blue, red


def main() -> None:
    sim = ModernWarfareSimulator(rng_seed=7)
    blue, red = _default_forces()
    result = sim.simulate(
        blue,
        red,
        BattleConfig(turns=10, terrain=Terrain.URBAN, weather_penalty=0.06, civilian_presence=0.28),
    )
    print(f"Winner: {result['winner']}")
    for line in result["battle_log"]:
        print(line)


if __name__ == "__main__":
    main()
