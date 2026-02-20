const UNIT_KEYS = [
  "infantry",
  "armor",
  "artillery",
  "drones",
  "aircraft",
  "naval",
  "missiles",
  "ew",
  "airDefense"
];

const TERRAIN_MODS = {
  Urban: { infantry: 1.2, armor: 0.8, artillery: 1.0, drones: 1.1, aircraft: 0.9, naval: 0.4, missiles: 1.0 },
  Open: { infantry: 0.95, armor: 1.2, artillery: 1.1, drones: 1.0, aircraft: 1.1, naval: 0.6, missiles: 1.0 },
  Forest: { infantry: 1.15, armor: 0.75, artillery: 0.9, drones: 0.85, aircraft: 0.9, naval: 0.4, missiles: 0.95 },
  Desert: { infantry: 0.9, armor: 1.05, artillery: 1.05, drones: 1.15, aircraft: 1.1, naval: 0.5, missiles: 1.05 },
  Mountain: { infantry: 1.15, armor: 0.65, artillery: 0.95, drones: 0.8, aircraft: 0.85, naval: 0.2, missiles: 1.1 },
  Coastal: { infantry: 1.0, armor: 0.95, artillery: 1.0, drones: 1.0, aircraft: 1.05, naval: 1.25, missiles: 1.1 }
};

const WEATHER_MODS = {
  Clear: 1,
  Rain: 0.94,
  Storm: 0.86,
  Snow: 0.89,
  Sandstorm: 0.84
};

const defaults = {
  blue: { infantry: 4200, armor: 520, artillery: 340, drones: 900, aircraft: 180, naval: 90, missiles: 140, ew: 260, airDefense: 220, doctrine: "network" },
  red: { infantry: 5000, armor: 600, artillery: 420, drones: 760, aircraft: 160, naval: 70, missiles: 170, ew: 230, airDefense: 260, doctrine: "attrition" }
};

function createForceInputs(containerId, sideDefaults) {
  const root = document.getElementById(containerId);
  root.innerHTML = "";

  UNIT_KEYS.forEach((k) => {
    const label = document.createElement("label");
    label.textContent = k;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = sideDefaults[k];
    input.id = `${containerId}_${k}`;
    label.appendChild(input);
    root.appendChild(label);
  });

  const doctrine = document.createElement("label");
  doctrine.textContent = "doctrine";
  doctrine.innerHTML += `
    <select id="${containerId}_doctrine">
      <option value="maneuver">maneuver</option>
      <option value="attrition">attrition</option>
      <option value="network" selected>network-centric</option>
      <option value="asymmetric">asymmetric</option>
    </select>
  `;
  doctrine.querySelector("select").value = sideDefaults.doctrine;
  root.appendChild(doctrine);
}

function getForce(containerId) {
  const force = {};
  UNIT_KEYS.forEach((k) => {
    force[k] = Number(document.getElementById(`${containerId}_${k}`).value || 0);
  });
  force.doctrine = document.getElementById(`${containerId}_doctrine`).value;
  force.morale = 1;
  force.supply = 1;
  return force;
}

function doctrineMod(doc) {
  if (doc === "maneuver") return { off: 1.12, def: 0.94, intel: 1.02 };
  if (doc === "attrition") return { off: 0.96, def: 1.12, intel: 0.95 };
  if (doc === "asymmetric") return { off: 1.02, def: 1.0, intel: 1.05 };
  return { off: 1.05, def: 1.0, intel: 1.12 };
}

function combatScore(force, terrain, weather, options) {
  const t = TERRAIN_MODS[terrain];
  const w = WEATHER_MODS[weather];
  const d = doctrineMod(force.doctrine);

  const base =
    force.infantry * 1.0 * t.infantry +
    force.armor * 2.1 * t.armor +
    force.artillery * 2.4 * t.artillery +
    force.drones * 0.8 * t.drones +
    force.aircraft * 2.0 * t.aircraft +
    force.naval * 2.2 * t.naval +
    force.missiles * 2.6 * t.missiles;

  let special = 1;
  if (options.useCyber) special += Math.min(0.15, force.ew / 2000);
  if (options.useSatIntel) special += 0.08;
  if (options.useSpecialForces) special += 0.05;
  if (options.useAirCampaign) special += Math.min(0.2, force.aircraft / 1500);

  return base * d.off * d.intel * w * force.morale * force.supply * special;
}

function protectionScore(force) {
  const d = doctrineMod(force.doctrine);
  const armorLayer = 1 + force.armor / 6000;
  const adLayer = 1 + force.airDefense / 4000;
  const ewLayer = 1 + force.ew / 7000;
  return d.def * armorLayer * adLayer * ewLayer;
}

function totalPersonnel(force) {
  return force.infantry + force.armor + force.artillery + force.drones + force.aircraft + force.naval + force.missiles;
}

function applyLosses(force, losses) {
  let total = totalPersonnel(force);
  if (total <= 0 || losses <= 0) return;

  UNIT_KEYS.filter(k => !["ew", "airDefense"].includes(k)).forEach((k) => {
    const share = Math.floor(losses * (force[k] / total));
    force[k] = Math.max(0, force[k] - share);
  });

  force.ew = Math.max(0, Math.floor(force.ew * (1 - losses / Math.max(total, 1) * 0.2)));
  force.airDefense = Math.max(0, Math.floor(force.airDefense * (1 - losses / Math.max(total, 1) * 0.15)));

  force.morale = Math.max(0.45, force.morale - losses / 12000);
}

function runSimulation() {
  const config = {
    turns: Number(document.getElementById("turns").value),
    terrain: document.getElementById("terrain").value,
    weather: document.getElementById("weather").value,
    civilians: Number(document.getElementById("civilians").value) / 100,
    escalation: Number(document.getElementById("escalation").value) / 100,
    logisticsPressure: Number(document.getElementById("logisticsPressure").value) / 100,
    useCyber: document.getElementById("useCyber").checked,
    useSatIntel: document.getElementById("useSatIntel").checked,
    useSpecialForces: document.getElementById("useSpecialForces").checked,
    useAirCampaign: document.getElementById("useAirCampaign").checked
  };

  const blue = getForce("blueInputs");
  const red = getForce("redInputs");

  const log = [];
  const series = { blue: [], red: [] };

  for (let t = 1; t <= config.turns; t++) {
    const chaos = 0.9 + Math.random() * 0.2;
    const civilianConstraint = 1 - config.civilians * 0.18;

    const bScore = combatScore(blue, config.terrain, config.weather, config);
    const rScore = combatScore(red, config.terrain, config.weather, config);

    const bProt = protectionScore(blue);
    const rProt = protectionScore(red);

    let blueInflicts = Math.max(0, Math.floor((bScore / Math.max(1, rProt)) / 190 * chaos * civilianConstraint));
    let redInflicts = Math.max(0, Math.floor((rScore / Math.max(1, bProt)) / 190 * chaos * civilianConstraint));

    if (config.escalation > 0.7 && t > 2) {
      blueInflicts = Math.floor(blueInflicts * 1.08);
      redInflicts = Math.floor(redInflicts * 1.08);
    }

    applyLosses(red, blueInflicts);
    applyLosses(blue, redInflicts);

    const supplyDrop = 0.015 + config.logisticsPressure * 0.03;
    blue.supply = Math.max(0.35, blue.supply - supplyDrop);
    red.supply = Math.max(0.35, red.supply - supplyDrop);

    const bRemaining = totalPersonnel(blue);
    const rRemaining = totalPersonnel(red);

    log.push(`Turn ${t}: Blue inflicted ${blueInflicts}, Red inflicted ${redInflicts}. Remaining - Blue ${bRemaining}, Red ${rRemaining}`);
    series.blue.push(bRemaining);
    series.red.push(rRemaining);

    if (bRemaining <= 0 || rRemaining <= 0) break;
  }

  renderResult(log, series);
}

function renderResult(log, series) {
  const lastBlue = series.blue[series.blue.length - 1] || 0;
  const lastRed = series.red[series.red.length - 1] || 0;
  let winner = "Draw";
  if (lastBlue > lastRed) winner = "Blue Coalition";
  if (lastRed > lastBlue) winner = "Red Front";

  const summary = document.getElementById("summary");
  summary.innerHTML = `<strong>Winner:</strong> ${winner}<br>
    <strong>Blue Remaining:</strong> ${lastBlue} | <strong>Red Remaining:</strong> ${lastRed}<br>
    <strong>Turns Fought:</strong> ${series.blue.length}`;

  const ul = document.getElementById("battleLog");
  ul.innerHTML = "";
  log.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    ul.appendChild(li);
  });

  drawChart(series);
}

function drawChart(series) {
  const canvas = document.getElementById("battleChart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#0d172a";
  ctx.fillRect(0, 0, w, h);

  const maxY = Math.max(1, ...series.blue, ...series.red);
  const pad = 30;

  function plot(arr, color) {
    if (!arr.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    arr.forEach((v, i) => {
      const x = pad + i * ((w - pad * 2) / Math.max(1, arr.length - 1));
      const y = h - pad - (v / maxY) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  plot(series.blue, "#4a8dff");
  plot(series.red, "#ff6b6b");
}

function randomizeScenario() {
  document.getElementById("terrain").selectedIndex = Math.floor(Math.random() * 6);
  document.getElementById("weather").selectedIndex = Math.floor(Math.random() * 5);
  ["civilians", "escalation", "logisticsPressure"].forEach((id) => {
    document.getElementById(id).value = 10 + Math.floor(Math.random() * 80);
  });
  UNIT_KEYS.forEach((k) => {
    document.getElementById(`blueInputs_${k}`).value = Math.floor((defaults.blue[k] || 100) * (0.6 + Math.random() * 0.8));
    document.getElementById(`redInputs_${k}`).value = Math.floor((defaults.red[k] || 100) * (0.6 + Math.random() * 0.8));
  });
}

function saveScenario() {
  const payload = {
    turns: document.getElementById("turns").value,
    terrain: document.getElementById("terrain").value,
    weather: document.getElementById("weather").value,
    civilians: document.getElementById("civilians").value,
    escalation: document.getElementById("escalation").value,
    logisticsPressure: document.getElementById("logisticsPressure").value,
    blue: getForce("blueInputs"),
    red: getForce("redInputs")
  };
  localStorage.setItem("modern-warsim-scenario", JSON.stringify(payload));
}

function loadScenario() {
  const raw = localStorage.getItem("modern-warsim-scenario");
  if (!raw) return;
  const s = JSON.parse(raw);
  document.getElementById("turns").value = s.turns;
  document.getElementById("terrain").value = s.terrain;
  document.getElementById("weather").value = s.weather;
  document.getElementById("civilians").value = s.civilians;
  document.getElementById("escalation").value = s.escalation;
  document.getElementById("logisticsPressure").value = s.logisticsPressure;

  UNIT_KEYS.forEach((k) => {
    document.getElementById(`blueInputs_${k}`).value = s.blue[k];
    document.getElementById(`redInputs_${k}`).value = s.red[k];
  });
  document.getElementById("blueInputs_doctrine").value = s.blue.doctrine;
  document.getElementById("redInputs_doctrine").value = s.red.doctrine;
}

function resetDefaults() {
  createForceInputs("blueInputs", defaults.blue);
  createForceInputs("redInputs", defaults.red);
  document.getElementById("turns").value = 12;
  document.getElementById("terrain").value = "Open";
  document.getElementById("weather").value = "Clear";
  document.getElementById("civilians").value = 20;
  document.getElementById("escalation").value = 15;
  document.getElementById("logisticsPressure").value = 30;
}

createForceInputs("blueInputs", defaults.blue);
createForceInputs("redInputs", defaults.red);

document.getElementById("runBtn").addEventListener("click", runSimulation);
document.getElementById("randomizeBtn").addEventListener("click", randomizeScenario);
document.getElementById("saveBtn").addEventListener("click", saveScenario);
document.getElementById("loadBtn").addEventListener("click", loadScenario);
document.getElementById("resetBtn").addEventListener("click", resetDefaults);
