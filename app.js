"use strict";

document.body.classList.add("has-js");

const $ = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const argmax = (values) => values.indexOf(Math.max(...values));
const pct = (n, digits = 1) => `${(n * 100).toFixed(digits).replace(".", ",")}%`;

let DATA;
let firstGuess = null;
let filterX = 9;
let filterY = 9;
let selectedMap = 0;
let mapIsTrained = false;
let selectedTest = 0;
let testRan = false;
let testRunId = 0;

function drawPixels(canvas, pixels, selected = null, grid = false) {
  if (!canvas || !pixels) return;
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cell = size / 28;
  ctx.fillStyle = "#111411";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const v = pixels[y * 28 + x];
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.round(x * cell), Math.round(y * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
  if (grid && size >= 400) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(199,255,41,.11)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 28; i++) {
      const p = Math.round(i * cell) + .5;
      ctx.moveTo(p, 0); ctx.lineTo(p, size);
      ctx.moveTo(0, p); ctx.lineTo(size, p);
    }
    ctx.stroke();
  }
  if (selected) {
    ctx.fillStyle = "rgba(199,255,41,.2)";
    ctx.fillRect(selected.x * cell, selected.y * cell, cell, cell);
    ctx.strokeStyle = "#c7ff29";
    ctx.lineWidth = Math.max(1, cell / 7);
    ctx.strokeRect(selected.x * cell + 1, selected.y * cell + 1, cell - 2, cell - 2);
  }
}

function drawMap(canvas, values, size = 26, highlight = null) {
  if (!canvas || !values) return;
  const ctx = canvas.getContext("2d");
  const cell = canvas.width / size;
  const max = Math.max(0.001, ...values);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = Math.pow(clamp(values[y * size + x] / max, 0, 1), .78);
      const r = Math.round(19 + 180 * t);
      const g = Math.round(26 + 229 * t);
      const b = Math.round(19 + 17 * t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(Math.round(x * cell), Math.round(y * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
  if (highlight) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(2, cell / 7);
    ctx.strokeRect(highlight.x * cell + 1, highlight.y * cell + 1, cell - 2, cell - 2);
  }
}

function renderGuessOptions() {
  const choices = [...new Set([DATA.focus.label, 2, 4, 6])].slice(0, 3);
  const wrap = $("guess-options");
  wrap.innerHTML = "";
  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "guess-button";
    button.textContent = DATA.classes[choice];
    button.dataset.choice = choice;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      firstGuess = choice;
      try { localStorage.setItem("visionModeFirstGuess", String(choice)); } catch (_) {}
      wrap.querySelectorAll("button").forEach((b) => {
        const active = Number(b.dataset.choice) === choice;
        b.classList.toggle("selected", active);
        b.setAttribute("aria-pressed", String(active));
      });
      $("guess-feedback").textContent = "Выбор сохранён. Вернёмся к нему в конце.";
      $("human-first-answer").textContent = DATA.classes[choice];
    });
    wrap.append(button);
  }
  try {
    const saved = localStorage.getItem("visionModeFirstGuess");
    if (saved !== null) {
      const button = wrap.querySelector(`[data-choice="${Number(saved)}"]`);
      if (button) button.click();
    }
  } catch (_) {}
}

function initPixelInspector() {
  const canvas = $("input-canvas");
  drawPixels(canvas, DATA.focus.pixels, null, true);
  const inspect = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = clamp(Math.floor((event.clientX - rect.left) / rect.width * 28), 0, 27);
    const y = clamp(Math.floor((event.clientY - rect.top) / rect.height * 28), 0, 27);
    const value = DATA.focus.pixels[y * 28 + x];
    drawPixels(canvas, DATA.focus.pixels, { x, y }, true);
    $("pixel-readout").textContent = `X: ${String(x).padStart(2, "0")}   Y: ${String(y).padStart(2, "0")}   VALUE: ${String(value).padStart(3, "0")} / 255`;
  };
  canvas.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse") inspect(event); });
  canvas.addEventListener("pointerdown", inspect);
}

function initInputDiagrams() {
  const pixels = DATA.focus.pixels;
  drawPixels($("input-feature-canvas"), pixels);
  drawPixels($("input-diagram-image"), pixels);
  const valueCanvas = $("input-diagram-values");
  const pixelCanvas = $("input-diagram-pixels");
  for (const [canvas, mode] of [[pixelCanvas, "image"], [valueCanvas, "values"]]) {
    const context = canvas.getContext("2d");
    const cell = canvas.width / 28;
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = "7px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        const value = pixels[y * 28 + x];
        if (mode === "image") {
          context.fillStyle = `rgb(${value},${value},${value})`;
          context.fillRect(x * cell, y * cell, cell, cell);
          context.fillStyle = value > 135 ? "#000" : "#fff";
        } else {
          context.fillStyle = value ? "#ddd" : "#555";
        }
        context.fillText(String(value), x * cell + cell / 2, y * cell + cell / 2);
      }
    }
    if (mode === "image") {
      context.strokeStyle = "rgba(255,255,255,.25)";
      context.lineWidth = 1;
      for (let n = 0; n <= 28; n++) {
        const offset = n * cell + .5;
        context.beginPath();
        context.moveTo(offset, 0); context.lineTo(offset, canvas.height);
        context.moveTo(0, offset); context.lineTo(canvas.width, offset);
        context.stroke();
      }
    }
  }
}

function filterRawResponse(x, y) {
  let sum = DATA.biasInitial;
  const pixels = DATA.focus.pixels;
  const kernel = DATA.filterInitial;
  for (let ky = 0; ky < 3; ky++) {
    for (let kx = 0; kx < 3; kx++) {
      sum += pixels[(y + ky) * 28 + x + kx] / 255 * kernel[ky * 3 + kx];
    }
  }
  return sum;
}

function renderFilter() {
  $("filter-window").style.left = `${filterX / 28 * 100}%`;
  $("filter-window").style.top = `${filterY / 28 * 100}%`;
  const response = filterRawResponse(filterX, filterY);
  const display = response >= 0 ? `+${response.toFixed(3)}` : response.toFixed(3);
  $("filter-equation").querySelector("strong").textContent = `= ${display}`;
  drawMap($("filter-map-canvas"), DATA.mapsInitial[DATA.selectedFilter], 26, { x: filterX, y: filterY });
}

function initFilter() {
  drawPixels($("filter-canvas"), DATA.focus.pixels, null, true);
  const area = $("filter-interaction");
  const move = (event) => {
    const rect = area.getBoundingClientRect();
    filterX = clamp(Math.floor((event.clientX - rect.left) / rect.width * 28) - 1, 0, 25);
    filterY = clamp(Math.floor((event.clientY - rect.top) / rect.height * 28) - 1, 0, 25);
    renderFilter();
  };
  area.addEventListener("pointerdown", (event) => { area.setPointerCapture(event.pointerId); move(event); });
  area.addEventListener("pointermove", (event) => { if (event.buttons || event.pointerType === "mouse") move(event); });
  renderFilter();
}

function renderMap() {
  const maps = mapIsTrained ? DATA.mapsFinal : DATA.mapsInitial;
  drawMap($("map-detail-canvas"), maps[selectedMap]);
  $("map-number").textContent = String(selectedMap + 1).padStart(2, "0");
  $("maps-state").textContent = mapIsTrained ? "СЕЙЧАС: ПОСЛЕ ЧЕТЫРЁХ ЭПОХ ОБУЧЕНИЯ" : "СЕЙЧАС: НЕОБУЧЕННЫЕ ВЕСА";
  $("maps-compare").innerHTML = mapIsTrained ? "ВЕРНУТЬСЯ К НАЧАЛУ <span>↶</span>" : "ПОКАЗАТЬ ПОСЛЕ ОБУЧЕНИЯ <span>↗</span>";
  $("map-controls").querySelectorAll("button").forEach((button) => {
    const active = Number(button.dataset.index) === selectedMap;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function initMaps() {
  const controls = $("map-controls");
  for (let i = 0; i < 8; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-button";
    button.textContent = String(i + 1).padStart(2, "0");
    button.dataset.index = i;
    button.setAttribute("aria-label", `Показать карту ${i + 1}`);
    button.addEventListener("click", () => { selectedMap = i; renderMap(); });
    controls.append(button);
  }
  $("maps-compare").addEventListener("click", () => { mapIsTrained = !mapIsTrained; renderMap(); });
  renderMap();
}

function makeScoreRows(container, probs, interactive = true) {
  container.innerHTML = "";
  const max = Math.max(...probs);
  const winner = argmax(probs);
  probs.forEach((prob, i) => {
    const row = document.createElement(interactive ? "button" : "div");
    if (interactive) row.type = "button";
    row.className = `score-row${i === winner ? " is-max" : ""}`;
    row.innerHTML = `<span class="score-id">${String(i).padStart(2, "0")}</span><span class="score-name"></span><span class="score-track"><i></i></span><span class="score-value">${pct(prob)}</span>`;
    row.querySelector(".score-name").textContent = DATA.classes[i];
    row.querySelector(".score-track i").style.width = `${Math.max(1, prob / max * 100)}%`;
    if (interactive) {
      row.setAttribute("aria-label", `${DATA.classes[i]}, оценка ${pct(prob)}`);
      row.addEventListener("click", () => {
        container.querySelectorAll(".score-row").forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        const output = DATA.classes[winner];
        $("output-result").textContent = i === winner
          ? `ВЕРНО. OUTPUT → ${output.toUpperCase()}`
          : `СЕТЬ БЕРЁТ МАКСИМУМ. OUTPUT → ${output.toUpperCase()}`;
      });
    }
    container.append(row);
  });
}

function initOutput() {
  makeScoreRows($("output-bars"), DATA.focus.initialProbs);
}

function initError() {
  const example = DATA.trainExample;
  drawPixels($("error-canvas"), example.pixels, null, true);
  $("train-index").textContent = String(example.index).padStart(4, "0");
  const before = argmax(example.probsByEpoch[0]);
  $("correction-status").innerHTML = `ПРЕДПОЛОЖЕНИЕ: ${DATA.classes[before].toUpperCase()}<br>МЕТКА: СКРЫТА`;
  $("reveal-error").addEventListener("click", () => {
    $("correction-status").innerHTML = `ПРЕДПОЛОЖЕНИЕ: ${DATA.classes[before].toUpperCase()}<br>МЕТКА: <span style="color:#ff5948">${DATA.classes[example.label].toUpperCase()}</span>`;
    $("apply-correction").disabled = false;
    $("reveal-error").disabled = true;
    $("reveal-error").textContent = "МЕТКА ОТКРЫТА";
  });
  $("apply-correction").addEventListener("click", () => {
    const flow = $("backflow");
    flow.classList.remove("is-active");
    void flow.offsetWidth;
    flow.classList.add("is-active");
    $("correction-status").innerHTML = `ОШИБКА ВЫЧИСЛЕНА<br><span style="color:#ff5948">СИГНАЛ ИДЁТ ОТ ОТВЕТА К ВЕСАМ ↶</span>`;
    setTimeout(() => {
      $("correction-status").innerHTML = `ОДИН ШАГ ПОКАЗАН<br>ДАЛЬШЕ — МНОГО ПАРТИЙ ИЗОБРАЖЕНИЙ`;
    }, 1600);
  });
}

function renderEpoch(epoch) {
  const example = DATA.trainExample;
  const probs = example.probsByEpoch[epoch];
  const prediction = argmax(probs);
  $("epoch-prediction").textContent = DATA.classes[prediction];
  $("epoch-confidence").textContent = pct(probs[example.label]);
  $("epoch-confidence-bar").style.width = `${probs[example.label] * 100}%`;
  $("epoch-label").textContent = DATA.classes[example.label];
  $("epoch-accuracy").textContent = epoch === 0 ? "—" : pct(DATA.history[epoch].trainAccuracy);
  $("epoch-caption").textContent = epoch === 0 ? "ЭПОХА 0 / СЛУЧАЙНЫЕ ВЕСА" : `ЭПОХА ${epoch} / ПОСЛЕ ${epoch} ПРОХОД${epoch === 1 ? "А" : "ОВ"} ПО ДАННЫМ`;
  $("epoch-tabs").querySelectorAll("button").forEach((button) => {
    const active = Number(button.dataset.epoch) === epoch;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function initTraining() {
  drawPixels($("training-canvas"), DATA.trainExample.pixels);
  const mosaic = $("training-mosaic");
  DATA.gallery.forEach((card) => {
    const canvas = document.createElement("canvas");
    canvas.width = 56; canvas.height = 56;
    drawPixels(canvas, card.pixels);
    mosaic.append(canvas);
  });
  const tabs = $("epoch-tabs");
  DATA.history.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "epoch-button";
    button.textContent = String(entry.epoch).padStart(2, "0");
    button.dataset.epoch = entry.epoch;
    button.setAttribute("aria-label", `Эпоха ${entry.epoch}`);
    button.addEventListener("click", () => renderEpoch(entry.epoch));
    tabs.append(button);
  });
  renderEpoch(0);
}

function selectTest(index) {
  selectedTest = index;
  testRan = false;
  testRunId++;
  $("test-card-grid").querySelectorAll(".test-card").forEach((button) => {
    const active = Number(button.dataset.index) === index;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("test-result").textContent = "INPUT SELECTED / OUTPUT PENDING_";
  $("test-probabilities").innerHTML = "";
  $("reveal-test").disabled = true;
}

function initTest() {
  const grid = $("test-card-grid");
  DATA.testCards.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "test-card";
    button.dataset.index = index;
    button.innerHTML = `<canvas width="168" height="168" aria-hidden="true"></canvas><span><b>ОБЪЕКТ 0${index + 1}</b><b>#${String(card.index).padStart(4, "0")}</b></span>`;
    button.setAttribute("aria-label", `Выбрать проверочное изображение ${index + 1}`);
    button.addEventListener("click", () => selectTest(index));
    grid.append(button);
    drawPixels(button.querySelector("canvas"), card.pixels);
  });
  selectTest(0);
  $("run-test").addEventListener("click", () => {
    const card = DATA.testCards[selectedTest];
    const currentRunId = ++testRunId;
    testRan = true;
    $("test-result").textContent = "RUNNING: INPUT → FILTERS → MAPS → OUTPUT ...";
    $("test-probabilities").innerHTML = "";
    $("reveal-test").disabled = true;
    setTimeout(() => {
      if (!testRan || currentRunId !== testRunId) return;
      $("test-result").textContent = `OUTPUT: ${DATA.classes[card.predicted].toUpperCase()} / МЕТКА СКРЫТА`;
      const top = card.probs.map((value, i) => ({ value, i })).sort((a, b) => b.value - a.value).slice(0, 3);
      for (const item of top) {
        const row = document.createElement("div");
        row.className = "test-prob-row";
        row.innerHTML = `<span></span><i></i><strong>${pct(item.value)}</strong>`;
        row.querySelector("span").textContent = DATA.classes[item.i];
        row.querySelector("i").style.width = `${item.value * 100}%`;
        $("test-probabilities").append(row);
      }
      $("reveal-test").disabled = false;
    }, 850);
  });
  $("reveal-test").addEventListener("click", () => {
    const card = DATA.testCards[selectedTest];
    const correct = card.predicted === card.label;
    $("test-result").innerHTML = `OUTPUT: ${DATA.classes[card.predicted].toUpperCase()}<br>МЕТКА: ${DATA.classes[card.label].toUpperCase()}<br>${correct ? "СОВПАДЕНИЕ ✓" : "ОШИБКА / СЕТЬ ПРОДОЛЖАЕТ ПУТАТЬ ВЕЩИ"}`;
  });
}

function initFinale() {
  drawPixels($("final-canvas"), DATA.focus.pixels);
  $("final-accuracy").textContent = (DATA.testAccuracy * 100).toFixed(1).replace(".", ",");
  $("human-first-answer").textContent = firstGuess === null ? "Вы ещё не выбрали" : DATA.classes[firstGuess];
  $("machine-final-answer").textContent = DATA.classes[DATA.focus.predicted];
}

function initScrollEffects() {
  const reveals = document.querySelectorAll(".reveal");
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .08 });
  reveals.forEach((element) => revealObserver.observe(element));

  const navLinks = document.querySelectorAll("[data-nav]");
  const chapters = [...document.querySelectorAll(".chapter")];
  const updateHeader = () => {
    const y = 100;
    let active = null;
    for (const chapter of chapters) {
      const rect = chapter.getBoundingClientRect();
      if (rect.top <= y && rect.bottom > y) { active = chapter; break; }
    }
    navLinks.forEach((link) => link.classList.toggle("active", active && link.dataset.nav === active.id));
    const under = document.elementFromPoint(window.innerWidth / 2, Math.min(window.innerHeight - 1, 85));
    $("site-header").classList.toggle("machine-visible", Boolean(under?.closest(".machine-panel, .intro-stage.is-dark")));
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    $("site-header").style.setProperty("--progress", scrollable > 0 ? `${window.scrollY / scrollable * 100}%` : "0%");
  };
  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", updateHeader);
  updateHeader();
}

async function main() {
  try {
    const response = await fetch("./data/demo.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    DATA = await response.json();
    selectedMap = DATA.selectedFilter;
    await window.initIntro(DATA.focus);
    initInputDiagrams();
    renderGuessOptions();
    initPixelInspector();
    initFilter();
    initMaps();
    initOutput();
    initError();
    initTraining();
    initTest();
    initFinale();
    initScrollEffects();
    setTimeout(() => $("boot-cover").classList.add("is-gone"), 400);
  } catch (error) {
    console.error("Cannot load Fashion-MNIST demo data", error);
    $("boot-cover").textContent = "НЕ УДАЛОСЬ ЗАГРУЗИТЬ ДАННЫЕ. ОТКРОЙТЕ САЙТ ЧЕРЕЗ ЛОКАЛЬНЫЙ СЕРВЕР.";
  }
}

main();
