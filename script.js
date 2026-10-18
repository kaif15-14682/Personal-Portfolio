const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- ProstadeNet ablation chart ---------- */

// From the thesis, Table 4.2. Each step keeps the best setting found so far.
const STEPS = [
  { label: "Baseline", acc: 96.07, text: "Baseline CNN: 5 convolution and 5 max-pooling layers, PReLU, Nadam optimizer, batch size 64." },
  { label: "Layers", acc: 96.83, text: "Layers changed to 3 convolution and 6 max-pooling." },
  { label: "Kernel size", acc: 96.91, text: "Kernel size set to 3 × 3, which beat 2 × 2, 4 × 4 and 5 × 5." },
  { label: "Filters", acc: 96.98, text: "Filter counts set to 32, 64, 128 and 256." },
  { label: "Pooling", acc: 96.98, text: "Max pooling kept. Average pooling scored 96.82%." },
  { label: "Activation", acc: 97.51, text: "Activation switched from PReLU to ReLU. Leaky ReLU and ELU scored lower." },
  { label: "Flatten", acc: 97.51, text: "Plain Flatten kept. Global max and global average pooling scored lower." },
  { label: "Batch size", acc: 97.93, text: "Batch size lowered to 16." },
  { label: "Loss", acc: 97.93, text: "Categorical cross-entropy kept. MSE, MAE and MSLE all scored lower." },
  { label: "Optimizer", acc: 98.41, text: "Optimizer switched from Nadam to Adam. SGD and Adamax scored lower." },
  { label: "Learning rate", acc: 99.83, text: "Learning rate raised from 0.0001 to 0.001." },
];

const Y_MIN = 95.5;
const Y_MAX = 100;
const M = { top: 26, right: 14, bottom: 30, left: 42 };
// The SVG is drawn at the container's real width so labels stay readable on phones.
let W = 600;
let H = 260;

const NS = "http://www.w3.org/2000/svg";
const svgEl = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const x = (i) => M.left + (i * (W - M.left - M.right)) / (STEPS.length - 1);
const y = (v) => M.top + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (H - M.top - M.bottom);

const chartHost = document.getElementById("step-chart");
const readout = document.getElementById("step-readout");
let chart = null;

function buildChart(container) {
  container.textContent = "";
  W = Math.round(Math.min(Math.max(container.clientWidth, 280), 720));
  H = W < 480 ? 220 : 260;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` });

  const grid = svgEl("g", { class: "grid", "aria-hidden": "true" });
  for (let v = 96; v <= 100; v++) {
    grid.append(svgEl("line", { x1: M.left, x2: W - M.right, y1: y(v), y2: y(v) }));
    const label = svgEl("text", { class: "tick", x: M.left - 10, y: y(v) + 4, "text-anchor": "end" });
    label.textContent = `${v}%`;
    grid.append(label);
  }
  STEPS.forEach((_, i) => {
    const label = svgEl("text", { class: "tick", x: x(i), y: H - 8, "text-anchor": "middle" });
    label.textContent = i;
    grid.append(label);
  });
  svg.append(grid);

  // Step-after line: accuracy holds until the next experiment changes it.
  let d = `M ${x(0)} ${y(STEPS[0].acc)}`;
  for (let i = 1; i < STEPS.length; i++) d += ` H ${x(i)} V ${y(STEPS[i].acc)}`;
  svg.append(
    svgEl("path", { class: "area", d: `${d} V ${H - M.bottom} H ${x(0)} Z`, "aria-hidden": "true" }),
    svgEl("path", { class: "line", d, "aria-hidden": "true" })
  );
  const marker = svgEl("line", { class: "marker", "aria-hidden": "true" });
  const markerLabel = svgEl("text", { class: "marker-label", "text-anchor": "middle", "aria-hidden": "true" });
  svg.append(marker, markerLabel);

  const points = STEPS.map((s, i) => {
    const dot = svgEl("circle", { class: "point", cx: x(i), cy: y(s.acc), r: 5, "aria-hidden": "true" });
    const hit = svgEl("circle", {
      class: "hit", cx: x(i), cy: y(s.acc), r: 14,
      tabindex: "0", role: "button",
      "aria-label": `Step ${i}, ${s.label}: ${s.acc.toFixed(2)}%`,
    });
    hit.addEventListener("click", () => select(i));
    hit.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); }
      if (e.key === "ArrowRight" && i < STEPS.length - 1) { e.preventDefault(); select(i + 1, true); }
      if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); select(i - 1, true); }
    });
    svg.append(dot, hit);
    return { dot, hit };
  });

  container.append(svg);
  return { marker, markerLabel, points };
}

let selected = STEPS.length - 1;
function select(i, moveFocus = false) {
  selected = i;
  const s = STEPS[i];
  const prev = i > 0 ? STEPS[i - 1].acc : null;
  let delta = "";
  if (prev !== null) delta = s.acc === prev ? " Same accuracy, kept for simplicity." : ` Up ${(s.acc - prev).toFixed(2)} points.`;
  readout.textContent = `Step ${i} of 10. ${s.text} Test accuracy ${s.acc.toFixed(2)}%.${delta}`;

  chart.points.forEach((p, j) => {
    p.dot.classList.toggle("is-active", j === i);
    p.hit.setAttribute("aria-pressed", String(j === i));
  });
  chart.marker.setAttribute("x1", x(i));
  chart.marker.setAttribute("x2", x(i));
  chart.marker.setAttribute("y1", y(s.acc));
  chart.marker.setAttribute("y2", H - M.bottom);
  chart.markerLabel.setAttribute("x", Math.min(Math.max(x(i), M.left + 26), W - M.right - 26));
  chart.markerLabel.setAttribute("y", y(s.acc) - 12);
  chart.markerLabel.textContent = `${s.acc.toFixed(2)}%`;
  if (moveFocus) chart.points[i].hit.focus();
}

if (chartHost) {
  chart = buildChart(chartHost);
  select(selected);
  let lastWidth = chartHost.clientWidth;
  window.addEventListener("resize", () => {
    if (chartHost.offsetParent === null || Math.abs(chartHost.clientWidth - lastWidth) < 40) return;
    lastWidth = chartHost.clientWidth;
    chart = buildChart(chartHost);
    select(selected);
  });
}

/* ---------- Tabs (ProstadeNet visual) ---------- */

const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(tab, focus = false) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    activateTab(tabs[(i + step + tabs.length) % tabs.length], true);
  });
});

/* ---------- Project filters ---------- */

const filterButtons = [...document.querySelectorAll(".filters button")];
const projects = [...document.querySelectorAll(".project")];
const empty = document.getElementById("empty");
function applyFilter(filter) {
  let shown = 0;
  projects.forEach((p) => {
    const match = filter === "all" || p.dataset.tags.split(" ").includes(filter);
    p.hidden = !match;
    if (match) shown++;
  });
  filterButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
  empty.hidden = shown > 0;
}
document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));

// Matrix header links jump to a project; make sure it isn't filtered out first.
document.querySelectorAll('.matrix thead a').forEach((a) => {
  a.addEventListener("click", () => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target && target.hidden) applyFilter("all");
  });
});

/* ---------- Sidebar: highlight the section in view ---------- */

const navLinks = [...document.querySelectorAll(".topnav a")];
if ("IntersectionObserver" in window && navLinks.length) {
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href")));
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === `#${e.target.id}`));
      });
    },
    { rootMargin: "-35% 0px -60% 0px" }
  );
  sections.forEach((s) => s && spy.observe(s));
}

/* ---------- Terminal: type the session once when it scrolls into view ---------- */

const term = document.querySelector("#term code");
if (term && !reduceMotion && "IntersectionObserver" in window) {
  const full = term.textContent;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const cursor = document.createElement("span");
    cursor.className = "cursor";
    let n = 0;
    const tick = () => {
      // Commands type character by character; program output appears a line at a time.
      const nextBreak = full.indexOf("\n", n);
      const lineStart = full.lastIndexOf("\n", n - 1) + 1;
      const isCommand = full.startsWith("$", lineStart);
      n = isCommand ? n + 1 : nextBreak === -1 ? full.length : nextBreak + 1;
      term.textContent = full.slice(0, n);
      term.append(cursor);
      if (n < full.length) setTimeout(tick, isCommand ? 45 : 140);
    };
    term.textContent = "";
    tick();
  }, { threshold: 0.5 });
  io.observe(term);
}

/* ---------- Copy email ---------- */

const copyBtn = document.getElementById("copy-email");
const copyStatus = document.getElementById("copy-status");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.email);
      copyStatus.textContent = "Email address copied.";
    } catch {
      copyStatus.textContent = `Couldn't copy. The address is ${copyBtn.dataset.email}`;
    }
  });
}

/* ---------- CV link: shown only once a public CV is in assets/ ---------- */

const cvLink = document.getElementById("cv-link");
if (cvLink && location.protocol.startsWith("http")) {
  fetch(cvLink.getAttribute("href"), { method: "HEAD" })
    .then((r) => { if (r.ok) cvLink.hidden = false; })
    .catch(() => {});
}

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();
