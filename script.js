// Quick view (set in the head) shows the same still layout as reduced motion.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("quick");

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
    const opening = on && pane.hidden;
    pane.hidden = !on;
    // Hidden panes still take up space, so their bars wait for the tab to open before growing.
    if (on && !reduceMotion) pane.querySelectorAll(".bars:not(.play), .pipeline:not(.play), .growth:not(.play)").forEach((b) => b.classList.add("play"));
    // The new pane fades up into place instead of swapping in.
    if (opening && !reduceMotion && pane.animate) {
      pane.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.23, 1, .32, 1)" });
    }
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

/* ---------- Top bar: the section menu on small screens ---------- */

const topnav = document.getElementById("topnav");
const menuBtn = document.getElementById("menu-toggle");
if (topnav && menuBtn) {
  const isOpen = () => topnav.classList.contains("is-open");
  const setMenu = (open) => {
    topnav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Close" : "Menu";
  };
  menuBtn.addEventListener("click", () => {
    setMenu(!isOpen());
    if (isOpen()) topnav.querySelector("a").focus();
  });
  topnav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOpen()) return;
    setMenu(false);
    menuBtn.focus();
  });
  document.addEventListener("pointerdown", (e) => { if (isOpen() && !e.target.closest(".topbar")) setMenu(false); });
}

/* ---------- Sidebar: highlight the section in view ---------- */

const navLinks = [...document.querySelectorAll(".topnav a")];
// Contact is too short to ever reach the band below, so the very bottom of the page counts as Contact.
let spied = "", atEnd = false;
// Wide screens also get a rail of the same sections down the left edge (hidden by CSS elsewhere).
const rail = document.createElement("nav");
rail.className = "rail";
rail.setAttribute("aria-label", "Page sections");
rail.innerHTML = `<ol>${navLinks.map((a) => `<li><a href="${a.getAttribute("href")}"><span>${a.textContent}</span></a></li>`).join("")}</ol>`;
document.body.append(rail);
const railLinks = [...rail.querySelectorAll("a")];
const railTargets = railLinks.map((a) => document.querySelector(a.getAttribute("href")));
const markNav = () => {
  const id = atEnd ? "contact" : spied;
  [...navLinks, ...railLinks].forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === `#${id}`));
};
// The rail's line reaches each dot as its section crosses 40% of the window, and fills between dots in proportion.
const paintRail = () => {
  if (!rail.getClientRects().length) return; // hidden below 80rem
  const y = window.innerHeight * 0.4;
  const tops = railTargets.map((s) => (s ? s.getBoundingClientRect().top : Infinity));
  let i = 0;
  while (i < tops.length - 1 && tops[i + 1] <= y) i++;
  const span = tops[i + 1] - tops[i];
  const f = i < tops.length - 1 && span > 0 ? Math.max(0, Math.min(1, (y - tops[i]) / span)) : 0;
  const p = atEnd ? 1 : (i + f) / (tops.length - 1);
  rail.firstElementChild.style.setProperty("--p", p.toFixed(4));
};
if ("IntersectionObserver" in window && navLinks.length) {
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href")));
  // The highlight tiles are the project index, so they count as Projects.
  const highlights = document.getElementById("highlights");
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        spied = e.target === highlights ? "projects" : e.target.id;
        markNav();
      });
    },
    { rootMargin: "-35% 0px -60% 0px" }
  );
  [...sections, highlights].forEach((s) => s && spy.observe(s));
}

/* ---------- Quick view: the whole page at once, without the scroll stories ---------- */

const quickBtn = document.getElementById("quick-toggle");
if (quickBtn) {
  const quickOn = document.documentElement.classList.contains("quick");
  quickBtn.setAttribute("aria-pressed", String(quickOn));
  if (quickOn) quickBtn.title = "Bring the scroll stories back";
  quickBtn.addEventListener("click", () => {
    try {
      sessionStorage.setItem("view", quickOn ? "full" : "quick");
      sessionStorage.setItem("view-return", (atEnd ? "contact" : spied) || "about");
    } catch (e) {}
    // The two layouts differ in length, so the old scroll position means nothing. showpieces.js returns to the section once the page has measured itself.
    const url = new URL(location.href);
    url.searchParams.delete("quick");
    history.scrollRestoration = "manual";
    history.replaceState(null, "", url);
    location.reload();
  });
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

/* ---------- Motion ---------- */

const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Headline rise: wrap each word so CSS can slide it up from behind a mask.
const splitWords = (el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = "";
  words.forEach((word, i) => {
    const mask = document.createElement("span");
    mask.className = "w";
    const inner = document.createElement("span");
    inner.textContent = word;
    inner.style.setProperty("--i", i);
    mask.append(inner);
    el.append(mask, i < words.length - 1 ? " " : "");
  });
  el.classList.add("is-split");
};
const headline = document.getElementById("about-title");
if (headline && !reduceMotion) splitWords(headline);

// Reveal on scroll. Anything already on screen at load is left alone, so nothing above the fold flickers.
if (!reduceMotion && "IntersectionObserver" in window) {
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      revealer.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  const firstTile = document.querySelector(".hl__tile");
  document.querySelectorAll(".highlights__title, .hl__tile, .block__head, .deep__head, .skills-map, .soft-skills, .edu__card, .contact").forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    // Cards that sit side by side come in one after another.
    if (el.matches(".edu__card")) el.style.setProperty("--i", [...el.parentElement.children].indexOf(el));
    // Highlight tiles arrive in a short diagonal wave, left to right and top to bottom.
    if (el.matches(".hl__tile")) {
      const col = Math.round((el.offsetLeft - firstTile.offsetLeft) / el.offsetWidth);
      const row = Math.round((el.offsetTop - firstTile.offsetTop) / el.offsetHeight);
      el.style.setProperty("--i", col + Math.min(row, 1));
    }
    // Section titles rise word by word, like the headline, once their block reveals. The contact line fills in letter by letter instead (showpieces.js).
    if (el.matches(".block__head")) splitWords(el.querySelector("h2"));
    el.classList.add("reveal");
    revealer.observe(el);
  });
}

if (finePointer && !reduceMotion) {
  // Buttons lean a few pixels toward the pointer; the contact buttons pull twice as far, like a magnet.
  document.querySelectorAll(".btn").forEach((btn) => {
    const k = btn.closest(".contact") ? 2 : 1;
    const cap = (v) => Math.max(-6 * k, Math.min(6 * k, v));
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.translate = `${cap((e.clientX - r.left - r.width / 2) * 0.2 * k)}px ${cap((e.clientY - r.top - r.height / 2) * 0.3 * k)}px`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.translate = ""; });
  });

  // 3D tilt toward the pointer, at most one update per frame.
  document.querySelectorAll(".project .window, .project .flow-diagram, .project .phones").forEach((el) => {
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

  // Focus brackets and click ripple share one layer and one rAF loop that stops when everything settles.
  const root = document.documentElement;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML =
    '<span class="cursor__corner"></span><span class="cursor__corner"></span><span class="cursor__corner"></span><span class="cursor__corner"></span>' +
    '<span class="cursor__dot"></span>';
  document.body.append(layer);
  const corners = [...layer.querySelectorAll(".cursor__corner")].map((el) => ({ el, x: 0, y: 0 }));
  const dot = layer.querySelector(".cursor__dot");
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
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest(FRAMEABLE);
    const r = t && t.getBoundingClientRect();
    target = t && r.width < 520 && r.height < 160 ? t : null;
    root.classList.toggle("cursor-hover", !!t);
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

  const hide = () => root.classList.remove("cursor-on");
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
document.querySelectorAll(".bars, .pipeline").forEach((list) => {
  [...list.children].forEach((li, i) => li.style.setProperty("--i", i));
});
playOnce([...document.querySelectorAll(".bars, .balance__bar")].filter((b) => !b.closest(".pane")), 0.5);

/* ---------- Scroll-linked: progress bar (the timeline line lives in showpieces.js) ---------- */

const topbar = document.querySelector(".topbar");
const progress = document.createElement("div");
progress.className = "progress";
progress.setAttribute("aria-hidden", "true");
if (topbar) topbar.append(progress);

let scrollFrame = 0;
const paintScroll = () => {
  scrollFrame = 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pageP = max > 0 ? window.scrollY / max : 0;
  progress.style.transform = `scaleX(${pageP.toFixed(4)})`;
  const end = max > 0 && window.scrollY >= max - 2;
  if (end !== atEnd) { atEnd = end; markNav(); }
  paintRail();
};
const scheduleScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(paintScroll); };
window.addEventListener("scroll", scheduleScroll, { passive: true });
window.addEventListener("resize", scheduleScroll);
paintScroll();

/* ---------- Midnight satin behind the whole page ----------
   One fixed canvas, one full-screen triangle and a fragment shader. The cloth height comes from layered sines bent by slow noise,
   lit from low at the side: slopes facing the light catch a band of blue-grey, the rest falls to black, a thin blue edge runs
   along each fold and a glossy highlight sits on the ridges.
   In the intro the satin is at full strength and stays quiet behind the text on the left. As the intro scrolls away it dims and
   moves out to the margins, so it never sits bright behind body text further down.
   Rendered at half size, capped at 30 fps, stopped while the tab is hidden, and drawn as still frames with reduced motion.
   The light swings toward the pointer over the intro, the cloth ripples where it moves, and fast scrolling speeds the folds up. */
const SILK = {
  speed: 2,
  gloss: 1.6,
  calm: 0.82, // how much quieter the intro is behind its text
  page: 0.5, // strength further down, in the margins
  pageEnd: 0.66, // and in the last screen, where it swells up behind the contact card
  middle: 0.3, // behind the content column, as a share of the margins
  // The base lift, the band of light on each fold, the gloss, and the blue edge light
  base: [0.003, 0.006, 0.016],
  band: [0.3, 0.4, 0.62],
  spec: [0.16, 0.19, 0.24],
  edge: [0.05, 0.22, 0.42],
};
const SILK_FRAG = `
precision mediump float;
uniform vec2 res, mouse;
uniform float time, gloss, calm, amp, lit, hero, page, middle, zoom;
uniform vec3 cBase, cBand, cSpec, cEdge;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float cloth(vec2 p, float t) {
  p += 1.4 * vec2(noise(p * 0.7 + vec2(0.0, t * 0.06)), noise(p * 0.7 + vec2(4.3, -t * 0.05))) - 0.7;
  float h = sin(p.x * 1.6 + sin(p.y * 0.8 + t * 0.21) * 1.7 + t * 0.12);
  h += 0.55 * sin(p.x * 2.9 - p.y * 0.5 + sin(p.y * 1.3 - t * 0.17) * 1.3 - t * 0.15);
  h += 0.22 * sin(p.x * 5.3 + p.y * 1.1 + t * 0.23);
  return h;
}
// Turned about 30 degrees and squeezed, so the folds run long and diagonal. zoom pushes in as the intro is covered.
vec2 toP(vec2 frag) { vec2 p = (frag - 0.5 * res) / res.y * 3.2 / zoom; p = mat2(0.878, 0.479, -0.479, 0.878) * p; p.x *= 0.6; return p; }
// The cloth plus a ripple spreading from the pointer, fading with distance and with time since the last move
float surf(vec2 p, vec2 m) {
  float d = length(p - m);
  return cloth(p, time) + amp * 0.55 * sin(d * 9.0 - time * 3.0) * exp(-d * 1.6);
}
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = toP(gl_FragCoord.xy);
  vec2 m = toP(mouse * res);
  float e = 0.012;
  float h = surf(p, m);
  vec3 n = normalize(vec3(-(surf(p + vec2(e, 0.0), m) - h) / e * 0.6, -(surf(p + vec2(0.0, e), m) - h) / e * 0.6, 1.0));
  vec3 L = normalize(vec3(mix(-0.7, (mouse.x - 0.5) * 1.6, lit), mix(0.45, (mouse.y - 0.5) * 1.6 + 0.2, lit), 0.35));
  float nl = dot(n, L);
  float band = pow(0.5 + 0.5 * nl, 8.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 40.0);
  float edge = exp(-pow((nl - 0.25) / 0.09, 2.0)) * band;
  vec3 col = cBase + band * cBand + spec * cSpec * gloss + edge * cEdge;
  // Wide screens only: on upright ones the text runs the full width, so everything stays at the quiet level
  float wide = smoothstep(0.9, 1.3, res.x / res.y);
  float intro = mix(1.0 - calm, 1.0, smoothstep(0.5, 0.9, uv.x) * wide);
  float aside = page * mix(middle, 1.0, smoothstep(0.3, 0.5, abs(uv.x - 0.5)) * wide);
  // Fades out under the top bar
  float focus = mix(aside, intro, hero) * smoothstep(1.0, 0.9, uv.y);
  gl_FragColor = vec4(col * focus, 1.0);
}`;

(() => {
  const hero = document.querySelector(".hero");
  const canvas = document.createElement("canvas");
  canvas.className = "bg-silk";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
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
  const u = (name) => gl.getUniformLocation(prog, name);
  const uRes = u("res"), uTime = u("time"), uMouse = u("mouse"), uAmp = u("amp"), uLit = u("lit"), uHero = u("hero"), uZoom = u("zoom"), uPage = u("page");
  gl.uniform1f(u("gloss"), SILK.gloss);
  gl.uniform1f(u("calm"), SILK.calm);
  gl.uniform1f(u("middle"), SILK.middle);
  gl.uniform3fv(u("cBase"), SILK.base);
  gl.uniform3fv(u("cBand"), SILK.band);
  gl.uniform3fv(u("cSpec"), SILK.spec);
  gl.uniform3fv(u("cEdge"), SILK.edge);

  // Starts on a stretch of the cloth with its folds on the right, clear of the text. Also the still frame with reduced motion.
  let clock = 96, last = 0, frame = 0;
  // Pointer in canvas units (0 to 1, y up), eased toward its target each frame
  const ptr = { x: 0.7, y: 0.6, tx: 0.7, ty: 0.6, amp: 0, lit: 0, tlit: 0 };
  let lastY = window.scrollY, boost = 0;

  // How far the intro has scrolled away: 0 at the top, 1 once its bottom passes under the top bar.
  // Measured from the pin's placeholder once showpieces.js has pinned the intro, so a moved intro never skews it.
  // And how far into the last screen and a bit, where the satin swells up for the closing contact card.
  let heroEnd = 1, endFrom = Infinity;
  const measure = () => {
    endFrom = document.documentElement.scrollHeight - innerHeight * 2.2;
    if (!hero) return;
    const box = hero.closest(".pin-spacer") || hero;
    heroEnd = Math.max(1, box.getBoundingClientRect().top + window.scrollY + hero.offsetHeight - 60);
  };
  const ease = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const away = () => ease(window.scrollY / heroEnd);
  const closing = () => ease((window.scrollY - endFrom) / (innerHeight * 1.2));

  const draw = () => {
    const a = away();
    gl.uniform1f(uTime, clock);
    gl.uniform2f(uMouse, ptr.x, ptr.y);
    gl.uniform1f(uAmp, ptr.amp * (1 - a));
    gl.uniform1f(uLit, ptr.lit * (1 - a));
    gl.uniform1f(uHero, 1 - a);
    gl.uniform1f(uZoom, 1 + 0.25 * a);
    gl.uniform1f(uPage, SILK.page + (SILK.pageEnd - SILK.page) * closing());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const size = () => {
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * 0.5));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * 0.5));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    measure();
    draw();
  };
  const loop = (now) => {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(now - last, 100);
    if (dt < 33) return;
    // Scroll speed in px per ms, eased so a flick speeds the folds up and they settle back
    const v = Math.abs(window.scrollY - lastY) / dt;
    lastY = window.scrollY;
    boost += (Math.min(v * 4, 10) - boost) * 0.15;
    clock += (dt / 1000) * (SILK.speed + boost);
    ptr.x += (ptr.tx - ptr.x) * 0.12;
    ptr.y += (ptr.ty - ptr.y) * 0.12;
    ptr.lit += (ptr.tlit - ptr.lit) * 0.08;
    ptr.amp *= 0.94;
    last = now;
    draw();
  };

  size();
  new ResizeObserver(size).observe(canvas);
  // The intro's pin and the page length are measured again whenever the scroll stories re-measure
  window.addEventListener("load", () => { measure(); draw(); });
  if (window.ScrollTrigger) ScrollTrigger.addEventListener("refresh", () => { measure(); draw(); });
  requestAnimationFrame(() => canvas.classList.add("is-on"));

  if (reduceMotion) {
    // Still frames: the satin only redraws to dim as the intro scrolls away
    window.addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); }, { passive: true });
    return;
  }
  if (hero) {
    hero.addEventListener("pointermove", (e) => {
      ptr.tx = e.clientX / innerWidth;
      ptr.ty = 1 - e.clientY / innerHeight;
      ptr.tlit = 1;
      ptr.amp = Math.min(1, ptr.amp + 0.08);
    });
    hero.addEventListener("pointerleave", () => { ptr.tx = 0.7; ptr.ty = 0.6; ptr.tlit = 0; });
  }
  last = performance.now();
  frame = requestAnimationFrame(loop);
})();
