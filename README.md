# Modern Warfare Simulator (HTML + Mobile)

This project is now a **mobile-friendly web app** for simulating modern combined-arms warfare in the browser.

## What’s new
- Rewritten from CLI Python to **HTML/CSS/JavaScript** app UI.
- **Responsive mobile support** with touch-friendly controls and breakpoints.
- Expanded unit model:
  - infantry, armor, artillery, drones, aircraft, naval, missiles, EW, air defense.
- Expanded scenario controls:
  - terrain, weather, civilians, escalation risk, logistics pressure.
- Advanced operations toggles:
  - cyber ops, satellite intel, special forces raids, air campaign.
- New UX capabilities:
  - randomize scenario, save/load scenario (localStorage), reset defaults.
- Result visualization:
  - winner summary, turn log, and personnel trend chart.

## Run locally
Open `index.html` directly in a browser, or serve the folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.
