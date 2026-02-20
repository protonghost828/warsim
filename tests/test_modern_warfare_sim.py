from modern_warfare_sim import (
    BattleConfig,
    Force,
    ModernWarfareSimulator,
    Terrain,
    Unit,
    _default_forces,
)


def test_simulation_produces_expected_keys():
    sim = ModernWarfareSimulator(rng_seed=1)
    blue, red = _default_forces()
    result = sim.simulate(blue, red, BattleConfig(turns=5, terrain=Terrain.OPEN))
    assert set(result.keys()) == {
        "winner",
        "blue_remaining",
        "red_remaining",
        "turns_fought",
        "battle_log",
        "turn_summaries",
    }
    assert result["turns_fought"] >= 1
    assert len(result["turn_summaries"]) == result["turns_fought"]


def test_logistics_penalty_reduces_combat_power():
    unit = Unit("Tank", "armor", 100, 2.0, 2.0, 1.0, logistics_load=1.5)
    force = Force("A", "maneuver", units=[unit], supply_level=1.0)
    power_full = force.aggregate(Terrain.OPEN)["combat"]
    force.supply_level = 0.45
    power_low_supply = force.aggregate(Terrain.OPEN)["combat"]
    assert power_low_supply < power_full


def test_doctrine_advantage_changes_outcome_shape():
    sim = ModernWarfareSimulator(rng_seed=2)
    net_force = Force(
        name="Net",
        doctrine="network-centric",
        intel_quality=0.9,
        units=[Unit("Inf", "infantry", 2000, 1.0, 0.5, 1.0, electronic_warfare=0.5)],
    )
    old_force = Force(
        name="Old",
        doctrine="unknown",
        intel_quality=0.4,
        units=[Unit("Inf", "infantry", 2000, 1.0, 0.5, 1.0, electronic_warfare=0.05)],
    )
    result = sim.simulate(net_force, old_force, BattleConfig(turns=3, terrain=Terrain.OPEN))
    assert result["blue_remaining"] != result["red_remaining"]


def test_attrition_doctrine_has_higher_protection_than_maneuver_when_even_forces():
    sim = ModernWarfareSimulator(rng_seed=11)
    maneuver = Force(
        name="Maneuver",
        doctrine="maneuver",
        intel_quality=0.6,
        units=[Unit("Inf", "infantry", 2500, 1.0, 0.6, 1.0, air_defense=0.1)],
    )
    attrition = Force(
        name="Attrition",
        doctrine="attrition",
        intel_quality=0.6,
        units=[Unit("Inf", "infantry", 2500, 1.0, 0.6, 1.0, air_defense=0.1)],
    )

    m_snapshot = maneuver.aggregate(Terrain.OPEN)
    a_snapshot = attrition.aggregate(Terrain.OPEN)
    assert sim._compute_protection(a_snapshot, attrition.doctrine) > sim._compute_protection(m_snapshot, maneuver.doctrine)


def test_losses_are_distributed_across_unit_types_not_just_largest():
    f = Force(
        name="F",
        doctrine="unknown",
        units=[
            Unit("Large", "infantry", 1000, 1, 1, 1),
            Unit("Small", "drone", 200, 1, 1, 1),
        ],
    )
    f.apply_losses(300)
    assert f.units[0].count < 1000
    assert f.units[1].count < 200
