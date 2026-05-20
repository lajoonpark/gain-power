const STORAGE_KEY = "gain-power-save-v2";

const sections = ["Economy", "Resources", "Stats"];

const statOrder = ["money", "population", "food", "iron", "steel", "oil", "fuel", "cotton", "fabric"];

const labels = {
  money: "Money",
  population: "Population",
  food: "Food",
  iron: "Iron",
  steel: "Steel",
  oil: "Oil",
  fuel: "Fuel",
  cotton: "Cotton",
  fabric: "Fabric",
};

const buildingDefs = [
  {
    id: "farm",
    name: "Farm",
    section: "Economy",
    icon: "farm",
    baseCost: 30,
    growth: 1.15,
    produces: { resource: "food", amount: 2.2 },
    desc: "Steady food production.",
  },
  {
    id: "shop",
    name: "Shop",
    section: "Economy",
    icon: "shop",
    baseCost: 45,
    growth: 1.16,
    produces: { resource: "money", amount: 2.8 },
    desc: "Reliable local cash flow.",
  },
  {
    id: "office",
    name: "Office",
    section: "Economy",
    icon: "office",
    baseCost: 115,
    growth: 1.17,
    produces: { resource: "money", amount: 7.5 },
    populationRequired: 3,
    desc: "High money output, requires workforce.",
  },
  {
    id: "bank",
    name: "Bank",
    section: "Economy",
    icon: "bank",
    baseCost: 320,
    growth: 1.2,
    produces: { resource: "money", amount: 18 },
    desc: "Very high money output, expensive to expand.",
  },
  {
    id: "ironMine",
    name: "Iron Mine",
    section: "Resources",
    icon: "mine",
    baseCost: 70,
    growth: 1.16,
    produces: { resource: "iron", amount: 1.8 },
    desc: "Extracts iron ore.",
  },
  {
    id: "steelMill",
    name: "Steel Mill",
    section: "Resources",
    icon: "mill",
    baseCost: 170,
    growth: 1.18,
    converter: { input: "iron", inputAmount: 1.2, output: "steel", outputAmount: 0.9 },
    desc: "Converts iron into steel.",
  },
  {
    id: "oilWell",
    name: "Oil Well",
    section: "Resources",
    icon: "oil",
    baseCost: 115,
    growth: 1.16,
    produces: { resource: "oil", amount: 1.55 },
    desc: "Pumps crude oil.",
  },
  {
    id: "fuelRefinery",
    name: "Fuel Refinery",
    section: "Resources",
    icon: "refinery",
    baseCost: 205,
    growth: 1.18,
    converter: { input: "oil", inputAmount: 1.05, output: "fuel", outputAmount: 0.8 },
    desc: "Refines oil into fuel.",
  },
  {
    id: "cottonFarm",
    name: "Cotton Farm",
    section: "Resources",
    icon: "cotton",
    baseCost: 82,
    growth: 1.15,
    produces: { resource: "cotton", amount: 2.1 },
    desc: "Grows raw cotton.",
  },
  {
    id: "textileMill",
    name: "Textile Mill",
    section: "Resources",
    icon: "textile",
    baseCost: 190,
    growth: 1.18,
    converter: { input: "cotton", inputAmount: 1.25, output: "fabric", outputAmount: 1.0 },
    desc: "Converts cotton into fabric.",
  },
];

const buildingIds = buildingDefs.map((building) => building.id);

const defaults = {
  stats: {
    money: 140,
    population: 22,
    food: 38,
    iron: 16,
    steel: 5,
    oil: 7,
    fuel: 2,
    cotton: 12,
    fabric: 1,
  },
  buildings: Object.fromEntries(buildingIds.map((id) => [id, 0])),
  activeSection: "Economy",
  tick: 0,
};

defaults.buildings.farm = 1;
defaults.buildings.shop = 1;
defaults.buildings.ironMine = 1;
defaults.buildings.oilWell = 1;
defaults.buildings.cottonFarm = 1;

const subtitles = {
  Economy: "Buy and scale your national economy.",
  Resources: "Build extraction and conversion chains.",
  Stats: "Inspect save status and manage progress.",
};

const topBar = document.getElementById("topBar");
const nav = document.getElementById("sectionNav");
const sectionTitle = document.getElementById("sectionTitle");
const sectionSubtitle = document.getElementById("sectionSubtitle");
const sectionContent = document.getElementById("sectionContent");
const alertsList = document.getElementById("alertsList");
const cardTemplate = document.getElementById("cardTemplate");

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const fmtInt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const FOOD_CONSUMPTION_PER_CAPITA = 0.38;
const POPULATION_GROWTH_RATE_PER_TICK = 0.12;
const POPULATION_DECLINE_RATE_PER_TICK = -0.18;

let state = loadState();
let simulation = simulate(state);
let rates = simulation.rates;
let buildingRuntime = simulation.buildingRuntime;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return mergeState(JSON.parse(raw));
    const legacyRaw = localStorage.getItem("gain-power-save-v1");
    if (legacyRaw) return mergeState(JSON.parse(legacyRaw));
    return structuredClone(defaults);
  } catch {
    const legacyRaw = localStorage.getItem("gain-power-save-v1");
    if (legacyRaw) {
      try {
        return mergeState(JSON.parse(legacyRaw));
      } catch {
        return structuredClone(defaults);
      }
    }
    return structuredClone(defaults);
  }
}

function mergeState(candidate) {
  const migratedBuildings = {
    ...defaults.buildings,
    ...(candidate?.buildings || {}),
  };
  if (candidate?.assets && typeof candidate.assets === "object") {
    migratedBuildings.farm = Math.max(migratedBuildings.farm, candidate.assets.farm || 0);
    migratedBuildings.ironMine = Math.max(migratedBuildings.ironMine, candidate.assets.mine || 0);
    migratedBuildings.oilWell = Math.max(migratedBuildings.oilWell, candidate.assets.drill || 0);
    migratedBuildings.steelMill = Math.max(migratedBuildings.steelMill, candidate.assets.steelMill || 0);
    migratedBuildings.fuelRefinery = Math.max(migratedBuildings.fuelRefinery, candidate.assets.refinery || 0);
  }
  return {
    stats: { ...defaults.stats, ...(candidate?.stats || {}) },
    buildings: migratedBuildings,
    activeSection: sections.includes(candidate?.activeSection) ? candidate.activeSection : "Economy",
    tick: Number.isFinite(candidate?.tick) ? candidate.tick : 0,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state = structuredClone(defaults);
  recalc();
  saveState();
  render();
}

function recalc() {
  simulation = simulate(state);
  rates = simulation.rates;
  buildingRuntime = simulation.buildingRuntime;
}

function getOwned(buildingId) {
  return state.buildings[buildingId] || 0;
}

function calculateActiveWorkers(owned, population, populationRequired) {
  if (!Number.isFinite(populationRequired) || populationRequired <= 0) return 0;
  return Math.min(owned, Math.floor(population / populationRequired));
}

function labelFor(resourceKey) {
  return labels[resourceKey] || resourceKey;
}

function getBuildingCost(def) {
  const owned = getOwned(def.id);
  return Math.round(def.baseCost * def.growth ** owned);
}

function canAfford(cost) {
  return state.stats.money >= cost;
}

function buyBuilding(def) {
  const cost = getBuildingCost(def);
  if (!canAfford(cost)) return;
  state.stats.money -= cost;
  state.buildings[def.id] += 1;
  recalc();
  saveState();
  render();
}

function simulate(snapshot) {
  const ratesOut = Object.fromEntries(statOrder.map((key) => [key, 0]));
  const runtime = {};

  ratesOut.food -= snapshot.stats.population * FOOD_CONSUMPTION_PER_CAPITA;

  for (const def of buildingDefs) {
    const owned = snapshot.buildings[def.id] || 0;
    runtime[def.id] = {
      active: !def.converter,
      production: 0,
      maxProduction: 0,
    };
    if (owned <= 0 || !def.produces) continue;

    if (def.populationRequired) {
      const activeCount = calculateActiveWorkers(owned, snapshot.stats.population, def.populationRequired);
      const produced = activeCount * def.produces.amount;
      ratesOut[def.produces.resource] += produced;
      runtime[def.id].production = produced;
      runtime[def.id].maxProduction = owned * def.produces.amount;
      runtime[def.id].active = activeCount > 0;
      runtime[def.id].activeCount = activeCount;
      continue;
    }

    const produced = owned * def.produces.amount;
    ratesOut[def.produces.resource] += produced;
    runtime[def.id].production = produced;
    runtime[def.id].maxProduction = produced;
  }

  for (const def of buildingDefs) {
    const owned = snapshot.buildings[def.id] || 0;
    if (owned <= 0 || !def.converter) continue;
    const requiredInput = owned * def.converter.inputAmount;
    const availableInput = snapshot.stats[def.converter.input] ?? 0;
    const isActive = availableInput >= requiredInput;
    runtime[def.id].active = isActive;
    runtime[def.id].maxProduction = owned * def.converter.outputAmount;
    if (!isActive) {
      runtime[def.id].production = 0;
      continue;
    }
    const produced = owned * def.converter.outputAmount;
    ratesOut[def.converter.input] -= requiredInput;
    ratesOut[def.converter.output] += produced;
    runtime[def.id].production = produced;
  }

  ratesOut.population += ratesOut.food >= 0 ? POPULATION_GROWTH_RATE_PER_TICK : POPULATION_DECLINE_RATE_PER_TICK;
  return { rates: ratesOut, buildingRuntime: runtime };
}

function applyTick() {
  state.tick += 1;
  recalc();

  for (const key of statOrder) {
    state.stats[key] = Number(Math.max(0, state.stats[key] + rates[key]).toFixed(2));
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
  const icon = node.querySelector(".pixel-icon");
  icon.className = `pixel-icon icon-${def.icon}`;

  const statsNode = node.querySelector(".card-stats");
  statsNode.innerHTML = "";
  def.stats.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    statsNode.appendChild(li);
  });

  const statusNode = node.querySelector(".card-status");
  if (def.statusText) {
    statusNode.textContent = def.statusText;
    statusNode.className = `card-status ${def.statusClass || ""}`;
  } else {
    statusNode.remove();
  }

  const progress = node.querySelector(".card-progress span");
  progress.style.width = `${Math.max(0, Math.min(100, def.progress || 0))}%`;

  const btn = node.querySelector(".card-button");
  btn.textContent = def.button;
  btn.disabled = !!def.disabled;
  btn.addEventListener("click", def.onClick);
  return node;
}

function toBuildingCard(def) {
  const owned = getOwned(def.id);
  const cost = getBuildingCost(def);
  const runtime = buildingRuntime[def.id] || { active: true, production: 0, maxProduction: 0 };
  const production = runtime.production || 0;
  const productionLabel =
    def.converter
      ? `${labelFor(def.converter.output)} +${fmt.format(production)}/s`
      : `${labelFor(def.produces.resource)} +${fmt.format(production)}/s`;

  const statsLines = [
    `Owned: ${fmtInt.format(owned)}`,
    `Current Cost: ${fmtInt.format(cost)} Money`,
    `Production: ${productionLabel}`,
  ];

  if (def.populationRequired) {
    const activeCount = runtime.activeCount || 0;
    statsLines.push(`Workers: ${activeCount}/${owned} active (${def.populationRequired} Pop each)`);
  }

  if (def.converter) {
    statsLines.push(
      `Recipe: ${fmt.format(def.converter.inputAmount)} ${labelFor(def.converter.input)} → ${fmt.format(def.converter.outputAmount)} ${labelFor(def.converter.output)}`
    );
  }

  if (def.converter && (!labels[def.converter.input] || !labels[def.converter.output])) {
    statsLines.push("Warning: Missing label metadata for recipe resources.");
  }

  return {
    title: def.name,
    icon: def.icon,
    desc: def.desc,
    stats: statsLines,
    statusText: def.converter ? (runtime.active ? "Status: Active" : "Status: Inactive") : "",
    statusClass: runtime.active ? "active" : "inactive",
    progress: runtime.maxProduction > 0 ? (production / runtime.maxProduction) * 100 : 0,
    button: `Buy (${fmtInt.format(cost)} Money)`,
    disabled: !canAfford(cost),
    onClick: () => buyBuilding(def),
  };
}

function renderCards() {
  sectionTitle.textContent = state.activeSection;
  sectionSubtitle.textContent = subtitles[state.activeSection];
  sectionContent.innerHTML = "";

  if (state.activeSection === "Stats") {
    const defs = [
      {
        title: "Run Snapshot",
        icon: "stats",
        desc: "Current session metrics.",
        stats: [
          `Ticks elapsed: ${fmtInt.format(state.tick)}`,
          `Buildings owned: ${fmtInt.format(buildingIds.reduce((acc, id) => acc + getOwned(id), 0))}`,
          `Treasury: ${fmtInt.format(state.stats.money)} Money`,
        ],
        progress: Math.min(100, (state.tick % 120) / 1.2),
        button: "Save Now",
        onClick: () => {
          saveState();
          renderAlerts([{ level: "good", text: "Progress saved to localStorage." }]);
        },
      },
      {
        title: "Reset Save",
        icon: "reset",
        desc: "Start over with default values.",
        stats: ["This clears current localStorage data."],
        progress: 100,
        button: "Reset Game",
        onClick: () => {
          if (window.confirm("Reset all Gain Power progress?")) {
            localStorage.removeItem(STORAGE_KEY);
            resetState();
          }
        },
      },
    ];
    defs.forEach((d) => sectionContent.appendChild(card(d)));
    return;
  }

  buildingDefs
    .filter((def) => def.section === state.activeSection)
    .map(toBuildingCard)
    .forEach((d) => sectionContent.appendChild(card(d)));
}

function buildAlerts(extra = []) {
  const result = [...extra];
  for (const def of buildingDefs.filter((item) => item.converter)) {
    const owned = getOwned(def.id);
    const runtime = buildingRuntime[def.id];
    if (owned > 0 && runtime && !runtime.active) {
      result.push({
        level: "warn",
        text: `${def.name} inactive: need more ${labelFor(def.converter.input)}.`,
      });
    }
  }
  if (state.stats.food < state.stats.population * 0.7) {
    result.push({ level: "bad", text: "Food supply is too low for current population demand." });
  }
  if (state.stats.money < 25) {
    result.push({ level: "bad", text: "Treasury is low: buy orders are constrained." });
  }
  if (!result.length) {
    result.push({ level: "good", text: "All major production lines are stable." });
  }
  return result;
}

function renderAlerts(extra) {
  alertsList.innerHTML = "";
  buildAlerts(extra)
    .slice(0, 6)
    .forEach((alert) => {
      const li = document.createElement("li");
      li.className = alert.level;
      li.textContent = alert.text;
      alertsList.appendChild(li);
    });
}

function render() {
  recalc();
  renderTopBar();
  renderNav();
  renderCards();
  renderAlerts();
}

render();
setInterval(applyTick, 1000);
