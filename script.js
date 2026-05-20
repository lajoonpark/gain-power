const STORAGE_KEY = "gain-power-save-v1";

const sections = ["Economy", "Resources", "Factories", "Military", "Research", "Stats"];

const statOrder = [
  "money",
  "power",
  "population",
  "food",
  "iron",
  "steel",
  "oil",
  "fuel",
  "weapons",
  "uniforms",
];

const labels = {
  money: "Money",
  power: "Power",
  population: "Population",
  food: "Food",
  iron: "Iron",
  steel: "Steel",
  oil: "Oil",
  fuel: "Fuel",
  weapons: "Weapons",
  uniforms: "Uniforms",
};

const defaults = {
  stats: {
    money: 120,
    power: 0,
    population: 24,
    food: 45,
    iron: 22,
    steel: 6,
    oil: 8,
    fuel: 4,
    weapons: 2,
    uniforms: 2,
  },
  assets: {
    farm: 1,
    mine: 1,
    drill: 0,
    steelMill: 0,
    refinery: 0,
    workshop: 0,
    armory: 0,
  },
  research: {
    automation: 0,
    logistics: 0,
  },
  military: {
    units: 0,
  },
  activeSection: "Economy",
  tick: 0,
};

let state = loadState();
let rates = computeRates(state);

const topBar = document.getElementById("topBar");
const nav = document.getElementById("sectionNav");
const sectionTitle = document.getElementById("sectionTitle");
const sectionSubtitle = document.getElementById("sectionSubtitle");
const sectionContent = document.getElementById("sectionContent");
const alertsList = document.getElementById("alertsList");
const cardTemplate = document.getElementById("cardTemplate");

const subtitles = {
  Economy: "Generate money and keep your people productive.",
  Resources: "Expand your raw resource backbone.",
  Factories: "Convert raw materials into strategic goods.",
  Military: "Convert industry into national power.",
  Research: "Unlock stronger production efficiency.",
  Stats: "Inspect and manage your save data.",
};

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaults);
    return mergeState(JSON.parse(raw));
  } catch {
    return structuredClone(defaults);
  }
}

function mergeState(candidate) {
  return {
    stats: { ...defaults.stats, ...(candidate?.stats || {}) },
    assets: { ...defaults.assets, ...(candidate?.assets || {}) },
    research: { ...defaults.research, ...(candidate?.research || {}) },
    military: { ...defaults.military, ...(candidate?.military || {}) },
    activeSection: sections.includes(candidate?.activeSection) ? candidate.activeSection : "Economy",
    tick: Number.isFinite(candidate?.tick) ? candidate.tick : 0,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state = structuredClone(defaults);
  rates = computeRates(state);
  saveState();
  render();
}

function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => state.stats[k] >= v);
}

function spend(cost) {
  Object.entries(cost).forEach(([k, v]) => {
    state.stats[k] -= v;
  });
}

function gain(inc) {
  Object.entries(inc).forEach(([k, v]) => {
    state.stats[k] += v;
  });
}

function doAction(cost, onSuccess) {
  if (!canAfford(cost)) return;
  spend(cost);
  onSuccess();
  rates = computeRates(state);
  saveState();
  render();
}

function computeRates(snapshot) {
  const automationBoost = 1 + snapshot.research.automation * 0.12;
  const logisticsBoost = 1 + snapshot.research.logistics * 0.08;

  const foodRate = snapshot.assets.farm * 2 * automationBoost - snapshot.stats.population * 0.2;
  const ironRate = snapshot.assets.mine * 1.6 * automationBoost;
  const oilRate = snapshot.assets.drill * 1.2 * automationBoost;

  const steelRate =
    Math.min(snapshot.assets.steelMill * 0.9 * automationBoost, snapshot.stats.iron * 0.45) || 0;
  const fuelRate =
    Math.min(snapshot.assets.refinery * 0.85 * logisticsBoost, snapshot.stats.oil * 0.4) || 0;
  const uniformRate =
    Math.min(snapshot.assets.workshop * 0.6 * automationBoost, snapshot.stats.food * 0.2) || 0;
  const weaponRate =
    Math.min(snapshot.assets.armory * 0.5 * automationBoost, snapshot.stats.steel * 0.25) || 0;

  const moneyRate =
    snapshot.stats.population * 1.1 + snapshot.assets.steelMill * 0.8 + snapshot.military.units * 0.4;

  const powerRate =
    snapshot.military.units * 1.4 + snapshot.assets.armory * 0.6 + snapshot.research.automation * 0.8;

  return {
    money: moneyRate,
    food: foodRate,
    iron: ironRate,
    oil: oilRate,
    steel: steelRate,
    fuel: fuelRate,
    uniforms: uniformRate,
    weapons: weaponRate,
    population: foodRate > 0 ? 0.2 : -0.15,
    power: powerRate,
  };
}

function applyTick() {
  state.tick += 1;
  rates = computeRates(state);

  const usage = {
    iron: rates.steel > 0 ? rates.steel * 0.5 : 0,
    oil: rates.fuel > 0 ? rates.fuel * 0.45 : 0,
    food: rates.uniforms > 0 ? rates.uniforms * 0.25 : 0,
    steel: rates.weapons > 0 ? rates.weapons * 0.3 : 0,
  };

  Object.entries(rates).forEach(([k, v]) => {
    if (!(k in state.stats)) return;
    state.stats[k] += v;
  });

  Object.entries(usage).forEach(([k, v]) => {
    state.stats[k] -= v;
  });

  for (const key of Object.keys(state.stats)) {
    state.stats[key] = Math.max(0, Number(state.stats[key].toFixed(2)));
  }

  saveState();
  renderTopBar();
  renderAlerts();
  renderCards();
}

function renderTopBar() {
  topBar.innerHTML = "";
  statOrder.forEach((key) => {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    const rate = rates[key] || 0;
    tile.innerHTML = `
      <div class="stat-name">${labels[key]}</div>
      <div class="stat-value">${fmt.format(state.stats[key])}</div>
      <div class="stat-rate ${rate >= 0 ? "pos" : "neg"}">${rate >= 0 ? "+" : ""}${fmt.format(rate)}/s</div>
    `;
    topBar.appendChild(tile);
  });
}

function renderNav() {
  nav.innerHTML = "";
  sections.forEach((section) => {
    const btn = document.createElement("button");
    btn.className = `nav-btn ${state.activeSection === section ? "active" : ""}`;
    btn.textContent = section;
    btn.addEventListener("click", () => {
      state.activeSection = section;
      saveState();
      render();
    });
    nav.appendChild(btn);
  });
}

function card(def) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".card-title").textContent = def.title;
  node.querySelector(".card-desc").textContent = def.desc;
  node.querySelector(".card-meta").textContent = def.meta;
  const progress = node.querySelector(".card-progress span");
  progress.style.width = `${Math.max(0, Math.min(100, def.progress || 0))}%`;
  const btn = node.querySelector(".card-button");
  btn.textContent = def.button;
  btn.disabled = !!def.disabled;
  btn.addEventListener("click", def.onClick);
  return node;
}

function renderCards() {
  sectionTitle.textContent = state.activeSection;
  sectionSubtitle.textContent = subtitles[state.activeSection];
  sectionContent.innerHTML = "";

  const defs = {
    Economy: [
      {
        title: "Collect Taxes",
        desc: "Instantly collect a money burst from your population.",
        meta: "Gain money now. Cooldown-free active action.",
        progress: Math.min(100, (state.stats.population / 100) * 100),
        button: "Collect +15 Money",
        onClick: () => {
          gain({ money: 15 + state.stats.population * 0.2 });
          rates = computeRates(state);
          saveState();
          render();
        },
      },
      {
        title: "City Housing",
        desc: "Expand living space to support growth.",
        meta: `Current population ${fmt.format(state.stats.population)}`,
        progress: Math.min(100, (state.stats.food / 120) * 100),
        button: "Build Housing (60 Money, 12 Food)",
        disabled: !canAfford({ money: 60, food: 12 }),
        onClick: () => doAction({ money: 60, food: 12 }, () => gain({ population: 4 })),
      },
    ],
    Resources: [
      {
        title: "Farms",
        desc: "Produce food every tick.",
        meta: `Owned: ${state.assets.farm}`,
        progress: Math.min(100, (state.assets.farm / 25) * 100),
        button: `Buy Farm (${30 + state.assets.farm * 15} Money)`,
        disabled: !canAfford({ money: 30 + state.assets.farm * 15 }),
        onClick: () =>
          doAction({ money: 30 + state.assets.farm * 15 }, () => {
            state.assets.farm += 1;
          }),
      },
      {
        title: "Iron Mines",
        desc: "Extract iron ore for industry.",
        meta: `Owned: ${state.assets.mine}`,
        progress: Math.min(100, (state.assets.mine / 25) * 100),
        button: `Buy Mine (${45 + state.assets.mine * 18} Money)`,
        disabled: !canAfford({ money: 45 + state.assets.mine * 18 }),
        onClick: () =>
          doAction({ money: 45 + state.assets.mine * 18 }, () => {
            state.assets.mine += 1;
          }),
      },
      {
        title: "Oil Rigs",
        desc: "Gather oil for fuel chain.",
        meta: `Owned: ${state.assets.drill}`,
        progress: Math.min(100, (state.assets.drill / 20) * 100),
        button: `Buy Rig (${70 + state.assets.drill * 24} Money, 8 Steel)`,
        disabled: !canAfford({ money: 70 + state.assets.drill * 24, steel: 8 }),
        onClick: () =>
          doAction({ money: 70 + state.assets.drill * 24, steel: 8 }, () => {
            state.assets.drill += 1;
          }),
      },
    ],
    Factories: [
      {
        title: "Steel Mill",
        desc: "Converts iron into steel each tick.",
        meta: `Owned: ${state.assets.steelMill}`,
        progress: Math.min(100, (state.assets.steelMill / 15) * 100),
        button: `Build Mill (${120 + state.assets.steelMill * 40} Money, 12 Iron)`,
        disabled: !canAfford({ money: 120 + state.assets.steelMill * 40, iron: 12 }),
        onClick: () =>
          doAction({ money: 120 + state.assets.steelMill * 40, iron: 12 }, () => {
            state.assets.steelMill += 1;
          }),
      },
      {
        title: "Refinery",
        desc: "Converts oil into fuel.",
        meta: `Owned: ${state.assets.refinery}`,
        progress: Math.min(100, (state.assets.refinery / 15) * 100),
        button: `Build Refinery (${135 + state.assets.refinery * 44} Money, 10 Steel)`,
        disabled: !canAfford({ money: 135 + state.assets.refinery * 44, steel: 10 }),
        onClick: () =>
          doAction({ money: 135 + state.assets.refinery * 44, steel: 10 }, () => {
            state.assets.refinery += 1;
          }),
      },
      {
        title: "Workshop",
        desc: "Produces uniforms from food supplies.",
        meta: `Owned: ${state.assets.workshop}`,
        progress: Math.min(100, (state.assets.workshop / 15) * 100),
        button: `Build Workshop (${100 + state.assets.workshop * 30} Money, 8 Steel)`,
        disabled: !canAfford({ money: 100 + state.assets.workshop * 30, steel: 8 }),
        onClick: () =>
          doAction({ money: 100 + state.assets.workshop * 30, steel: 8 }, () => {
            state.assets.workshop += 1;
          }),
      },
      {
        title: "Armory",
        desc: "Produces weapons from steel.",
        meta: `Owned: ${state.assets.armory}`,
        progress: Math.min(100, (state.assets.armory / 15) * 100),
        button: `Build Armory (${160 + state.assets.armory * 50} Money, 15 Steel)`,
        disabled: !canAfford({ money: 160 + state.assets.armory * 50, steel: 15 }),
        onClick: () =>
          doAction({ money: 160 + state.assets.armory * 50, steel: 15 }, () => {
            state.assets.armory += 1;
          }),
      },
    ],
    Military: [
      {
        title: "Train Battalion",
        desc: "Turns supplies into national strength.",
        meta: `Deployed units: ${state.military.units}`,
        progress: Math.min(100, (state.military.units / 80) * 100),
        button: "Train Unit (50 Money, 1 Weapon, 1 Uniform)",
        disabled: !canAfford({ money: 50, weapons: 1, uniforms: 1 }),
        onClick: () =>
          doAction({ money: 50, weapons: 1, uniforms: 1 }, () => {
            state.military.units += 1;
            gain({ power: 2 });
          }),
      },
      {
        title: "Civic Service",
        desc: "Stabilize growth by boosting morale.",
        meta: "Trade fuel for immediate population growth.",
        progress: Math.min(100, (state.stats.fuel / 40) * 100),
        button: "Support Population (+3 Pop for 4 Fuel)",
        disabled: !canAfford({ fuel: 4 }),
        onClick: () => doAction({ fuel: 4 }, () => gain({ population: 3 })),
      },
    ],
    Research: [
      {
        title: "Automation",
        desc: "Improve output of all resource buildings.",
        meta: `Level: ${state.research.automation} (${(state.research.automation * 12).toFixed(0)}% boost)`,
        progress: Math.min(100, (state.research.automation / 10) * 100),
        button: `Upgrade (${220 + state.research.automation * 110} Money, 20 Steel)`,
        disabled:
          state.research.automation >= 10 ||
          !canAfford({ money: 220 + state.research.automation * 110, steel: 20 }),
        onClick: () =>
          doAction({ money: 220 + state.research.automation * 110, steel: 20 }, () => {
            state.research.automation += 1;
          }),
      },
      {
        title: "Logistics",
        desc: "Increase refinery efficiency and national cash flow.",
        meta: `Level: ${state.research.logistics} (${(state.research.logistics * 8).toFixed(0)}% boost)`,
        progress: Math.min(100, (state.research.logistics / 10) * 100),
        button: `Upgrade (${180 + state.research.logistics * 95} Money, 12 Fuel)`,
        disabled:
          state.research.logistics >= 10 ||
          !canAfford({ money: 180 + state.research.logistics * 95, fuel: 12 }),
        onClick: () =>
          doAction({ money: 180 + state.research.logistics * 95, fuel: 12 }, () => {
            state.research.logistics += 1;
          }),
      },
    ],
    Stats: [
      {
        title: "Run Snapshot",
        desc: `Ticks elapsed: ${state.tick}`,
        meta: `Assets: ${Object.values(state.assets).reduce((a, b) => a + b, 0)} | Units: ${state.military.units}`,
        progress: Math.min(100, (state.tick % 120) / 1.2),
        button: "Save Now",
        onClick: () => {
          saveState();
          renderAlerts([{ level: "good", text: "Progress saved to localStorage." }]);
        },
      },
      {
        title: "Reset Save",
        desc: "Start a fresh run from default values.",
        meta: "This removes current localStorage progress.",
        progress: 100,
        button: "Reset Game",
        onClick: () => {
          if (window.confirm("Reset all Gain Power progress?")) {
            localStorage.removeItem(STORAGE_KEY);
            resetState();
          }
        },
      },
    ],
  };

  defs[state.activeSection].forEach((d) => sectionContent.appendChild(card(d)));
}

function buildAlerts(extra = []) {
  const result = [...extra];
  if (state.stats.food < state.stats.population * 0.8) {
    result.push({ level: "bad", text: "Food supply is below safe population demand." });
  }
  if (state.assets.steelMill > 0 && state.stats.iron < 8) {
    result.push({ level: "warn", text: "Steel Mills are starved of iron input." });
  }
  if (state.assets.refinery > 0 && state.stats.oil < 5) {
    result.push({ level: "warn", text: "Refineries cannot maintain throughput without more oil." });
  }
  if (state.assets.armory > 0 && state.stats.steel < 6) {
    result.push({ level: "warn", text: "Armories are slowing down due to low steel stock." });
  }
  if (state.stats.money < 20) {
    result.push({ level: "bad", text: "Treasury critical: maintain at least 20 money for flexibility." });
  }
  if (!result.length) {
    result.push({ level: "good", text: "Production stable. Keep expanding strategically." });
  }
  return result;
}

function renderAlerts(extra) {
  alertsList.innerHTML = "";
  buildAlerts(extra).slice(0, 6).forEach((alert) => {
    const li = document.createElement("li");
    li.className = alert.level;
    li.textContent = alert.text;
    alertsList.appendChild(li);
  });
}

function render() {
  rates = computeRates(state);
  renderTopBar();
  renderNav();
  renderCards();
  renderAlerts();
}

render();
setInterval(applyTick, 1000);
