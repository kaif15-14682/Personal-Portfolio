/* Showpieces: smooth scrolling, the pinned scroll stories, the running mockups and the case studies.
   GSAP and ScrollTrigger drive the pins and scrubs, Lenis smooths the scroll. Without them, or with reduced motion,
   every piece falls back to a still layout that still reads on its own. */
(() => {
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOTION = !reduceMotion;
const G = window.gsap && window.ScrollTrigger ? window.gsap : null;
if (G) G.registerPlugin(ScrollTrigger);

const $ = (s) => document.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
const EASE_OUT = "cubic-bezier(.23, 1, .32, 1)";
const svgEl = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};
// One broken piece shouldn't take the rest of the page down with it.
const safe = (name, fn) => { try { fn(); } catch (e) { console.error(`showpiece "${name}" failed`, e); } };
const watch = (el, onIn, onOut, threshold = 0.25) => {
  if (!("IntersectionObserver" in window)) { onIn(); return; }
  new IntersectionObserver(([e]) => (e.isIntersecting ? onIn() : onOut && onOut()), { threshold }).observe(el);
};
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const barH = () => (document.querySelector(".topbar") || {}).offsetHeight || 0;
// Pinned stages sit below the top bar, which is two rows tall on phones; CSS sizes them with --bar.
const setBar = () => document.documentElement.style.setProperty("--bar", `${barH()}px`);
setBar();
window.addEventListener("resize", setBar);
const mm = G ? G.matchMedia() : null;

/* ---------- Smooth scrolling ---------- */

// Phones hide and show the address bar while scrolling; re-measuring every pin on that is what makes them jump.
if (G) ScrollTrigger.config({ ignoreMobileResize: true });

let lenis = null;
if (MOTION && G && window.Lenis) {
  // A slightly lower lerp than the default 0.1 glides a little longer after each wheel tick.
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  G.ticker.add((t) => lenis.raf(t * 1000));
  G.ticker.lagSmoothing(0);
}
const scrollToEl = (el) => {
  if (lenis) lenis.scrollTo(el, { offset: -barH() });
  else el.scrollIntoView({ behavior: MOTION ? "smooth" : "auto" });
};
// In-page links glide with the smooth scroll and land below the top bar.
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (e.defaultPrevented || !a || !lenis || a.closest(".case")) return;
  const target = document.querySelector(a.getAttribute("href"));
  if (!target) return;
  e.preventDefault();
  scrollToEl(target);
});

/* ---------- Light pools that drift at their own scroll speed ---------- */

safe("pools", () => {
  const POOLS = { projects: [["50%", -0.25]], how: [["20%", 0.2], ["80%", -0.15]], skills: [["15%", -0.2]], experience: [["85%", 0.25]], education: [["50%", -0.15]] };
  Object.entries(POOLS).forEach(([id, pools]) => {
    const section = document.getElementById(id);
    if (!section) return;
    pools.forEach(([x, speed]) => {
      const pool = document.createElement("div");
      pool.className = "pool";
      pool.setAttribute("aria-hidden", "true");
      pool.style.setProperty("--x", x);
      section.prepend(pool);
      if (!MOTION || !G) return;
      // Measured after the pinned sections, which add scroll space above most of these
      G.fromTo(pool, { y: -speed * 300 }, { y: speed * 300, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true, refreshPriority: -2 } });
    });
  });
});

/* ---------- Intro: holds while the next section slides up over it ---------- */

safe("hero", () => {
  if (!MOTION || !G) return;
  const hero = $("#about");
  // A short intro holds from the top; a tall one (phones) holds once its bottom is on screen, so none of it gets covered unread.
  const tall = () => hero.offsetHeight + barH() > innerHeight;
  const tl = G.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: hero, start: () => (tall() ? "bottom bottom" : `top ${barH()}`), end: () => `+=${Math.min(hero.offsetHeight, innerHeight)}`,
      pin: true, pinSpacing: false, scrub: 0.5, invalidateOnRefresh: true,
    },
  });
  // Explicit start values: these elements are still mid-entrance (hidden) when the timeline is built,
  // and a plain .to() would record that hidden state as the place to scroll back to.
  tl.fromTo(".hero__text, .hero .lead", { scale: 1, y: 0, opacity: 1 }, { scale: 0.9, y: -40, opacity: 0, transformOrigin: "0% 50%" }, 0)
    .fromTo(".hero .glance", { y: 0, opacity: 1 }, { y: -70, opacity: 0 }, 0.1);
  // The silk is added by script.js; it pushes in as the intro is covered.
  const silk = hero.querySelector(".silk");
  if (silk) tl.to(silk, { scale: 1.25 }, 0);
});

/* ---------- Projects strip: scrolling down moves the cards sideways ---------- */

let stripST = null;
const goToProject = (card) => {
  if (!card) return;
  if (card.hidden) document.querySelector('[data-filter="all"]').click();
  // Only cards in the sideways strip need the strip's scroll maths; anything else scrolls straight to itself.
  if (!stripST || !card.closest("#strip-track")) { scrollToEl(card); return; }
  const track = $("#strip-track");
  const dist = Math.max(1, track.scrollWidth - innerWidth);
  const x = innerWidth / 2 - card.offsetLeft - card.offsetWidth / 2;
  const p = Math.max(0, Math.min(1, -x / dist));
  const y = stripST.start + p * (stripST.end - stripST.start);
  if (lenis) lenis.scrollTo(y); else window.scrollTo({ top: y, behavior: MOTION ? "smooth" : "auto" });
};

safe("strip", () => {
  if (!MOTION || !mm) return;
  const strip = $("#strip"), track = $("#strip-track");
  mm.add("(min-width: 64rem) and (min-height: 760px)", () => {
    strip.classList.add("is-sideways", "bleed");
    const parts = [...track.children].map((c) => ({ c, info: c.querySelector(".project__info"), vis: c.querySelector(".project__visual") }));
    // Every card is measured first and written after, so a frame never forces more than one layout.
    const parallax = () => {
      const mid = innerWidth / 2;
      const shown = parts.filter(({ c }) => !c.hidden);
      const rects = shown.map(({ c }) => c.getBoundingClientRect());
      shown.forEach(({ c, info, vis }, i) => {
        const r = rects[i];
        const o = Math.max(-1.5, Math.min(1.5, (r.left + r.width / 2 - mid) / r.width));
        info.style.transform = `translateX(${(o * -36).toFixed(1)}px)`;
        vis.style.transform = `translateX(${(o * 60).toFixed(1)}px)`;
        c.style.opacity = (1 - Math.min(1, Math.abs(o)) * 0.4).toFixed(3);
      });
    };
    const tween = G.to(track, {
      x: () => -Math.max(0, track.scrollWidth - innerWidth),
      ease: "none",
      scrollTrigger: {
        trigger: strip, start: "top top", end: () => `+=${Math.max(1, track.scrollWidth - innerWidth)}`,
        pin: true, scrub: 0.6, invalidateOnRefresh: true, onUpdate: parallax, onRefresh: parallax,
      },
    });
    stripST = tween.scrollTrigger;
    return () => {
      stripST = null;
      strip.classList.remove("is-sideways", "bleed");
      parts.forEach(({ c, info, vis }) => { info.style.transform = vis.style.transform = c.style.opacity = ""; });
    };
  });
});

/* ---------- Highlights: each tile jumps to its project, even when it sits further along the sideways strip ---------- */

safe("highlights", () => {
  const tiles = [...document.querySelectorAll(".hl__tile")];
  tiles.forEach((a) => a.addEventListener("click", (e) => {
    const card = document.querySelector(a.getAttribute("href"));
    if (!card) return;
    e.preventDefault();
    goToProject(card);
  }));

  // A small drawing of each number. Every part carries its own delay (--d); CSS plays them once the tile has .play.
  const part = (svg, name, attrs, cls, d) => svgEl(name, { ...attrs, class: cls, style: `--d: ${d}ms` }, svg);
  const ART = {
    // Five record modules switching on one after another
    "p-school": (s) => { for (let i = 0; i < 5; i++) part(s, "rect", { x: 1 + i * 12.6, y: 12, width: 10, height: 16, rx: 2.5 }, "hl-cell", i * 80); },
    // A dashboard chart filling in, newest bar in accent
    "p-retool": (s) => {
      svgEl("path", { d: "M0 38.5H64", class: "hl-axis" }, s);
      [14, 22, 18, 28, 20, 32].forEach((h, i) => part(s, "rect", { x: 3 + i * 10, y: 38 - h, width: 6, height: h, rx: 1.5 }, i === 5 ? "hl-bar hl-bar--on" : "hl-bar", i * 70));
    },
    // Accuracy ring drawing round to 99.83%
    "p-prostadenet": (s) => {
      svgEl("circle", { cx: 44, cy: 20, r: 15, class: "hl-track" }, s);
      part(s, "circle", { cx: 44, cy: 20, r: 15, pathLength: 100 }, "hl-ring", 0);
    },
    // Three app screens, each lighting up
    "p-flutter": (s) => {
      for (let i = 0; i < 3; i++) {
        part(s, "rect", { x: 8 + i * 18, y: 6, width: 11, height: 28, rx: 2.5 }, "hl-phone", i * 90);
        part(s, "rect", { x: 10 + i * 18, y: 10, width: 7, height: 18, rx: 1 }, "hl-screen", i * 90 + 260);
      }
    },
    // One dot per group of patients; two turn red, like the strokes hiding in the data
    "p-stroke": (s) => {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) {
        const hot = (i === 5 && j === 1) || (i === 2 && j === 3);
        part(s, "circle", { cx: 4 + i * 8, cy: 7 + j * 9, r: 2 }, hot ? "hl-dot hl-dot--hot" : "hl-dot", (i + j) * 40);
      }
    },
    // A padlock that snaps shut
    "p-password": (s) => {
      part(s, "path", { d: "M24 18v-5a8 8 0 0 1 16 0v5" }, "hl-shackle", 120);
      part(s, "rect", { x: 19, y: 18, width: 26, height: 19, rx: 3.5 }, "hl-body", 0);
      part(s, "circle", { cx: 32, cy: 25.5, r: 2.2 }, "hl-key hl-key--dot", 520);
      part(s, "path", { d: "M32 27.5v3.5" }, "hl-key", 520);
    },
  };
  tiles.forEach((a) => {
    const draw = ART[a.getAttribute("href").slice(1)];
    if (!draw) return;
    const svg = svgEl("svg", { class: "hl__art", viewBox: "0 0 64 40", "aria-hidden": "true" });
    draw(svg);
    a.prepend(svg);
  });
  if (!MOTION) return;

  // Numbers count up from zero and the cipher decrypts, in step with the tile's place in the wave.
  const countUp = (el, delay) => {
    const m = el.textContent.match(/^([\d,]+(?:\.\d+)?)(.*)$/s);
    if (!m) return false;
    const to = parseFloat(m[1].replace(/,/g, ""));
    const dec = (m[1].split(".")[1] || "").length;
    const show = (v) => { el.textContent = v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[2]; };
    show(0);
    setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / 1100);
        show(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return true;
  };
  const decrypt = (el, delay) => {
    const final = el.textContent, GLYPHS = "ABCDEF0123456789#%&*";
    const noise = (n) => [...final].map((c, i) => (i < n || c === "-" ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    el.textContent = noise(0);
    let n = 0;
    setTimeout(function step() {
      el.textContent = noise(n);
      // Each character cycles a few times before it settles, left to right
      if (Math.random() < 0.45) n++;
      if (n <= final.length) setTimeout(step, 45);
      else el.textContent = final;
    }, delay);
  };

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const tile = e.target, stat = tile.querySelector(".hl__stat");
    const delay = (parseFloat(tile.style.getPropertyValue("--i")) || 0) * 90 + 250;
    tile.classList.add("play");
    if (stat && !stat.querySelector(".hl__arrow") && !countUp(stat, delay)) decrypt(stat, delay);
  }), { rootMargin: "0px 0px -10% 0px" });
  tiles.forEach((t) => io.observe(t));
});

/* ---------- School card: the routes light up as sample requests arrive ---------- */

safe("routes", () => {
  const code = $("#routes-code code"), log = $("#req-log");
  if (!code || !log) return;
  // Wrap each source line so a request can highlight the route that handles it.
  const lines = code.innerHTML.split("\n").map((html) => {
    const d = document.createElement("span");
    d.className = "ln";
    d.innerHTML = html;
    return d;
  });
  code.textContent = "";
  code.append(...lines);
  const REQS = [
    ["GET", "/classes", 1, 200], ["POST", "/student", 4, 201], ["GET", "/attendance-create/4", 8, 200],
    ["POST", "/assign-subject-to-class/12", 9, 302], ["GET", "/roles-permissions", 12, 200], ["PUT", "/teacher/7", 3, 200],
    ["GET", "/parents", 5, 200], ["DELETE", "/subject/3", 2, 302], ["POST", "/assignrole", 13, 302],
  ];
  const add = ([m, p, , s], animate) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="m m-${m}">${m}</span><span class="p">${p}</span><span class="st${s === 302 ? " r" : ""}">${s}</span><span class="ms">${8 + Math.round(Math.random() * 40)} ms</span>`;
    log.prepend(li);
    while (log.children.length > 5) log.lastChild.remove();
    if (animate) li.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE_OUT });
  };
  REQS.slice(0, 5).reverse().forEach((r) => add(r, false)); // fills the five visible rows
  if (!MOTION) return;
  let live = false, i = 5, timer = 0;
  const tick = () => {
    if (!live) return;
    const req = REQS[i++ % REQS.length];
    const line = lines[req[2]];
    line.classList.add("hit");
    setTimeout(() => line.classList.remove("hit"), 650);
    add(req, true);
    timer = setTimeout(tick, 1200);
  };
  watch(log, () => { if (live) return; live = true; tick(); }, () => { live = false; clearTimeout(timer); }, 0.3);
});

/* ---------- Retool card: packets ride the wires; the dashboard and workflows react ---------- */

safe("flow", () => {
  const svg = $("#flow-svg");
  if (!svg) return;
  const node = (x, y, w, h, title, sub, main) => {
    const g = svgEl("g", { class: `node${main ? " main" : ""}` }, svg);
    svgEl("rect", { class: "box", x, y, width: w, height: h, rx: 10 }, g);
    svgEl("text", { x: x + 14, y: y + 26 }, g).textContent = title;
    if (sub) svgEl("text", { class: "sub", x: x + 14, y: y + 44 }, g).textContent = sub;
    return g;
  };
  const wires = { a: "M160 52 H195", b: "M345 52 H380", d: "M455 84 C455 130 160 120 160 170", w: "M455 84 C455 130 390 130 390 170" };
  const paths = {};
  Object.entries(wires).forEach(([k, d]) => { paths[k] = svgEl("path", { class: "wire", d }, svg); });
  node(10, 20, 150, 64, "SQL database", "Operational records");
  node(195, 20, 150, 64, "Queries", "Filters and joins");
  node(380, 20, 150, 64, "Retool apps", "Tables and charts", true);
  const dash = node(60, 170, 200, 160, "Live dashboard");
  const rowsText = svgEl("text", { class: "count", x: 74, y: 214 }, dash);
  let rows = 1204;
  rowsText.textContent = `${fmt(rows)} rows`;
  const vals = [0.35, 0.55, 0.42, 0.7, 0.5, 0.82, 0.64];
  const bars = vals.map((v, i) => svgEl("rect", { class: "dbar", x: 76 + i * 25, y: 228, width: 18, height: 90, rx: 2, style: `transform: scaleY(${v})` }, dash));
  const wf = node(290, 170, 200, 160, "Workflows");
  const doneText = svgEl("text", { class: "count", x: 304, y: 214 }, wf);
  let done = 11;
  doneText.textContent = `${done} completed today`;
  const tasks = ["Sync new records", "Flag late reports", "Notify team lead", "Close finished tasks"].map((t, i) => {
    const g = svgEl("g", { class: "task" }, wf);
    const cy = 238 + i * 24;
    svgEl("circle", { class: "task-dot", cx: 310, cy, r: 6 }, g);
    svgEl("path", { class: "task-check", d: `M307 ${cy} l2.2 2.2 l4 -4.4` }, g);
    svgEl("text", { x: 323, y: cy + 4 }, g).textContent = t;
    return g;
  });
  if (!MOTION) return;

  const layer = svgEl("g", {}, svg);
  const packets = [];
  // The null segments are the hop through a node, drawn as a straight line between two points.
  const HOPS = { 1: [[195, 52], [345, 52]], 3: [[380, 52], [455, 84]] };
  const spawn = () => {
    const branch = Math.random() < 0.55 ? "d" : "w";
    const glow = svgEl("circle", { class: "packet-glow", r: 8 }, layer);
    const dot = svgEl("circle", { class: "packet", r: 3.5 }, layer);
    packets.push({ segs: [paths.a, null, paths.b, null, paths[branch]], i: 0, d: 0, branch, glow, dot });
  };
  let taskIdx = 0;
  const arrive = (branch) => {
    if (branch === "d") {
      vals.shift();
      vals.push(0.25 + Math.random() * 0.7);
      bars.forEach((b, i) => (b.style.transform = `scaleY(${vals[i]})`));
      rows += 3 + Math.round(Math.random() * 20);
      rowsText.textContent = `${fmt(rows)} rows`;
    } else {
      if (taskIdx === tasks.length) { tasks.forEach((t) => t.classList.remove("done")); taskIdx = 0; return; }
      tasks[taskIdx++].classList.add("done");
      done++;
      doneText.textContent = `${done} completed today`;
    }
  };
  let running = false, last = 0, spawnT = 0;
  const step = (now) => {
    if (!running) return;
    const dt = Math.min(now - last, 60) / 1000;
    last = now;
    spawnT += dt;
    if (spawnT > 0.7) { spawnT = 0; spawn(); }
    for (let k = packets.length - 1; k >= 0; k--) {
      const p = packets[k];
      p.d += 160 * dt;
      let x = null, y = null;
      for (;;) {
        const seg = p.segs[p.i];
        const hop = HOPS[p.i];
        const len = seg ? seg.getTotalLength() : Math.hypot(hop[1][0] - hop[0][0], hop[1][1] - hop[0][1]);
        if (p.d <= len) {
          if (seg) { const pt = seg.getPointAtLength(p.d); x = pt.x; y = pt.y; }
          else { const t = p.d / len; x = hop[0][0] + (hop[1][0] - hop[0][0]) * t; y = hop[0][1] + (hop[1][1] - hop[0][1]) * t; }
          break;
        }
        p.d -= len;
        p.i++;
        if (p.i >= p.segs.length) break;
      }
      if (x === null) { arrive(p.branch); p.glow.remove(); p.dot.remove(); packets.splice(k, 1); continue; }
      const inside = !p.segs[p.i];
      p.dot.setAttribute("cx", x); p.dot.setAttribute("cy", y);
      p.glow.setAttribute("cx", x); p.glow.setAttribute("cy", y);
      p.dot.style.opacity = p.glow.style.opacity = inside ? 0.35 : "";
    }
    requestAnimationFrame(step);
  };
  watch(svg, () => { if (running) return; running = true; last = performance.now(); requestAnimationFrame(step); }, () => { running = false; }, 0.2);
});

/* ---------- Flutter card: the three phones play short loops ---------- */

safe("phones", () => {
  const phones = $("#phones");
  if (!phones) return;
  const HOURS = [["9AM", 27, "Haze"], ["12PM", 31, "Hazy sun"], ["3PM", 33, "Hazy sun"], ["6PM", 30, "Haze"], ["9PM", 28, "Clear"]];
  const hourBox = $("#w-hours");
  const hourEls = HOURS.map(([h, t], i) => {
    const s = document.createElement("span");
    s.innerHTML = `${h}<b>${t}°</b>`;
    if (i === 1) s.className = "on";
    hourBox.append(s);
    return s;
  });
  const keyEls = {};
  $("#k-keys").querySelectorAll("i").forEach((k) => { keyEls[k.textContent] = k; });
  if (!MOTION) return;

  let alive = false, gen = 0;
  const sleep = (ms, my) => new Promise((res, rej) => setTimeout(() => (alive && gen === my ? res() : rej(new Error("stopped"))), ms));
  const countTo = (el, from, to, ms, suffix) => {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const weather = async (my) => {
    const temp = $("#w-temp"), desc = $("#w-desc");
    let cur = 31, i = 1;
    for (;;) {
      await sleep(1800, my);
      i = (i + 1) % HOURS.length;
      hourEls.forEach((s, j) => s.classList.toggle("on", j === i));
      countTo(temp, cur, HOURS[i][1], 700, "°");
      cur = HOURS[i][1];
      desc.textContent = HOURS[i][2];
    }
  };

  const QS = [
    { q: "Which SQL clause filters grouped rows?", o: ["WHERE", "ORDER BY", "HAVING", "LIMIT"], r: 2, pick: 2 },
    { q: "What does HTTP status 404 mean?", o: ["Server error", "Not found", "Redirect", "Unauthorized"], r: 1, pick: 3 },
    { q: "Which data structure uses first in, first out?", o: ["Stack", "Queue", "Tree", "Graph"], r: 1, pick: 1 },
  ];
  const quiz = async (my) => {
    const body = $("#q-body"), timer = $("#q-timer"), num = $("#q-num"), scoreEl = $("#q-score");
    let n = 3, score = 2, qi = 0;
    for (;;) {
      await sleep(qi ? 1500 : 600, my);
      const q = QS[qi % QS.length];
      n = n >= 10 ? 1 : n + 1;
      if (n === 1) score = 0;
      num.textContent = `Question ${n} of 10`;
      scoreEl.textContent = score;
      body.innerHTML = `<p class="quiz__q">${q.q}</p>` + q.o.map((o) => `<span class="quiz__opt">${o}</span>`).join("");
      body.animate([{ opacity: 0, transform: "translateX(14px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE_OUT });
      timer.style.transition = "none";
      timer.style.transform = "scaleX(1)";
      void timer.offsetWidth;
      timer.style.transition = "transform 6s linear";
      timer.style.transform = "scaleX(0)";
      await sleep(2300, my);
      const opts = [...body.querySelectorAll(".quiz__opt")];
      opts[q.pick].classList.add("is-tap");
      await sleep(220, my);
      opts[q.pick].classList.remove("is-tap");
      if (q.pick === q.r) {
        opts[q.r].classList.add("is-right");
        scoreEl.textContent = ++score;
        scoreEl.animate([{ transform: "scale(1.5)", color: "#1f9d63" }, { transform: "none" }], { duration: 400, easing: EASE_OUT });
      } else {
        opts[q.pick].classList.add("is-wrong");
        await sleep(300, my);
        opts[q.r].classList.add("is-right");
      }
      // Freeze the timer where the answer landed
      timer.style.transform = getComputedStyle(timer).transform;
      timer.style.transition = "none";
      qi++;
    }
  };

  const SUMS = [[["9", "6", "+", "3", "="], "99"], [["5", "6", "÷", "8", "="], "7"], [["1", "2", "8", "×", "4", "="], "512"]];
  const calc = async (my) => {
    const expr = $("#k-expr"), out = $("#k-out");
    const press = async (k) => {
      keyEls[k].classList.add("is-press");
      await sleep(110, my);
      keyEls[k].classList.remove("is-press");
    };
    for (let si = 0; ; si++) {
      await sleep(si ? 1800 : 900, my);
      const [seq, res] = SUMS[si % SUMS.length];
      await press("C");
      expr.textContent = "";
      out.textContent = "0";
      await sleep(400, my);
      let typed = "";
      for (const k of seq) {
        await press(k);
        if (k === "=") {
          expr.textContent = `${typed} =`;
          out.textContent = res;
          out.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE_OUT });
        } else {
          typed += "÷×−+".includes(k) ? ` ${k} ` : k;
          out.textContent = typed.trim().split(" ").pop();
          expr.textContent = typed;
        }
        await sleep(330, my);
      }
    }
  };

  watch(phones, () => {
    if (alive) return;
    alive = true;
    const my = ++gen;
    [weather, quiz, calc].forEach((f) => f(my).catch(() => {}));
  }, () => { alive = false; });
});

/* ---------- Case studies: the card grows into a dialog ---------- */

let lastFocus = null;
safe("cases", () => {
  const store = document.querySelector(".case-store");
  const caseEl = $("#case"), backdrop = $("#case-backdrop"), body = $("#case-body"), closeBtn = $("#case-close");
  if (!store || !caseEl) return;
  const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
  let openCard = null, content = null, busy = false, after = null;
  const delta = (from, to) => `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;

  const open = (card, key, trigger) => {
    if (busy || openCard) return;
    content = store.querySelector(`[data-case="${key}"]`);
    if (!content) return;
    busy = true;
    openCard = card;
    lastFocus = trigger;
    body.append(content);
    const first = card.getBoundingClientRect();
    caseEl.hidden = backdrop.hidden = false;
    caseEl.scrollTop = 0;
    document.documentElement.style.overflow = "hidden";
    if (lenis) lenis.stop();
    const last = caseEl.getBoundingClientRect();
    closeBtn.focus({ preventScroll: true, focusVisible: false });
    if (!MOTION) { busy = false; return; }
    card.style.visibility = "hidden";
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease" });
    caseEl.animate([{ transform: delta(first, last), borderRadius: "14px" }, { transform: "none", borderRadius: "18px" }], { duration: 560, easing: EASE });
    [body, closeBtn].forEach((el) => el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 260, easing: EASE_OUT, fill: "backwards" }));
    setTimeout(() => { busy = false; }, 560);
  };

  const close = () => {
    if (!openCard || busy) return;
    busy = true;
    const card = openCard;
    const finish = () => {
      caseEl.hidden = backdrop.hidden = true;
      store.append(content);
      card.style.visibility = "";
      document.documentElement.style.overflow = "";
      if (lenis) lenis.start();
      openCard = content = null;
      busy = false;
      if (after) { const go = after; after = null; go(); }
      else if (lastFocus) lastFocus.focus({ preventScroll: true });
    };
    if (!MOTION) { finish(); return; }
    const from = caseEl.getBoundingClientRect();
    card.style.visibility = "";
    const to = card.getBoundingClientRect();
    card.style.visibility = "hidden";
    [body, closeBtn].forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease", fill: "forwards" }));
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease", fill: "forwards" });
    const anim = caseEl.animate([{ transform: "none" }, { transform: delta(to, from), borderRadius: "14px" }], { duration: 440, easing: EASE, fill: "forwards" });
    anim.onfinish = () => {
      finish();
      [caseEl, body, closeBtn, backdrop].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    };
  };

  document.querySelectorAll("[data-case]").forEach((btn) => {
    if (btn.closest(".case-store")) return;
    btn.addEventListener("click", () => open(btn.closest(".project"), btn.dataset.case, btn));
  });
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (!openCard) return;
    if (e.key === "Escape") close();
    // Keep Tab inside the dialog
    if (e.key === "Tab") {
      const f = [...caseEl.querySelectorAll("a[href], button, [tabindex='0'], [role='tab']")].filter((el) => !el.closest("[hidden]"));
      if (!f.length) return;
      const firstEl = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
  });
  // Links to the scroll stories close the dialog first, then travel there.
  caseEl.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-close]");
    if (!a) return;
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    after = () => scrollToEl(target);
    close();
  });
});

/* ---------- Case study: query console on the school database ---------- */

safe("query", () => {
  const Q = [
    {
      tab: "Attendance by class", ms: 14, unit: "%", dec: 1, max: 100, cols: ["class", "attendance"],
      sql: "SELECT c.name AS class,\n       ROUND(AVG(a.present) * 100, 1) AS attendance\nFROM attendance a\nJOIN classes c ON c.id = a.class_id\nGROUP BY c.name\nORDER BY attendance DESC;",
      rows: [["Class 10", 96.8], ["Class 9", 95.2], ["Class 8", 93.9], ["Class 7", 92.4], ["Class 6", 90.7], ["Class 5", 88.3]],
    },
    {
      tab: "Average marks by subject", ms: 21, unit: "", dec: 1, max: 100, cols: ["subject", "avg_marks"],
      sql: "SELECT s.name AS subject,\n       ROUND(AVG(g.marks), 1) AS avg_marks\nFROM grades g\nJOIN subjects s ON s.id = g.subject_id\nGROUP BY s.name\nORDER BY avg_marks DESC;",
      rows: [["ICT", 85.7], ["English", 81.5], ["Biology", 80.1], ["Mathematics", 78.2], ["Chemistry", 76.3], ["Physics", 74.9]],
    },
    {
      tab: "Students per class", ms: 9, unit: "", dec: 0, max: 50, cols: ["class", "students"],
      sql: "SELECT c.name AS class,\n       COUNT(st.id) AS students\nFROM classes c\nLEFT JOIN students st ON st.class_id = c.id\nGROUP BY c.name\nORDER BY students DESC;",
      rows: [["Class 8", 45], ["Class 6", 42], ["Class 9", 40], ["Class 7", 38], ["Class 10", 36], ["Class 5", 33]],
    },
  ];
  const qc = $("#qc");
  if (!qc) return;
  const tabs = $("#qc-tabs"), sqlEl = $("#qc-sql"), status = $("#qc-status"), chart = $("#qc-chart");
  const head = $("#qc-head"), rowsEl = $("#qc-rows"), title = $("#qc-title"), runBtn = $("#qc-run");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const hl = (s) => esc(s)
    .replace(/\b(\d+)\b/g, '<span class="s">$1</span>')
    .replace(/\b(SELECT|FROM|LEFT JOIN|JOIN|ON|GROUP BY|ORDER BY|AS|DESC)\b/g, '<span class="k">$1</span>')
    .replace(/\b(ROUND|AVG|COUNT)\b/g, '<span class="f">$1</span>');
  let current = 0, runId = 0, auto = true, visible = false, timer = 0;
  const buttons = Q.map((q, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = q.tab;
    b.addEventListener("click", () => { auto = false; run(i); });
    tabs.append(b);
    return b;
  });
  const cols = Q[0].rows.map(() => {
    const c = document.createElement("div");
    c.className = "qc__col";
    c.innerHTML = "<em>0</em><b><i></i></b><span></span>";
    chart.append(c);
    return { val: c.querySelector("em"), bar: c.querySelector("i"), label: c.querySelector("span") };
  });
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const countTo = (el, to, dec, unit) => {
    const from = parseFloat(el.textContent) || 0, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 700);
      el.textContent = (from + (to - from) * (1 - Math.pow(1 - p, 3))).toFixed(dec) + unit;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const showResults = (q, animate) => {
    title.innerHTML = `${q.tab}<span>${q.rows.length} rows</span>`;
    cols.forEach((c, i) => {
      const [label, v] = q.rows[i];
      c.bar.style.transitionDelay = animate ? `${i * 50}ms` : "0ms";
      c.bar.style.transform = `scaleY(${(v / q.max).toFixed(3)})`;
      if (animate) countTo(c.val, v, q.dec, q.unit); else c.val.textContent = v.toFixed(q.dec) + q.unit;
      c.label.textContent = label;
    });
    head.innerHTML = `<tr><th>${q.cols[0]}</th><th>${q.cols[1]}</th></tr>`;
    rowsEl.innerHTML = q.rows.map(([l, v]) => `<tr><td>${l}</td><td>${v.toFixed(q.dec)}${q.unit}</td></tr>`).join("");
    if (animate) {
      [...rowsEl.children].forEach((tr, i) => tr.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 280, delay: 100 + i * 50, easing: EASE_OUT, fill: "backwards" }));
    }
  };
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  const run = async (qi) => {
    clearTimeout(timer);
    const my = ++runId, q = Q[qi];
    current = qi;
    buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === qi)));
    if (MOTION) {
      for (let n = 0; n <= q.sql.length; n += 3) {
        if (my !== runId) return;
        sqlEl.textContent = q.sql.slice(0, n);
        sqlEl.append(cursor);
        await wait(10);
      }
    }
    if (my !== runId) return;
    sqlEl.innerHTML = hl(q.sql);
    status.textContent = "Running";
    status.classList.add("busy");
    await wait(MOTION ? 450 : 0);
    if (my !== runId) return;
    status.classList.remove("busy");
    status.textContent = `${q.rows.length} rows · ${q.ms} ms`;
    showResults(q, MOTION);
    if (auto && MOTION) timer = setTimeout(() => { if (auto && visible) run((current + 1) % Q.length); }, 5200);
  };
  runBtn.addEventListener("click", () => { auto = false; run(current); });
  // A finished result shows before the console is ever opened, so it never looks empty.
  sqlEl.innerHTML = hl(Q[0].sql);
  buttons[0].setAttribute("aria-pressed", "true");
  showResults(Q[0], false);
  if (!MOTION) return;
  let started = false;
  watch(qc, () => {
    visible = true;
    if (!started) { started = true; run(0); }
    else if (auto) timer = setTimeout(() => run((current + 1) % Q.length), 1500);
  }, () => { visible = false; clearTimeout(timer); }, 0.3);
});

/* ---------- Case study: X-ray lens over the sample dashboard ---------- */

safe("xray", () => {
  const box = $("#xray"), sys = $("#xray-sys"), ring = $("#xray-ring");
  if (!box) return;
  const R0 = () => (innerWidth < 640 ? 72 : 96);
  const s = { x: 0, y: 0, tx: 0, ty: 0, r: R0(), tr: R0(), full: false, user: false, lastMove: 0 };
  let W = 0, H = 0, frame = 0, last = 0, visible = false;
  const paint = () => {
    sys.style.clipPath = `circle(${s.r.toFixed(1)}px at ${s.x.toFixed(1)}px ${s.y.toFixed(1)}px)`;
    ring.style.width = ring.style.height = `${(s.r * 2).toFixed(1)}px`;
    ring.style.transform = `translate(${(s.x - s.r).toFixed(1)}px, ${(s.y - s.r).toFixed(1)}px)`;
    ring.style.opacity = s.full ? "0" : "1";
  };
  // The dashboard starts out hidden in the case-study store, so it is measured whenever it gets a size.
  new ResizeObserver(() => {
    W = box.clientWidth;
    H = box.clientHeight;
    if (!s.x) { s.x = s.tx = W * 0.68; s.y = s.ty = H * 0.42; }
    s.tr = s.full ? Math.hypot(W, H) : R0();
    if (!MOTION) s.r = s.tr;
    paint();
  }).observe(box);
  const kick = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(step); } };
  const toggleFull = () => {
    s.full = !s.full;
    s.tr = s.full ? Math.hypot(W, H) : R0();
    if (!MOTION) { s.r = s.tr; paint(); return; }
    kick();
  };
  box.addEventListener("click", toggleFull);
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleFull(); } });
  const t0 = performance.now();
  function step(now) {
    frame = 0;
    if (!visible) return;
    const dt = last ? Math.min(now - last, 64) : 16.7;
    last = now;
    // With no pointer for a moment, the lens drifts on its own so the effect explains itself.
    if (!s.user || now - s.lastMove > 2500) {
      const t = (now - t0) / 1000;
      s.tx = W * (0.5 + 0.34 * Math.sin(t * 0.5));
      s.ty = H * (0.5 + 0.3 * Math.sin(t * 0.77 + 1));
    }
    const k = (lag) => 1 - Math.pow(1 - lag, dt / 16.7);
    s.x += (s.tx - s.x) * k(0.16);
    s.y += (s.ty - s.y) * k(0.16);
    s.r += (s.tr - s.r) * k(s.full ? 0.09 : 0.14);
    paint();
    frame = requestAnimationFrame(step);
  }
  if (!MOTION) return;
  box.addEventListener("pointermove", (e) => {
    const r = box.getBoundingClientRect();
    s.tx = e.clientX - r.left;
    s.ty = e.clientY - r.top;
    s.user = true;
    s.lastMove = performance.now();
  });
  box.addEventListener("pointerleave", () => { s.user = false; });
  watch(box, () => { visible = true; kick(); }, () => { visible = false; }, 0.1);
});

/* ---------- Tissue tile: a drawn stand-in for an H&E slide (thesis story and network) ---------- */

const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const drawTissue = (c, speckle, seed = 11) => {
  const x = c.getContext("2d", { willReadFrequently: true }), S = c.width, r = rng(seed);
  x.fillStyle = "#efc3d6";
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) {
    x.fillStyle = `hsla(${325 + r() * 20},${40 + r() * 20}%,${68 + r() * 14}%,.35)`;
    x.beginPath(); x.ellipse(r() * S, r() * S, 6 + r() * 26, 3 + r() * 10, r() * Math.PI, 0, 7); x.fill();
  }
  for (let g = 0; g < 7; g++) {
    const cx = 50 + r() * (S - 100), cy = 50 + r() * (S - 100), rx = 26 + r() * 40, ry = 18 + r() * 28, rot = r() * Math.PI;
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.fillStyle = "#fbf1f6"; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill();
    const n = Math.round(rx * 0.9);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      x.fillStyle = `hsla(${262 + r() * 16},50%,${30 + r() * 12}%,.9)`;
      x.beginPath(); x.ellipse(Math.cos(a) * (rx + 4), Math.sin(a) * (ry + 4), 3.2, 2, a, 0, 7); x.fill();
    }
    x.restore();
  }
  for (let i = 0; i < 1300; i++) {
    x.fillStyle = `hsla(${258 + r() * 24},${40 + r() * 20}%,${28 + r() * 18}%,${0.55 + r() * 0.4})`;
    x.beginPath(); x.ellipse(r() * S, r() * S, 1.5 + r() * 2.5, 1.2 + r() * 1.6, r() * 3, 0, 7); x.fill();
  }
  if (speckle) {
    const d = x.getImageData(0, 0, S, S), p = d.data;
    for (let i = 0; i < 9000; i++) {
      const j = (((r() * S) | 0) + ((r() * S) | 0) * S) * 4, v = r() < 0.5 ? 20 : 250;
      p[j] = p[j + 1] = p[j + 2] = v;
      if (r() < 0.5 && j + 4 < p.length) p[j + 4] = p[j + 5] = p[j + 6] = v;
    }
    x.putImageData(d, 0, 0);
  }
};

/* ---------- Case study: ProstadeNet running ---------- */

safe("cnn", () => {
  const host = $("#cnn"), gradesEl = $("#grades"), pred = $("#pred");
  if (!host) return;
  const LAYERS = [
    { name: "Input", sub: "224 × 224", n: 1, size: 84, key: "in" },
    { name: "Conv", sub: "32 filters", n: 7, size: 80, key: "c1" },
    { name: "Max pool", sub: "÷ 2", n: 7, size: 58, key: "p1" },
    { name: "Conv", sub: "64 filters", n: 9, size: 58, key: "c2" },
    { name: "Max pool", sub: "÷ 2", n: 9, size: 44, key: "p2" },
    { name: "Conv", sub: "128 filters", n: 11, size: 44, key: "c3" },
    { name: "Max pool", sub: "÷ 2", n: 11, size: 32, key: "p3" },
  ];
  const K = [
    [-1, 0, 1, -2, 0, 2, -1, 0, 1], [-1, -2, -1, 0, 0, 0, 1, 2, 1], [0, -1, 0, -1, 4, -1, 0, -1, 0],
    [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v / 16), [0, -1, 0, -1, 5, -1, 0, -1, 0], [-2, -1, 0, -1, 1, 1, 0, 1, 2],
    [2, -1, -1, -1, 2, -1, -1, -1, 2], [-1, -1, 2, -1, 2, -1, 2, -1, -1], [1, 1, 1, 1, -8, 1, 1, 1, 1],
  ];
  const conv = (src, n, k) => {
    const out = new Float32Array(n * n);
    let max = 1e-6;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const yy = Math.min(n - 1, Math.max(0, y + j)), xx = Math.min(n - 1, Math.max(0, x + i));
        s += src[yy * n + xx] * k[(j + 1) * 3 + i + 1];
      }
      s = Math.max(0, s); // ReLU
      out[y * n + x] = s;
      if (s > max) max = s;
    }
    for (let i = 0; i < out.length; i++) out[i] /= max;
    return out;
  };
  const pool = (src, n) => {
    const m = n / 2, out = new Float32Array(m * m);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      out[y * m + x] = Math.max(src[2 * y * n + 2 * x], src[2 * y * n + 2 * x + 1], src[(2 * y + 1) * n + 2 * x], src[(2 * y + 1) * n + 2 * x + 1]);
    }
    return out;
  };
  // Dark navy to accent blue to near white, matching the site's palette.
  const STOPS = [[4, 7, 12], [13, 35, 56], [41, 151, 255], [214, 230, 255]];
  const render = (a, n) => {
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const x = c.getContext("2d"), img = x.createImageData(n, n);
    for (let i = 0; i < a.length; i++) {
      const v = Math.min(0.999, a[i]) * 3, s = Math.floor(v), t = v - s, A = STOPS[s], B = STOPS[s + 1];
      img.data.set([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, 255], i * 4);
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL();
  };
  const big = document.createElement("canvas");
  big.width = big.height = 512;
  const small = document.createElement("canvas");
  small.width = small.height = 64;
  const sx = small.getContext("2d", { willReadFrequently: true });
  const maps = (seed) => {
    drawTissue(big, false, seed);
    sx.drawImage(big, 0, 0, 64, 64);
    const d = sx.getImageData(0, 0, 64, 64).data, gray = new Float32Array(64 * 64);
    for (let i = 0; i < gray.length; i++) gray[i] = 1 - (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255; // nuclei are dark, so they fire strongest
    const c1 = [...Array(7)].map((_, j) => conv(gray, 64, K[j % 9]));
    const p1 = c1.map((m) => pool(m, 64));
    const c2 = [...Array(9)].map((_, j) => conv(p1[j % 7].map((v, i) => 0.6 * v + 0.4 * p1[(j + 3) % 7][i]), 32, K[(j + 2) % 9]));
    const p2 = c2.map((m) => pool(m, 32));
    const c3 = [...Array(11)].map((_, j) => conv(p2[j % 9], 16, K[(j + 4) % 9]));
    const p3 = c3.map((m) => pool(m, 16));
    const tile = document.createElement("canvas");
    tile.width = tile.height = 160;
    tile.getContext("2d").drawImage(big, 0, 0, 160, 160);
    return {
      in: [tile.toDataURL()],
      c1: c1.map((m) => render(m, 64)), p1: p1.map((m) => render(m, 32)),
      c2: c2.map((m) => render(m, 32)), p2: p2.map((m) => render(m, 16)),
      c3: c3.map((m) => render(m, 16)), p3: p3.map((m) => render(m, 8)),
    };
  };

  const planes = [], overlays = [], arrows = [], DEPTH = 5;
  const arrow = () => {
    const a = document.createElement("div");
    a.className = "cnn__arrow";
    a.innerHTML = "<i></i>";
    host.append(a);
    arrows.push(a.firstChild);
  };
  LAYERS.forEach((L, li) => {
    if (li) arrow();
    const col = document.createElement("div");
    col.className = "cnn__layer";
    const stack = document.createElement("div");
    stack.className = "cnn__stack";
    stack.style.width = stack.style.height = `${L.size}px`;
    // Planes behind the front one spill sideways once the stack is turned; leave room for them.
    col.style.paddingRight = `${Math.round((L.n - 1) * DEPTH * 0.64)}px`;
    const ps = [], os = [];
    for (let j = L.n - 1; j >= 0; j--) {
      const p = document.createElement("div");
      p.className = "cnn__plane";
      p.style.transform = `translateZ(${-j * DEPTH}px)`;
      const o = document.createElement("i");
      p.append(o);
      stack.append(p);
      ps[j] = p;
      os[j] = o;
    }
    planes.push(ps);
    overlays.push(os);
    col.append(stack);
    col.insertAdjacentHTML("beforeend", `<p class="cnn__label"><b>${L.name}</b>${L.sub}</p>`);
    host.append(col);
  });
  arrow();
  const dcol = document.createElement("div");
  dcol.className = "cnn__layer";
  const dense = document.createElement("div");
  dense.className = "cnn__dense";
  const dots = [...Array(12)].map(() => { const i = document.createElement("i"); dense.append(i); return i; });
  dcol.append(dense);
  dcol.insertAdjacentHTML("beforeend", '<p class="cnn__label"><b>Dense</b>softmax</p>');
  host.append(dcol);

  const rows = [...Array(6)].map((_, g) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>Grade ${g}</span><b><i></i></b><em>0%</em>`;
    gradesEl.append(li);
    return { li, bar: li.querySelector("i"), pct: li.querySelector("em") };
  });
  const apply = (m) => LAYERS.forEach((L, li) => planes[li].forEach((p, j) => (p.style.backgroundImage = `url(${m[L.key][j % m[L.key].length]})`)));
  const scores = (g, seed) => {
    const r = rng(seed * 7 + 3), top = 0.86 + r() * 0.11;
    const rest = [...Array(6)].map((_, i) => (i === g ? 0 : 0.2 + r() + (Math.abs(i - g) === 1 ? 1.2 : 0)));
    const sum = rest.reduce((a, b) => a + b, 0);
    return rest.map((v, i) => (i === g ? top : (v / sum) * (1 - top)));
  };
  const showScores = (p, g) => rows.forEach((r, i) => {
    r.li.classList.toggle("top", i === g);
    r.bar.style.setProperty("--p", p[i].toFixed(3));
    r.pct.textContent = `${Math.round(p[i] * 100)}%`;
  });
  const setPred = (g, p) => (pred.innerHTML = `Predicted: grade ${g} · ${Math.round(p * 100)}%<small>Illustrative scores, not real model output</small>`);

  const RUNS = [[11, 3], [23, 1], [37, 4], [51, 2], [64, 5], [78, 0]];
  apply(maps(RUNS[0][0]));
  const first = scores(RUNS[0][1], RUNS[0][0]);
  showScores(first, RUNS[0][1]);
  setPred(RUNS[0][1], first[RUNS[0][1]]);
  if (!MOTION || !G) return;

  let run = 1, tl = null, visible = false, lastP = first;
  const cycle = () => {
    const [seed, g] = RUNS[run++ % RUNS.length];
    const m = maps(seed);
    const p = scores(g, seed);
    const old = lastP, fade = { k: 1 }, grow = { k: 0 };
    tl = G.timeline({ onComplete: () => { lastP = p; cycle(); }, paused: !visible });
    tl.set(overlays.flat(), { opacity: 0 })
      .set(arrows, { scaleX: 0, opacity: 1 })
      .set(dots, { backgroundColor: "#3a3a3d" })
      .to(pred, { opacity: 0.35, duration: 0.25 }, 0)
      .to(planes[0], { opacity: 0, duration: 0.25 }, 0)
      .call(() => apply(m), null, 0.25)
      .to(planes[0], { opacity: 1, duration: 0.4 }, 0.3)
      .to(fade, { k: 0, duration: 0.3, onUpdate: () => showScores(old.map((v) => v * fade.k), -1) }, 0.3);
    let t = 0.75;
    for (let li = 1; li < LAYERS.length; li++) {
      tl.to(arrows[li - 1], { scaleX: 1, duration: 0.22, ease: "power1.inOut" }, t)
        .to(arrows[li - 1], { opacity: 0.3, duration: 0.4 }, t + 0.24)
        .to(overlays[li], { opacity: 0.62, duration: 0.22, stagger: 0.025, ease: "power2.out" }, t + 0.14)
        .to(overlays[li], { opacity: 0.1, duration: 0.6, stagger: 0.025, ease: "power2.inOut" }, t + 0.42);
      t += 0.34;
    }
    tl.to(arrows[arrows.length - 1], { scaleX: 1, duration: 0.22 }, t)
      .to(dots, { backgroundColor: "#2997ff", duration: 0.2, stagger: { each: 0.03, from: "center" } }, t + 0.12)
      .to(dots, { backgroundColor: "#3a3a3d", duration: 0.6, stagger: { each: 0.03, from: "center" } }, t + 0.6)
      .to(grow, { k: 1, duration: 0.9, ease: "power3.out", onUpdate: () => showScores(p.map((v) => v * grow.k), g) }, t + 0.35)
      .call(() => setPred(g, p[g]), null, t + 0.9)
      .to(pred, { opacity: 1, duration: 0.35 }, t + 0.9)
      .to({}, { duration: 2.4 });
  };
  watch(host, () => { visible = true; if (!tl) cycle(); else tl.resume(); }, () => { visible = false; if (tl) tl.pause(); }, 0.3);
});

/* ---------- How they work 1: exploded view of the school system ---------- */

safe("exploded", () => {
  if (!MOTION || !G) return;
  const stage = $("#xs"), tilt = $("#xs-tilt"), scene = $("#xs-scene"), packet = $("#xs-packet");
  const layers = [...scene.querySelectorAll(".xs__layer")]; // 0 is MySQL at the bottom, 3 is the screen on top
  const legend = [...document.querySelectorAll("#xs-legend li")]; // listed top to bottom
  const gap = () => (innerWidth < 640 ? 48 : Math.min(128, innerHeight * 0.12));
  let current = -2;
  const setActive = (k) => {
    if (k === current) return;
    current = k;
    layers.forEach((l, i) => l.classList.toggle("on", i === k));
    legend.forEach((li, j) => { li.classList.toggle("on", 3 - j === k); li.classList.toggle("done", k >= 0 && 3 - j > k); });
  };
  stage.classList.add("is-pinned");
  // The packet turns against the scene's tilt so it reads as a round light, not a flat disc.
  G.set(packet, { rotation: 26, rotationX: -56 });
  // Highlights follow the smoothed timeline, not the raw scroll position, so they stay in step with the packet.
  const tl = G.timeline({
    defaults: { ease: "none" },
    onUpdate: () => {
      const p = tl.progress();
      if (G.getProperty(packet, "opacity") > 0.4) setActive(Math.max(0, Math.min(3, Math.round(G.getProperty(packet, "z") / gap()))));
      else if (p < 0.04) setActive(-1);
      else setActive(3 - Math.min(3, Math.floor(((p - 0.04) / 0.36) * 4)));
    },
    scrollTrigger: { trigger: stage, start: () => `top ${barH()}`, end: "+=220%", pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
  tl.fromTo(layers, { z: (i) => i * 6 }, { z: (i) => i * gap(), duration: 1, ease: "power2.inOut" }, 0)
    .fromTo(tilt, { rotationX: 52 }, { rotationX: 60, duration: 2.6 }, 0)
    .fromTo(scene, { rotation: -30 }, { rotation: -22, duration: 2.6 }, 0)
    .fromTo(packet, { z: () => 3 * gap() + 40, opacity: 0 }, { opacity: 1, duration: 0.1 }, 1.1)
    .to(packet, { z: 0, duration: 0.7, ease: "power1.inOut" }, 1.2)
    .to(packet, { z: () => 3 * gap() + 40, duration: 0.7, ease: "power1.inOut" }, 1.9)
    .to(packet, { opacity: 0, duration: 0.1 }, 2.5);
});

/* ---------- How they work 2: ProstadeNet, from slide to grade ---------- */

safe("story", () => {
  const raw = $("#t-raw"), clean = $("#t-clean");
  if (!raw) return;
  drawTissue(raw, true);
  drawTissue(clean, false);
  const aug = $("#aug");
  const filters = ["hue-rotate(-14deg) saturate(1.35)", "brightness(1.18)", "contrast(1.3)", "saturate(0.65) brightness(0.92)"];
  const copies = filters.map((f, i) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.translate(128, 128);
    x.rotate((i * Math.PI) / 2);
    if (i % 2) x.scale(-1, 1);
    x.drawImage(clean, -128, -128, 256, 256);
    c.style.filter = `${f} contrast(1.3) saturate(1.2)`;
    c.setAttribute("aria-hidden", "true");
    aug.append(c);
    return c;
  });
  const steps = [...document.querySelectorAll("#story-steps li")];
  const setStep = (k) => {
    steps.forEach((li, i) => { li.classList.toggle("on", i === k); li.classList.toggle("done", i < k); });
    $("#tsize").textContent = k >= 1 ? "224 × 224" : "512 × 512";
  };
  if (!MOTION || !G) { setStep(5); return; }

  $("#story").classList.add("is-pinned");
  const img = $("#c-img"), acc = $("#c-acc");
  const counter = { img: 10616, acc: 0 };
  const paint = () => {
    img.textContent = fmt(counter.img);
    acc.textContent = counter.acc ? `${counter.acc.toFixed(2)}%` : "–";
  };
  const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const tl = G.timeline({
    defaults: { ease: "power2.inOut" },
    onUpdate: () => setStep(Math.min(5, Math.floor(tl.time()))),
    scrollTrigger: { trigger: "#story", start: () => `top ${barH()}`, end: "+=260%", pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
  tl.set(counter, { img: 10616, acc: 0, onUpdate: paint }, 0)
    .to("#tframe", { scale: 0.72, duration: 0.8 }, 1)
    .to(clean, { opacity: 1, duration: 0.8 }, 2)
    .to("#tframe", { filter: "contrast(1.3) saturate(1.2) brightness(1.03)", duration: 0.8 }, 3)
    .to(copies, {
      opacity: 1, scale: 0.44, duration: 1,
      xPercent: (i) => offsets[i][0] * 52, yPercent: (i) => offsets[i][1] * 52, rotation: (i) => offsets[i][0] * offsets[i][1] * 4,
    }, 4)
    .to(counter, { img: 53080, duration: 1, ease: "none", onUpdate: paint }, 4)
    .fromTo(counter, { acc: 96.07 }, { acc: 99.83, duration: 0.8, ease: "power1.out", onUpdate: paint, immediateRender: false }, 5.1)
    .to({}, { duration: 0.35 });
  paint();
  setStep(0);
});

/* ---------- How they work 3: why 94% accuracy wasn't enough ---------- */

safe("dots", () => {
  const canvas = $("#dots");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const NO = 1204, YES = 74, REAL = NO + YES, SYN = NO - YES, N = REAL + SYN;
  // Dots 0–73 had a stroke, 74–1277 did not, the rest are the synthetic samples resampling would add.
  const r = rng(5);
  const perm = [...Array(REAL).keys()];
  for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const GREY = [90, 90, 95], RED = [255, 105, 97];
  let W = 0, H = 0, pos = [], rad = [], labels = [];
  const layout = () => {
    const box = canvas.parentElement.getBoundingClientRect();
    W = box.width;
    H = box.height;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = 28, avH = H - top - 4;
    const block = (rows, total) => { const cell = Math.min(W / total, avH / rows); return { cell, ox: (W - total * cell) / 2, oy: top + (avH - rows * cell) / 2 }; };
    const at = (b, col0, cols, k) => [b.ox + (col0 + (k % cols) + 0.5) * b.cell, b.oy + (Math.floor(k / cols) + 0.5) * b.cell];
    const g0 = block(Math.ceil(REAL / 46), 46);
    const g1 = block(Math.ceil(NO / 38), 38 + 4 + 3);
    const g2 = block(Math.ceil(NO / 21), 21 * 2 + 3);
    const L0 = [], L1 = [], L2 = [];
    for (let i = 0; i < N; i++) {
      const isYes = i < YES, isSyn = i >= REAL;
      const balanced = isSyn ? at(g2, 24, 21, YES + (i - REAL)) : isYes ? at(g2, 24, 21, i) : at(g2, 0, 21, i - YES);
      L2.push(balanced);
      if (isSyn) { L0.push(balanced); L1.push(balanced); continue; }
      L0.push(at(g0, 0, 46, perm[i]));
      L1.push(isYes ? at(g1, 42, 3, i) : at(g1, 0, 38, i - YES));
    }
    pos = [L0, L0, L1, L1, L2];
    rad = [g0.cell, g0.cell, g1.cell, g1.cell, g2.cell].map((c) => c * 0.36);
    labels = [
      [],
      [],
      [[g1.ox, g1.oy - 10, "No stroke · 1,204", "left"], [g1.ox + 45 * g1.cell, g1.oy - 10, "Stroke · 74", "right"]],
      [[g1.ox, g1.oy - 10, "Correct · 1,204", "left"], [g1.ox + 45 * g1.cell, g1.oy - 10, "Missed · 74", "right"]],
      [[g2.ox, g2.oy - 10, "No stroke · 1,204", "left"], [g2.ox + 45 * g2.cell, g2.oy - 10, "Stroke · 74 real + 1,130 synthetic", "right"]],
    ];
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const colorOf = (i, st) => ((i < YES && st >= 1) || i >= REAL ? RED : GREY);
  const fillAlpha = (i, st) => (i >= REAL ? (st >= 4 ? 0.35 : 0) : 1);
  const ringAlpha = (i, st) => (i < YES && st === 3 ? 1 : i >= REAL && st >= 4 ? 0.9 : 0);
  let u = 3;
  const draw = () => {
    let a = Math.min(3, Math.floor(u)), t = ease(Math.max(0, Math.min(1, (u - a - 0.15) / 0.7)));
    if (u >= 4) { a = 3; t = 1; }
    const b = a + 1, R = mix(rad[a], rad[b], t);
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      const fa = mix(fillAlpha(i, a), fillAlpha(i, b), t), ra = mix(ringAlpha(i, a), ringAlpha(i, b), t);
      if (fa < 0.01 && ra < 0.01) continue;
      const x = mix(pos[a][i][0], pos[b][i][0], t), y = mix(pos[a][i][1], pos[b][i][1], t);
      const ca = colorOf(i, a), cb = colorOf(i, b);
      const rgb = `${mix(ca[0], cb[0], t) | 0},${mix(ca[1], cb[1], t) | 0},${mix(ca[2], cb[2], t) | 0}`;
      if (fa > 0.01) {
        ctx.fillStyle = `rgba(${rgb},${fa})`;
        ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
      }
      if (ra > 0.01) {
        ctx.strokeStyle = `rgba(255,105,97,${ra})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, R + (i < REAL ? 1.6 : 0), 0, 7); ctx.stroke();
      }
    }
    ctx.font = "500 12px 'IBM Plex Sans', system-ui, sans-serif";
    const show = (set, alpha) => set.forEach(([x, y, text, side]) => {
      ctx.fillStyle = `rgba(161,161,166,${alpha})`;
      ctx.textAlign = side;
      ctx.fillText(text, x, y);
    });
    if (t < 1) show(labels[a], 1 - t);
    show(labels[b], t);
  };
  const steps = [...document.querySelectorAll("#dots-steps li")];
  const acc = $("#d-acc"), rec = $("#d-rec");
  const sync = () => {
    const k = Math.max(0, Math.min(4, Math.round(u)));
    steps.forEach((li, i) => { li.classList.toggle("on", i === k); li.classList.toggle("done", i < k); });
    acc.textContent = k >= 3 ? "94.2%" : "–";
    rec.textContent = k >= 3 ? "0 of 74" : "–";
  };
  layout();
  new ResizeObserver(() => { layout(); draw(); }).observe(canvas.parentElement);
  if (!MOTION || !G) { draw(); sync(); return; }
  $("#dots-stage").classList.add("is-pinned");
  u = 0;
  layout();
  draw();
  sync();
  const prog = { u: 0 };
  G.to(prog, {
    u: 4, ease: "none",
    onUpdate: () => { u = prog.u; draw(); sync(); },
    scrollTrigger: { trigger: "#dots-stage", start: () => `top ${barH()}`, end: "+=320%", pin: true, scrub: 0.5, invalidateOnRefresh: true },
  });
});

/* ---------- How they work 4: one claim through the revenue cycle ---------- */

safe("claim", () => {
  const stage = $("#claim-stage");
  if (!stage) return;
  const codes = $("#cl-codes");
  const paths = ["#cl-p1", "#cl-p2", "#cl-p3", "#cl-p4"].map((s) => $(s));
  // Each link runs from a procedure's right edge to a diagnosis's left edge. Two links leaving one line split slightly.
  // Line 2 starts on the wrong diagnosis (p3), which gets it denied; p4 is the corrected link.
  const LINKS = [["#cl-l1", "#cl-a", -4], ["#cl-l1", "#cl-b", 4], ["#cl-l2", "#cl-b", 0], ["#cl-l2", "#cl-a", 0]];
  const drawLinks = () => {
    const box = codes.getBoundingClientRect();
    LINKS.forEach(([from, to, dy], i) => {
      const a = $(from).getBoundingClientRect(), b = $(to).getBoundingClientRect();
      const x1 = a.right - box.left, y1 = a.top - box.top + a.height / 2 + dy;
      const x2 = b.left - box.left, y2 = b.top - box.top + b.height / 2;
      const m = (x2 - x1) / 2;
      paths[i].setAttribute("d", `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + m).toFixed(1)} ${y1.toFixed(1)} ${(x2 - m).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    });
  };
  drawLinks();
  new ResizeObserver(drawLinks).observe(codes);
  if (!MOTION || !G) return;

  stage.classList.add("is-pinned");
  const steps = [...document.querySelectorAll("#claim-steps li")];
  const pill = $("#cl-pill"), packet = $("#cl-packet"), route = $("#cl-route"), p3 = paths[2];
  const bars = [...document.querySelectorAll("#cl-track i")];
  const days = $("#cl-days"), bal = $("#cl-bal");
  const n = { days: 0, bal: 155 };
  const paint = () => { days.textContent = Math.round(n.days); bal.textContent = `$${n.bal.toFixed(2)}`; };
  // [from time, step, pill text, pill tone, route note, packet tone]
  const STATES = [
    [0, 0, "Draft", "", "", ""],
    [1.4, 1, "Verified", "is-blue", "", ""],
    [2.2, 2, "Coded", "is-blue", "", ""],
    [3.8, 3, "Submitted", "is-blue", "837 claim sent", ""],
    [4.7, 4, "Denied", "is-bad", "835 remit: denied", "is-bad"],
    [5.8, 4, "Resubmitted", "is-blue", "Corrected 837 sent", ""],
    [6.4, 5, "Paid", "is-good", "835 remit received", "is-good"],
  ];
  let shown = -1;
  const sync = (t) => {
    let s = 0;
    while (s < STATES.length - 1 && t >= STATES[s + 1][0]) s++;
    p3.classList.toggle("is-bad", t >= 4.8);
    if (s === shown) return;
    shown = s;
    const [, k, label, tone, note, ptone] = STATES[s];
    steps.forEach((li, i) => { li.classList.toggle("on", i === k); li.classList.toggle("done", i < k); });
    pill.textContent = label;
    pill.className = `claim__pill ${tone}`;
    route.textContent = note;
    packet.className = `claim__packet ${ptone}`;
  };
  const tl = G.timeline({
    defaults: { ease: "power2.out" },
    onUpdate: () => sync(tl.time()),
    scrollTrigger: { trigger: stage, start: () => `top ${barH()}`, end: "+=340%", pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
  // Demographics type in, then eligibility comes back clean
  tl.set(n, { days: 0, bal: 155, onUpdate: paint }, 0);
  document.querySelectorAll(".claim__fields dd").forEach((dd, i) => tl.fromTo(dd, { "--w": "0%" }, { "--w": "100%", duration: 0.45, ease: "none" }, i * 0.25));
  tl.fromTo("#cl-elig", { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.4 }, 1.5)
    // Coding: lines and diagnoses appear, then the pointers link them
    .fromTo(".claim__lines li, .claim__dx li", { opacity: 0.3 }, { opacity: 1, duration: 0.3, stagger: 0.1 }, 2.3)
    .fromTo(paths, { strokeDashoffset: 1 }, { strokeDashoffset: (i) => (i === 3 ? 1 : 0), duration: 0.45, stagger: 0.1, ease: "power1.inOut" }, 2.8)
    .fromTo(p3, { opacity: 1 }, { opacity: 1, duration: 0.01 }, 0)
    // Submission
    .fromTo(packet, { "--x": "0%", opacity: 0 }, { opacity: 1, duration: 0.1 }, 3.85)
    .to(packet, { "--x": "100%", duration: 0.5, ease: "power1.inOut" }, 3.9)
    .fromTo(bars[0], { "--p": 0 }, { "--p": 1, duration: 0.5, ease: "none" }, 3.9)
    .to(n, { days: 9, duration: 0.6, ease: "none", onUpdate: paint }, 3.9)
    // Denied for the wrong link on line 2, fixed, resubmitted
    .to(packet, { "--x": "0%", duration: 0.4, ease: "power1.inOut" }, 4.7)
    .fromTo(bars[1], { "--p": 0 }, { "--p": 1, duration: 0.3, ease: "none" }, 4.7)
    .fromTo("#cl-deny", { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, 4.9)
    .to(p3, { opacity: 0, duration: 0.3 }, 5.25)
    .to(paths[3], { strokeDashoffset: 0, duration: 0.4, ease: "power1.inOut" }, 5.4)
    .to("#cl-deny", { opacity: 0, duration: 0.2 }, 5.8)
    .to(packet, { "--x": "100%", duration: 0.4, ease: "power1.inOut" }, 5.8)
    .fromTo(bars[2], { "--p": 0 }, { "--p": 1, duration: 0.4, ease: "none" }, 5.8)
    .to(n, { days: 16, duration: 0.5, ease: "none", onUpdate: paint }, 5.8)
    // Paid: the remit comes back and posts
    .to(packet, { "--x": "0%", duration: 0.4, ease: "power1.inOut" }, 6.4)
    .fromTo(bars[3], { "--p": 0 }, { "--p": 1, duration: 0.3, ease: "none" }, 6.4)
    .fromTo("#cl-era", { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, 6.7)
    .fromTo(".claim__fall i", { scaleX: 0 }, { scaleX: 1, duration: 0.35, stagger: 0.12, ease: "power2.out" }, 6.75)
    .to(n, { days: 23, bal: 0, duration: 0.6, ease: "none", onUpdate: paint }, 6.8)
    .to({}, { duration: 0.4 });
  paint();
  sync(0);
});

/* ---------- Experience: the RCM cycle ring loops beside the DocPro role ---------- */

safe("cycle", () => {
  const svg = $("#cycle-svg");
  if (!svg) return;
  const ST = ["Demographics", "Eligibility", "Coding", "Claim submission", "Payment posting", "AR and denials"];
  const R = 76, NUM_R = 93, GAP = 7; // GAP: degrees left open between segments
  const pt = (deg, r) => [Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r];
  const arc = (a0, a1) => { const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  svgEl("circle", { class: "track", r: 62 }, svg);
  const segs = [], fills = [], nums = [];
  ST.forEach((_, i) => {
    const a0 = i * 60 + GAP / 2, a1 = (i + 1) * 60 - GAP / 2;
    segs.push(svgEl("path", { class: "seg", d: arc(a0, a1) }, svg));
    fills.push(svgEl("path", { class: "fill", d: arc(a0, a1), pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }, svg));
    const [x, y] = pt((a0 + a1) / 2, NUM_R);
    const t = svgEl("text", { class: "num", x: x.toFixed(1), y: y.toFixed(1) }, svg);
    t.textContent = i + 1;
    nums.push(t);
  });
  const num = $("#cy-n"), title = $("#cy-t");
  let last = -1;
  // k: the stage in progress, f: how far through it (0–1)
  const show = (k, f) => {
    fills.forEach((p, i) => p.setAttribute("stroke-dashoffset", i === k ? (1 - f).toFixed(3) : 1));
    if (k === last) return;
    last = k;
    segs.forEach((s, i) => s.classList.toggle("done", i < k));
    nums.forEach((t, i) => t.classList.toggle("on", i <= k));
    num.textContent = `0${k + 1} / 06`;
    title.textContent = ST[k];
  };
  if (!MOTION) { segs.forEach((s) => s.classList.add("done")); nums.forEach((t) => t.classList.add("on")); return; }
  const STAGE = 1700;
  let start = 0, frame = 0, offset = 0;
  const tick = (now) => {
    if (!start) start = now - offset;
    const t = (now - start) % (STAGE * ST.length);
    offset = t;
    const k = Math.floor(t / STAGE);
    // Each segment sweeps in over the first 60% of its time, then holds.
    show(k, Math.min(1, (t - k * STAGE) / (STAGE * 0.6)));
    frame = requestAnimationFrame(tick);
  };
  show(0, 0);
  watch($("#cycle"), () => { if (!frame) { start = 0; frame = requestAnimationFrame(tick); } }, () => { cancelAnimationFrame(frame); frame = 0; }, 0.4);
});

/* ---------- Contact: the closing line fills in letter by letter as it scrolls up ---------- */

safe("contact", () => {
  const h = $(".contact__big");
  if (!h || !MOTION || !G) return;
  const text = h.textContent.trim();
  h.setAttribute("aria-label", text);
  // Words stay whole so a line never breaks inside one.
  h.innerHTML = text.split(" ").map((w) => `<span aria-hidden="true" style="display: inline-block; white-space: nowrap">${[...w].map((c) => `<span class="ch">${c}</span>`).join("")}</span>`).join(" ");
  G.fromTo(h.querySelectorAll(".ch"), { color: "#3a3a3d" }, {
    color: "#f5f5f7", stagger: 0.1, ease: "none",
    // Ends as the card's bottom clears the window, which the last scroll position always reaches.
    scrollTrigger: { trigger: h, start: "top 90%", endTrigger: ".contact", end: "bottom 97%", scrub: 0.4, refreshPriority: -2 },
  });
});

/* ---------- Skills map ---------- */

safe("skills", () => {
  const svg = $("#skills-svg");
  if (!svg) return;
  const P = [["School system", "p-school"], ["Dashboards", "p-retool"], ["ProstadeNet", "p-prostadenet"], ["Flutter apps", "p-flutter"], ["Stroke ML", "p-stroke"], ["Password CLI", "p-password"], ["DocPro Health (RCM)", "x-docpro"]];
  const S = [
    ["SQL & MySQL", [0, 1]], ["PHP & Laravel", [0]], ["Retool", [1]], ["HTML, CSS & Tailwind", [0]],
    ["Python", [2, 4]], ["TensorFlow & Keras", [2]], ["OpenCV", [2]], ["scikit-learn & pandas", [4]],
    ["Flutter & Dart", [3]], ["REST APIs", [3]], ["Bash & Linux", [5]], ["Git & GitHub", [0, 3, 4, 5]],
    ["CPT & ICD-10-CM coding", [6]], ["Claims, AR & denials", [6]],
  ];
  const sy = (i) => 30 + i * 37;
  const py = (j) => 55 + j * 72;
  const links = [];
  const linkLayer = svgEl("g", {}, svg);
  S.forEach(([, ps], i) => ps.forEach((j) => {
    links.push({ path: svgEl("path", { class: "lnk", d: `M244 ${sy(i)} C370 ${sy(i)} 350 ${py(j)} 476 ${py(j)}`, pathLength: 1 }, linkLayer), s: i, p: j });
  }));
  const sNodes = S.map(([name], i) => {
    const g = svgEl("g", { class: "sn", tabindex: 0, "aria-label": `${name}: used in ${S[i][1].map((j) => P[j][0]).join(", ")}` }, svg);
    svgEl("circle", { cx: 244, cy: sy(i), r: 6 }, g);
    svgEl("text", { x: 230, y: sy(i) + 4, "text-anchor": "end" }, g).textContent = name;
    return g;
  });
  const pNodes = P.map(([name, id], j) => {
    const g = svgEl("g", { class: "pn", tabindex: 0, role: "link", "aria-label": `${name}: go to it on the page` }, svg);
    svgEl("circle", { cx: 476, cy: py(j), r: 8 }, g);
    svgEl("text", { x: 492, y: py(j) + 4 }, g).textContent = name;
    const go = () => goToProject(document.getElementById(id));
    g.addEventListener("click", go);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    return g;
  });
  // The map is drawn for sighted visitors; the table next to it carries the same data for screen readers.
  svg.removeAttribute("aria-hidden");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Skills connected to the projects that used them");
  const clear = () => { svg.classList.remove("focus"); svg.querySelectorAll(".on").forEach((n) => n.classList.remove("on")); };
  const light = (kind, idx) => {
    clear();
    svg.classList.add("focus");
    links.forEach((l) => {
      if ((kind === "s" && l.s === idx) || (kind === "p" && l.p === idx)) {
        l.path.classList.add("on"); sNodes[l.s].classList.add("on"); pNodes[l.p].classList.add("on");
      }
    });
  };
  sNodes.forEach((g, i) => ["pointerenter", "focus"].forEach((ev) => g.addEventListener(ev, () => light("s", i))));
  pNodes.forEach((g, j) => ["pointerenter", "focus"].forEach((ev) => g.addEventListener(ev, () => light("p", j))));
  [...sNodes, ...pNodes].forEach((g) => ["pointerleave", "blur"].forEach((ev) => g.addEventListener(ev, clear)));
  if (!MOTION || !G) return;
  G.set(links.map((l) => l.path), { strokeDasharray: 1, strokeDashoffset: 1 });
  G.set([...sNodes, ...pNodes], { opacity: 0 });
  ScrollTrigger.create({
    trigger: svg, start: "top 75%", once: true,
    onEnter: () => {
      G.to(sNodes, { opacity: 1, duration: 0.4, stagger: 0.04, ease: "power2.out" });
      G.to(links.map((l) => l.path), { strokeDashoffset: 0, duration: 0.9, stagger: 0.035, ease: "power2.inOut", delay: 0.2 });
      G.to(pNodes, { opacity: 1, duration: 0.4, stagger: 0.07, ease: "power2.out", delay: 0.6 });
    },
  });
});

/* ---------- Experience timeline ---------- */

safe("timeline", () => {
  const wrap = $("#tl"), list = wrap && wrap.querySelector(".timeline");
  if (!list || !MOTION || !mm) return;
  const items = [...list.children];
  const year = $("#tl-year"), label = $("#tl-label");
  // Newest first, so the year counts back as you read down.
  const ROLES = [[2026, "RCM training at DocPro Health"], [2026, "Workflow automation in Retool"], [2025, "Thesis research"], [2024, "Sales"], [2019, "Started tutoring"]];
  list.classList.add("is-live");
  const light = (p) => {
    list.style.setProperty("--p", p.toFixed(4));
    const lineH = list.offsetHeight - 16;
    items.forEach((li) => li.classList.toggle("is-lit", li.offsetTop + 26 <= 8 + p * lineH)); // 26px: centre of each dot
  };

  // Tall screens: pin the section, slide the roles in one by one and count the year back.
  mm.add("(min-width: 56rem) and (min-height: 800px)", () => {
    wrap.classList.add("is-pinned");
    const y = { v: 2026 };
    const tl = G.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: { trigger: wrap, start: () => `top ${barH()}`, end: "+=250%", pin: true, scrub: 0.6, invalidateOnRefresh: true, refreshPriority: -1 },
    });
    // When the roles are taller than the window, the list drifts up as they arrive, so the newest sits in view
    // and the last one ends 12px clear of the bottom edge.
    const over = () => Math.max(0, list.offsetHeight - wrap.clientHeight + 24) / 2;
    tl.set(items, { x: 60, opacity: 0 }, 0).set(y, { v: 2026 }, 0)
      .fromTo(list, { y: over }, { y: () => -over(), ease: "none", duration: items.length - 0.4, immediateRender: false }, 0);
    items.forEach((li, i) => {
      tl.to(li, { x: 0, opacity: 1, duration: 0.6 }, i)
        .to(y, { v: ROLES[i][0], duration: 0.6, ease: "none", onUpdate: () => (year.textContent = Math.round(y.v)), onStart: () => (label.textContent = ROLES[i][1]), onReverseComplete: () => (label.textContent = ROLES[Math.max(0, i - 1)][1]) }, i)
        .to({}, { duration: 0.6, onUpdate() { light((i + this.progress()) / items.length); } }, i);
      if (i > 0) tl.to(items.slice(0, i), { opacity: 0.45, duration: 0.4 }, i);
    });
    tl.to(items, { opacity: 1, duration: 0.4 }, items.length).to({}, { duration: 0.3 });
    year.textContent = "2026";
    label.textContent = ROLES[0][1];
    return () => { wrap.classList.remove("is-pinned"); G.set(items, { clearProps: "transform,opacity" }); G.set(list, { clearProps: "transform" }); };
  });

  // Everywhere else: the line fills down to just past the middle of the window as you scroll.
  mm.add("not all and (min-width: 56rem) and (min-height: 800px)", () => {
    ScrollTrigger.create({ trigger: list, start: "top 60%", end: "bottom 60%", onUpdate: (self) => light(self.progress), onRefresh: (self) => light(self.progress) });
  });
});

/* ---------- Final measure once fonts and images settle ---------- */

if (G) {
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh());
}
})();
