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
    // pathLength 1 lets the CSS draw the line in with a dash offset, whatever its real length.
    svgEl("path", { class: "line", d, pathLength: 1, "aria-hidden": "true" })
  );
  const marker = svgEl("line", { class: "marker", "aria-hidden": "true" });
  const markerLabel = svgEl("text", { class: "marker-label", "text-anchor": "middle", "aria-hidden": "true" });
  svg.append(marker, markerLabel);

  const points = STEPS.map((s, i) => {
    const dot = svgEl("circle", { class: "point", cx: x(i), cy: y(s.acc), r: 5, "aria-hidden": "true" });
    dot.style.setProperty("--i", i);
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
    const pane = document.getElementById(t.getAttribute("aria-controls"));
    pane.hidden = !on;
    // Hidden panes still take up space, so their bars wait for the tab to open before growing.
    if (on && !reduceMotion) pane.querySelectorAll(".bars:not(.play)").forEach((b) => b.classList.add("play"));
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

/* ---------- Project carousel ---------- */

const projects = [...document.querySelectorAll(".project")];
const track = document.getElementById("deck-track");
const deckControls = document.querySelector(".deck__controls");
const deckPrev = document.getElementById("deck-prev");
const deckNext = document.getElementById("deck-next");
const deckDots = document.getElementById("deck-dots");
const deckCount = document.getElementById("deck-count");
let slides = projects;
let active = 0;

// Offset of each card from the centre of the track, in card widths.
// CSS turns that into the 3D tilt, scale and fade.
function paintDeck() {
  const mid = track.scrollLeft + track.clientWidth / 2;
  let nearest = 0;
  let best = Infinity;
  slides.forEach((s, i) => {
    const o = (s.offsetLeft + s.offsetWidth / 2 - mid) / s.offsetWidth;
    s.style.setProperty("--o", Math.max(-1.5, Math.min(1.5, o)).toFixed(3));
    s.style.setProperty("--a", Math.min(1, Math.abs(o)).toFixed(3));
    if (Math.abs(o) < best) { best = Math.abs(o); nearest = i; }
  });
  if (nearest !== active || !slides[active].classList.contains("is-active")) setActive(nearest);
}

function setActive(i) {
  active = i;
  projects.forEach((p) => p.classList.toggle("is-active", p === slides[i]));
  deckDots.querySelectorAll("button").forEach((d, j) => d.setAttribute("aria-current", String(j === i)));
  deckDots.style.setProperty("--i", i);
  deckCount.textContent = `${i + 1} / ${slides.length}`;
  deckPrev.disabled = i === 0;
  deckNext.disabled = i === slides.length - 1;
}

function goTo(i, instant = false) {
  const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
  if (!s) return;
  track.scrollTo({
    left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2,
    behavior: instant || reduceMotion ? "auto" : "smooth",
  });
}

function resetDeck() {
  slides = projects.filter((p) => !p.hidden);
  deckDots.textContent = "";
  slides.forEach((s, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Project ${i + 1}: ${s.querySelector("h3").textContent}`);
    dot.addEventListener("click", () => goTo(i));
    deckDots.append(dot);
  });
  const pill = document.createElement("span");
  pill.className = "deck__pill";
  pill.setAttribute("aria-hidden", "true");
  deckDots.append(pill);
  deckControls.hidden = slides.length < 2;
  if (!slides.length) return;
  active = 0;
  goTo(0, true);
  setActive(0);
  paintDeck();
}

if (track) {
  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (slides.length) paintDeck(); }); };
  track.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);

  deckPrev.addEventListener("click", () => goTo(active - 1));
  deckNext.addEventListener("click", () => goTo(active + 1));
  track.addEventListener("keydown", (e) => {
    if (e.target !== track) return;
    const keys = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    goTo(keys[e.key]);
  });

  // A card turned to the side is brought to the front first instead of following its links.
  track.addEventListener("click", (e) => {
    const card = e.target.closest(".project");
    if (!card || card.classList.contains("is-active")) return;
    e.preventDefault();
    e.stopPropagation();
    goTo(slides.indexOf(card));
  }, true);
  track.addEventListener("focusin", (e) => {
    const card = e.target.closest(".project");
    if (card && !card.classList.contains("is-active")) goTo(slides.indexOf(card));
  });

  resetDeck();
}

/* ---------- Project filters ---------- */

const filterButtons = [...document.querySelectorAll(".filters button")];
const empty = document.getElementById("empty");
function setFilter(filter) {
  let shown = 0;
  projects.forEach((p) => {
    const match = filter === "all" || p.dataset.tags.split(" ").includes(filter);
    p.hidden = !match;
    if (match) shown++;
  });
  filterButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
  empty.hidden = shown > 0;
  if (track) resetDeck();
}

// The carousel fades down, switches, then rises back in, instead of jumping.
let filterOut = null;
function applyFilter(filter) {
  if (reduceMotion || !track || !track.animate) { setFilter(filter); return; }
  if (filterOut) filterOut.cancel();
  filterOut = track.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }], { duration: 150, easing: "ease-in", fill: "forwards" });
  filterOut.onfinish = () => {
    setFilter(filter);
    track.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "cubic-bezier(.2, .7, .2, 1)" });
    filterOut.cancel();
    filterOut = null;
  };
}
document.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));

// Matrix header links jump to a project; make sure it isn't filtered out, then turn the carousel to it.
document.querySelectorAll('.matrix thead a').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target || !track) return;
    e.preventDefault();
    if (target.hidden) setFilter("all");
    document.getElementById("projects").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    goTo(slides.indexOf(target));
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
  // The cursor shows from the start, so the finished session looks the same before and after typing.
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  term.append(cursor);
  const pre = term.closest("pre");
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    // Hold the finished height while typing, so this card (and every card matched to it) never changes size.
    pre.style.minHeight = getComputedStyle(pre).height; // exact, unrounded height
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

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

/* ---------- Motion ---------- */

const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Headline rise: wrap each word so CSS can slide it up from behind a mask.
const headline = document.getElementById("about-title");
if (headline && !reduceMotion) {
  const words = headline.textContent.trim().split(/\s+/);
  headline.textContent = "";
  words.forEach((word, i) => {
    const mask = document.createElement("span");
    mask.className = "w";
    const inner = document.createElement("span");
    inner.textContent = word;
    inner.style.setProperty("--i", i);
    mask.append(inner);
    headline.append(mask, i < words.length - 1 ? " " : "");
  });
  headline.classList.add("is-split");
}

// Reveal on scroll. Anything already on screen at load is left alone, so nothing above the fold flickers.
if (!reduceMotion && "IntersectionObserver" in window) {
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      revealer.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(".block__head, .filters, .deck, .matrix-wrap, .soft-skills, .timeline > li, .edu__card, .contact").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    // Cards that sit side by side come in one after another.
    if (el.matches(".edu__card")) el.style.setProperty("--i", [...el.parentElement.children].indexOf(el));
    el.classList.add("reveal");
    revealer.observe(el);
  });
}

if (finePointer && !reduceMotion) {
  // Buttons lean a few pixels toward the pointer.
  const cap = (v) => Math.max(-6, Math.min(6, v));
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.translate = `${cap((e.clientX - r.left - r.width / 2) * 0.2)}px ${cap((e.clientY - r.top - r.height / 2) * 0.3)}px`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.translate = ""; });
  });

  // 3D tilt toward the pointer, at most one update per frame. Cards turned away in the carousel stay still.
  document.querySelectorAll(".project .window, .project .flow, .project .phones").forEach((el) => {
    el.classList.add("tilt", "tilt-glare");
    let px = 0, py = 0, frame = 0;
    const paint = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const nx = (px - r.left) / r.width;
      const ny = (py - r.top) / r.height;
      el.style.transform = `perspective(900px) rotateX(${((0.5 - ny) * 6).toFixed(2)}deg) rotateY(${((nx - 0.5) * 8).toFixed(2)}deg)`;
      el.style.setProperty("--gx", `${px - r.left}px`);
      el.style.setProperty("--gy", `${py - r.top}px`);
    };
    el.addEventListener("pointermove", (e) => {
      const card = el.closest(".project");
      if (card && !card.classList.contains("is-active")) return;
      px = e.clientX;
      py = e.clientY;
      el.classList.add("is-tilting");
      if (!frame) frame = requestAnimationFrame(paint);
    });
    el.addEventListener("pointerleave", () => {
      el.classList.remove("is-tilting");
      el.style.transform = "";
    });
  });

  // Focus brackets, project preview and click ripple share one layer and one rAF loop that stops when everything settles.
  const root = document.documentElement;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML =
    '<span class="cursor__corner"></span><span class="cursor__corner"></span><span class="cursor__corner"></span><span class="cursor__corner"></span>' +
    '<span class="cursor__dot"></span>' +
    '<div class="peek"><p class="peek__meta"></p><p class="peek__title"></p><p class="peek__text"></p><p class="peek__stack"></p></div>';
  document.body.append(layer);
  const corners = [...layer.querySelectorAll(".cursor__corner")].map((el) => ({ el, x: 0, y: 0 }));
  const dot = layer.querySelector(".cursor__dot");
  const peek = { el: layer.querySelector(".peek"), x: 0, y: 0, on: false };
  const move = (el, x, y) => { el.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  const approach = (o, tx, ty, k) => {
    o.x += (tx - o.x) * k;
    o.y += (ty - o.y) * k;
    if (Math.abs(tx - o.x) > 0.1 || Math.abs(ty - o.y) > 0.1) return true;
    o.x = tx;
    o.y = ty;
    return false;
  };

  let px = 0, py = 0, down = false, target = null, frame = 0, last = 0, snap = true;
  const step = (now) => {
    frame = 0;
    const dt = last ? Math.min(now - last, 64) : 16.7;
    last = now;
    // Frame-rate independent easing, so it feels the same at 60Hz and 144Hz.
    const k = (lag) => (snap ? 1 : 1 - Math.pow(1 - lag, dt / 16.7));
    let busy = false;

    move(dot, px, py);
    let box;
    if (target && target.isConnected) {
      const r = target.getBoundingClientRect();
      const g = down ? 3 : 6;
      box = [r.left - g, r.top - g, r.right + g, r.bottom + g];
    } else {
      const g = down ? 7 : 12;
      box = [px - g, py - g, px + g, py + g];
    }
    const [x0, y0, x1, y1] = box;
    [[x0, y0], [x1 - 10, y0], [x0, y1 - 10], [x1 - 10, y1 - 10]].forEach(([gx, gy], i) => {
      if (approach(corners[i], gx, gy, k(0.22))) busy = true;
      move(corners[i].el, corners[i].x, corners[i].y);
    });

    if (peek.on) {
      if (approach(peek, px, py, k(0.18))) busy = true;
      peek.el.classList.toggle("is-left", px + peek.el.offsetWidth + 40 > window.innerWidth);
      peek.el.classList.toggle("is-up", py + peek.el.offsetHeight + 40 > window.innerHeight);
      move(peek.el, peek.x, peek.y);
    }

    snap = false;
    if (busy) frame = requestAnimationFrame(step);
    else last = 0;
  };
  const kick = () => { if (!frame) frame = requestAnimationFrame(step); };

  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX;
    py = e.clientY;
    if (!root.classList.contains("cursor-on")) { root.classList.add("cursor-on"); snap = true; }
    kick();
  }, { passive: true });
  // The framed element moves under a still pointer while the page scrolls.
  window.addEventListener("scroll", () => { if (target) kick(); }, { passive: true });

  // Frame only things small enough to read as one control, not whole cards.
  const FRAMEABLE = "a, button, [role='tab'], [role='button']";
  const fillPeek = (project) => {
    const meta = project.querySelector(".project__meta");
    const year = [...meta.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    const [m, title, text, stack] = peek.el.children;
    m.textContent = `${meta.querySelector(".tag").textContent} · ${year}`;
    title.textContent = project.querySelector("h3").textContent;
    text.textContent = project.querySelector(".project__info > p:not(.project__meta)").textContent;
    stack.textContent = [...project.querySelectorAll(".stack li")].map((li) => li.textContent).join(" · ");
  };
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest(FRAMEABLE);
    const r = t && t.getBoundingClientRect();
    target = t && r.width < 520 && r.height < 160 ? t : null;
    root.classList.toggle("cursor-hover", !!t);

    // Project names in the skills table show a summary of that project.
    const link = e.target.closest(".matrix thead a");
    const project = link && document.querySelector(link.getAttribute("href"));
    if (project) {
      if (!peek.on) { peek.x = px; peek.y = py; }
      fillPeek(project);
      peek.on = true;
    } else {
      peek.on = false;
    }
    peek.el.classList.toggle("is-on", peek.on);
    kick();
  });

  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true;
    kick();
    const ring = document.createElement("span");
    ring.className = "click-ring";
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    layer.append(ring);
    ring.addEventListener("animationend", () => ring.remove());
  });
  document.addEventListener("pointerup", () => { down = false; kick(); });

  const hide = () => {
    root.classList.remove("cursor-on");
    peek.on = false;
    peek.el.classList.remove("is-on");
  };
  root.addEventListener("mouseleave", hide);
  window.addEventListener("blur", hide);
}

// Plays a one-off CSS animation (the .play class) the first time an element is mostly in view.
const playOnce = (els, threshold, onPlay) => {
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add("play");
      if (onPlay) onPlay(e.target);
    });
  }, { threshold });
  els.forEach((el) => io.observe(el));
};

// Chart draws itself. The class comes off afterwards so a redraw on resize doesn't replay it.
if (chartHost) playOnce([chartHost], 0.6, (el) => setTimeout(() => el.classList.remove("play"), 2500));

// Bars grow. The ProstadeNet comparison sits in a tab, which plays its bars when it opens (see activateTab).
document.querySelectorAll(".bars").forEach((list) => {
  [...list.children].forEach((li, i) => li.style.setProperty("--i", i));
});
playOnce([...document.querySelectorAll(".bars")].filter((b) => !b.closest(".pane")), 0.5);

// Count-up: the "At a glance" figures that start with a number count up from zero.
const glance = document.querySelector(".glance");
if (glance) {
  playOnce([glance], 0.5, () => {
    glance.querySelectorAll("strong").forEach((el) => {
      const m = el.textContent.match(/^(\d+(?:\.\d+)?)(.*)$/s);
      if (!m) return;
      const to = parseFloat(m[1]);
      const dec = (m[1].split(".")[1] || "").length;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / 1200);
        el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(dec) + m[2];
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

/* ---------- Scroll-linked: progress bar and timeline line ---------- */

const topbar = document.querySelector(".topbar");
const progress = document.createElement("div");
progress.className = "progress";
progress.setAttribute("aria-hidden", "true");
if (topbar) topbar.append(progress);

const timeline = document.querySelector(".timeline");
const timelineItems = timeline ? [...timeline.children] : [];
let itemTops = [];
const measureTimeline = () => { itemTops = timelineItems.map((li) => li.offsetTop + 26); }; // 26px: centre of each dot
if (timeline) {
  timeline.classList.add("is-live");
  measureTimeline();
  window.addEventListener("resize", measureTimeline);
}

let scrollFrame = 0;
const paintScroll = () => {
  scrollFrame = 0;
  // Read everything first, then write, so the browser never lays out twice in one frame.
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pageP = max > 0 ? window.scrollY / max : 0;
  let lineP = 0, lineH = 0;
  if (timeline) {
    const r = timeline.getBoundingClientRect();
    lineH = r.height - 16;
    // The line fills down to just past the middle of the window.
    lineP = Math.max(0, Math.min(1, (window.innerHeight * 0.6 - r.top - 8) / lineH));
  }
  progress.style.transform = `scaleX(${pageP.toFixed(4)})`;
  if (timeline) {
    timeline.style.setProperty("--p", lineP.toFixed(4));
    timelineItems.forEach((li, i) => li.classList.toggle("is-lit", itemTops[i] <= 8 + lineP * lineH));
  }
};
const scheduleScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(paintScroll); };
window.addEventListener("scroll", scheduleScroll, { passive: true });
window.addEventListener("resize", scheduleScroll);
paintScroll();

/* ---------- Liquid silk behind the intro ----------
   One full-screen triangle and a fragment shader. The cloth height comes from layered sines bent by slow noise,
   lit with a soft diffuse term and a glossy highlight. Rendered at half size, capped at 30 fps,
   paused while the intro is off screen, and drawn once as a still frame with reduced motion. */
const SILK = { speed: 2, gloss: 1.6, calm: 0.6 };
const SILK_FRAG = `
precision mediump float;
uniform vec2 res;
uniform float time, gloss, calm;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float cloth(vec2 p, float t) {
  p += 0.9 * vec2(noise(p * 0.7 + vec2(0.0, t * 0.06)), noise(p * 0.7 + vec2(4.3, -t * 0.05))) - 0.45;
  float h = sin(p.x * 1.6 + sin(p.y * 0.8 + t * 0.21) * 1.7 + t * 0.12);
  h += 0.55 * sin(p.x * 2.9 - p.y * 0.5 + sin(p.y * 1.3 - t * 0.17) * 1.3 - t * 0.15);
  h += 0.22 * sin(p.x * 5.3 + p.y * 1.1 + t * 0.23);
  return h;
}
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y * 2.3;
  p.x *= 0.85;
  float e = 0.012;
  float h = cloth(p, time);
  vec3 n = normalize(vec3(-(cloth(p + vec2(e, 0.0), time) - h) / e * 0.22, -(cloth(p + vec2(0.0, e), time) - h) / e * 0.22, 1.0));
  vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 9.0);
  float sheen = pow(1.0 - n.z, 1.6);
  // Quieter behind the text on the left, fading out under the top bar and towards the next section
  float focus = mix(1.0 - calm, 1.0, smoothstep(0.25, 0.75, uv.x));
  focus *= smoothstep(0.0, 0.35, uv.y) * smoothstep(1.0, 0.85, uv.y);
  float v = 0.01 + diff * diff * 0.16 + sheen * 0.12 + spec * 0.42 * gloss;
  gl_FragColor = vec4(vec3(v * focus) * vec3(0.96, 0.98, 1.03), 1.0);
}`;

(() => {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const canvas = document.createElement("canvas");
  canvas.className = "silk";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) { canvas.remove(); return; }

  const shader = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, SILK_FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "res");
  const uTime = gl.getUniformLocation(prog, "time");
  gl.uniform1f(gl.getUniformLocation(prog, "gloss"), SILK.gloss);
  gl.uniform1f(gl.getUniformLocation(prog, "calm"), SILK.calm);

  let clock = 8, last = 0, running = false, frame = 0;
  const draw = () => {
    gl.uniform1f(uTime, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const size = () => {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * 0.5));
    canvas.height = Math.max(1, Math.round(r.height * 0.5));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    draw();
  };
  const loop = (now) => {
    frame = 0;
    if (!running) return;
    const dt = Math.min(now - last, 100);
    if (dt >= 33) {
      clock += (dt / 1000) * SILK.speed;
      last = now;
      draw();
    }
    frame = requestAnimationFrame(loop);
  };

  size();
  new ResizeObserver(size).observe(canvas);
  requestAnimationFrame(() => canvas.classList.add("is-on"));
  if (reduceMotion) return;
  new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting;
    if (running && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }).observe(canvas);
})();
