# Modern Warfare Simulator

A lightweight Python simulation that models contemporary combined-arms warfare between two forces.

## Features
- Unit roles: infantry, armor, artillery, and drone formations.
- Terrain effects that favor different unit roles.
- Doctrine effects (`maneuver`, `attrition`, `network-centric`) including defensive posture impact.
- Electronic warfare, air-defense, mobility, morale, and supply/logistics modeling.
- Proportional loss distribution across unit types instead of only largest-unit depletion.
- Turn-based battle log with deterministic seeding support and structured per-turn summaries.

## Run
```bash
python modern_warfare_sim.py
```

## Test
```bash
pytest -q
```
