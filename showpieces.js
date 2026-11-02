/* Showpieces: smooth scrolling, the pinned scroll stories, the running mockups and the case studies.
   GSAP and ScrollTrigger drive the pins and scrubs, Lenis smooths the scroll. Without them, or with reduced motion,
   every piece falls back to a still layout that still reads on its own. */
(() => {
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("quick");
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
// Work that can wait: done while the browser is idle, never during page load (a short delay where idle callbacks are missing)
const whenIdle = (fn, timeout = 4000) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 1500));
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
  // Measured from the pin's placeholder, which stays where the intro belongs. A resize far down the page (a phone turning sideways)
  // would otherwise measure the moved intro, the trigger would land above the page, and the intro would never come back.
  const heroTop = () => (hero.closest(".pin-spacer") || hero).getBoundingClientRect().top + scrollY;
  const tl = G.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: hero, start: () => (tall() ? heroTop() + hero.offsetHeight - innerHeight : heroTop() - barH()), end: () => `+=${Math.min(hero.offsetHeight, innerHeight)}`,
      pin: true, pinSpacing: false, scrub: 0.5, invalidateOnRefresh: true,
    },
  });
  // Explicit start values: these elements are still mid-entrance (hidden) when the timeline is built,
  // and a plain .to() would record that hidden state as the place to scroll back to.
  tl.fromTo(".hero__text, .hero .lead", { scale: 1, y: 0, opacity: 1 }, { scale: 0.9, y: -40, opacity: 0, transformOrigin: "0% 50%" }, 0);
  // The panel recedes with it. The satin behind the page pushes in on its own as the intro is covered (script.js).
  if ($(".hpanel")) tl.fromTo(".hpanel", { scale: 1, y: 0, opacity: 1 }, { scale: 0.92, y: -40, opacity: 0, transformOrigin: "50% 50%" }, 0);
});

/* ---------- Projects strip: scrolling down moves the cards sideways ---------- */

let stripST = null;
const goToProject = (card) => {
  if (!card) return;
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
  const strip = $("#strip"), track = $("#strip-track"), count = $("#strip-n"), rail = $(".rail");
  mm.add("(min-width: 64rem) and (min-height: 760px)", () => {
    strip.classList.add("is-sideways", "bleed");
    const parts = [...track.children].map((c) => ({ c, info: c.querySelector(".project__info"), vis: c.querySelector(".project__visual") }));
    let shownNo = 1;
    // Every card is measured first and written after, so a frame never forces more than one layout.
    const parallax = () => {
      const mid = innerWidth / 2, W = innerWidth;
      const rects = parts.map(({ c }) => c.getBoundingClientRect());
      const texts = parts.map(({ info }) => info.getBoundingClientRect());
      let nearest = 0, best = Infinity;
      parts.forEach(({ c, info, vis }, i) => {
        const r = rects[i], t = texts[i];
        const off = r.left + r.width / 2 - mid;
        const o = Math.max(-1.5, Math.min(1.5, off / r.width));
        info.style.transform = `translateX(${(o * -36).toFixed(1)}px)`;
        // The text stays fully readable while it is on screen and fades only as it crosses an edge,
        // so a title or description is never shown cut off
        const outside = Math.max(0, -t.left, t.right - W) / Math.max(1, t.width);
        info.style.opacity = (1 - Math.min(1, outside / 0.1)).toFixed(3);
        vis.style.transform = `translateX(${(o * 60).toFixed(1)}px)`;
        // The projects either side stay as dimmer hints of what comes next
        c.style.opacity = (1 - Math.min(1, Math.abs(o)) * 0.5).toFixed(3);
        if (Math.abs(off) < best) { best = Math.abs(off); nearest = i; }
      });
      if (nearest + 1 !== shownNo) count.textContent = shownNo = nearest + 1;
    };
    const tween = G.to(track, {
      x: () => -Math.max(0, track.scrollWidth - innerWidth),
      ease: "none",
      // Runs on every frame the track moves, including the glide after the scroll stops, so the fades never lag the cards
      onUpdate: parallax,
      scrollTrigger: {
        trigger: strip, start: "top top", end: () => `+=${Math.max(1, track.scrollWidth - innerWidth)}`,
        // Pins are measured in page order: the strip first, then Experience, then the scroll stories below them
        pin: true, scrub: 0.6, invalidateOnRefresh: true, refreshPriority: 2, onRefresh: parallax,
        // The cards run edge to edge here, so the section rail steps aside instead of sitting on their text.
        onToggle: (self) => { if (rail) rail.classList.toggle("is-tucked", self.isActive); },
      },
    });
    stripST = tween.scrollTrigger;
    // When the reader stops between two projects, the strip glides on to the next one in the direction they were going,
    // so no description is ever left half off the page.
    const centred = () => parts.map(({ c }) => {
      const dist = Math.max(1, track.scrollWidth - innerWidth);
      const p = Math.max(0, Math.min(1, (c.offsetLeft + c.offsetWidth / 2 - innerWidth / 2) / dist));
      return stripST.start + p * (stripST.end - stripST.start);
    });
    let idle = 0, lastY = scrollY, dir = 1;
    const settle = () => {
      if (!stripST || !stripST.isActive) return;
      const y = scrollY, ys = centred();
      const to = dir > 0 ? ys.find((v) => v >= y - 1) : [...ys].reverse().find((v) => v <= y + 1);
      if (to === undefined || Math.abs(to - y) < 2) return;
      if (lenis) lenis.scrollTo(to, { duration: 0.7, easing: (t) => 1 - Math.pow(1 - t, 3) });
      else window.scrollTo({ top: to, behavior: "smooth" });
    };
    const onScroll = () => {
      if (scrollY !== lastY) dir = scrollY > lastY ? 1 : -1;
      lastY = scrollY;
      clearTimeout(idle);
      idle = setTimeout(settle, 180);
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stripST = null;
      removeEventListener("scroll", onScroll);
      clearTimeout(idle);
      if (rail) rail.classList.remove("is-tucked");
      strip.classList.remove("is-sideways", "bleed");
      parts.forEach(({ c, info, vis }) => { info.style.transform = info.style.opacity = vis.style.transform = c.style.opacity = ""; });
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

/* ---------- Hero panel: one window, a tab for each noun in the headline ----------
   Databases shows requests arriving at the school system, dashboards a sample Retool board, models the real tuning curve
   from the thesis. The tabs take turns while the intro is in view, and the matching word in the headline lights up.
   Pointer or keyboard focus on the panel holds it still; a tab click stops the turns. */

safe("hero panel", () => {
  const panel = $("#hpanel");
  if (!panel) return;
  const q = (sel) => panel.querySelector(sel);
  const head = $("#about-title");
  // Without the word-by-word split (reduced motion), the three nouns get spans of their own so they can still light up
  if (!head.querySelector(".w")) head.innerHTML = head.innerHTML.replace(/\b(databases|dashboards|models)\b/g, '<span class="noun">$1</span>');
  const noun = (w) => [...head.querySelectorAll(".w > span, .noun")].find((el) => el.textContent.startsWith(w));

  const HOLD = 6500;
  const META = {
    db: { word: "databases", title: "school_db · requests", name: "School management system", note: "sample traffic", href: "#p-school" },
    dash: { word: "dashboards", title: "ops_dashboard · retool", name: "Operations dashboards", note: "sample data", href: "#p-retool" },
    model: { word: "models", title: "prostadenet · tuning", name: "ProstadeNet", note: "thesis results", href: "#p-prostadenet" },
  };
  const ORDER = ["db", "dash", "model"];
  const tabs = q(".hp-tabs"), buttons = [...tabs.querySelectorAll("button")];
  const panes = Object.fromEntries(ORDER.map((k) => [k, q(`[data-pane="${k}"]`)]));
  const title = $("#hp-title"), foot = $("#hp-foot"), name = $("#hp-name"), note = $("#hp-note");
  tabs.style.setProperty("--hold", `${HOLD}ms`);

  // Databases: sample requests arriving at the school system's routes
  const REQS = [["GET", "/classes", 200], ["POST", "/student", 201], ["GET", "/attendance-create/4", 200], ["POST", "/assign-subject-to-class/12", 302], ["GET", "/roles-permissions", 200], ["PUT", "/teacher/7", 200], ["GET", "/parents", 200], ["DELETE", "/subject/3", 302], ["POST", "/assignrole", 302]];
  const log = $("#hp-log");
  let reqNo = 0, reqTimer = 0;
  const addReq = (animate) => {
    const [m, path, st] = REQS[reqNo++ % REQS.length];
    const li = document.createElement("li");
    li.innerHTML = `<span class="m m-${m}">${m}</span><span class="p">${path}</span><span class="st${st === 302 ? " r" : ""}">${st}</span><span class="ms">${8 + Math.round(Math.random() * 40)} ms</span>`;
    log.prepend(li);
    while (log.children.length > 8) log.lastChild.remove();
    if (animate) li.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE_OUT });
  };
  for (let i = 0; i < 8; i++) addReq(false);
  const startDb = () => {
    clearInterval(reqTimer);
    reqTimer = MOTION ? setInterval(() => addReq(true), 850) : 0;
  };

  // Dashboards: the bars grow and the two figures count up
  const dash = q(".hp-dash");
  const count = (el, to) => {
    if (!MOTION) { el.textContent = to; return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const startDash = () => {
    dash.classList.remove("is-on");
    void dash.offsetWidth;
    dash.classList.add("is-on");
    count($("#hp-open"), 128);
    count($("#hp-sent"), 42);
  };

  // Models: the tuning curve from the thesis (STEPS, script.js) draws itself
  const chartHost = $("#hp-chart");
  const W = 340, H = 150, M = { t: 20, r: 10, b: 8, l: 30 }, last = STEPS.length - 1;
  const cx = (i) => M.l + (i * (W - M.l - M.r)) / last;
  const cy = (v) => M.t + ((100 - v) / 4.5) * (H - M.t - M.b);
  const svg = svgEl("svg", { class: "hp-chart", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" }, chartHost);
  for (let v = 96; v <= 100; v += 2) {
    svgEl("line", { class: "g", x1: M.l, x2: W - M.r, y1: cy(v), y2: cy(v) }, svg);
    svgEl("text", { x: M.l - 6, y: cy(v) + 3.5, "text-anchor": "end" }, svg).textContent = `${v}%`;
  }
  let d = `M ${cx(0)} ${cy(STEPS[0].acc)}`;
  for (let i = 1; i <= last; i++) d += ` H ${cx(i)} V ${cy(STEPS[i].acc)}`;
  const area = svgEl("path", { class: "a", d: `${d} V ${H - M.b} H ${cx(0)} Z` }, svg);
  const line = svgEl("path", { class: "l", d, pathLength: 1 }, svg);
  const top = STEPS[last];
  const mark = svgEl("line", { class: "m", x1: cx(last), x2: cx(last), y1: cy(top.acc), y2: H - M.b }, svg);
  const dot = svgEl("circle", { class: "d", r: 3.5, cx: cx(last), cy: cy(top.acc) }, svg);
  const val = svgEl("text", { class: "v", "text-anchor": "middle", x: Math.min(cx(last), W - M.r - 22), y: cy(top.acc) - 8 }, svg);
  val.textContent = `${top.acc.toFixed(2)}%`;
  $("#hp-read").textContent = "Ten tuning steps took test accuracy from 96.07% to 99.83%.";
  const startModel = () => {
    if (!MOTION) return;
    line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500, easing: "cubic-bezier(.45, 0, .2, 1)", fill: "backwards" });
    area.animate([{ opacity: 0 }, { opacity: 0.8 }], { duration: 700, delay: 900, easing: "ease", fill: "backwards" });
    [mark, dot, val].forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 1350, easing: "ease", fill: "backwards" }));
  };

  const START = { db: startDb, dash: startDash, model: startModel };
  let cur = 0, timer = 0, began = 0, left = HOLD, manual = false, held = false, onScreen = true, live = false;
  const lit = (k) => ORDER.forEach((o) => { const w = noun(META[o].word); if (w) w.classList.toggle("is-lit", o === k); });
  const schedule = (ms) => {
    clearTimeout(timer);
    if (!MOTION || manual || held || !onScreen || !live) return;
    began = performance.now();
    left = ms;
    timer = setTimeout(() => show((cur + 1) % ORDER.length), ms);
  };
  const show = (i) => {
    cur = i;
    const k = ORDER[i], m = META[k];
    ORDER.forEach((o, j) => {
      panes[o].hidden = o !== k;
      buttons[j].setAttribute("aria-pressed", String(o === k));
    });
    lit(k);
    title.textContent = m.title;
    name.textContent = m.name;
    note.textContent = m.note;
    foot.setAttribute("href", m.href);
    if (MOTION) panes[k].animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE_OUT });
    clearInterval(reqTimer);
    START[k]();
    tabs.classList.remove("is-auto");
    void tabs.offsetWidth;
    tabs.classList.toggle("is-auto", MOTION && !manual);
    schedule(HOLD);
  };
  buttons.forEach((b, i) => b.addEventListener("click", () => { manual = true; show(i); }));
  // The link in the foot goes to its project, even when the card sits further along the sideways strip
  foot.addEventListener("click", (e) => {
    const card = document.querySelector(foot.getAttribute("href"));
    if (!card) return;
    e.preventDefault();
    goToProject(card);
  });
  // Holding the pointer or keyboard focus on it stops the clock, so it never changes under someone reading it
  const hold = (h) => {
    held = h;
    tabs.classList.toggle("is-held", h);
    if (h) { clearTimeout(timer); left = Math.max(300, left - (performance.now() - began)); }
    else schedule(left);
  };
  panel.addEventListener("pointerenter", () => hold(true));
  panel.addEventListener("pointerleave", () => hold(false));
  panel.addEventListener("focusin", () => hold(true));
  panel.addEventListener("focusout", () => hold(false));
  watch(panel, () => {
    onScreen = true;
    if (!live) return;
    if (ORDER[cur] === "db") startDb();
    schedule(left);
  }, () => {
    onScreen = false;
    clearTimeout(timer);
    clearInterval(reqTimer);
  }, 0.2);
  // The turns start once the intro screen has lifted, so the first pane plays where it can be seen
  const start = () => { live = true; show(0); };
  if (document.documentElement.classList.contains("intro-on")) window.addEventListener("intro:done", start, { once: true });
  else start();
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
  // The feature maps take a moment to compute, so they are made while the browser is idle rather than during page load,
  // and each run's maps are kept for the next lap of the loop.
  const cache = new Map();
  const mapsFor = (seed) => { if (!cache.has(seed)) cache.set(seed, maps(seed)); return cache.get(seed); };
  let primed = false;
  const prime = () => { if (primed) return; primed = true; apply(mapsFor(RUNS[0][0])); };
  whenIdle(prime, 5000);
  const first = scores(RUNS[0][1], RUNS[0][0]);
  showScores(first, RUNS[0][1]);
  setPred(RUNS[0][1], first[RUNS[0][1]]);
  if (!MOTION || !G) return;

  let run = 1, tl = null, visible = false, lastP = first;
  const cycle = () => {
    const [seed, g] = RUNS[run++ % RUNS.length];
    const m = mapsFor(seed);
    // The next lap's maps are made in the pause at the end of this one
    whenIdle(() => mapsFor(RUNS[run % RUNS.length][0]), 3000);
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
  watch(host, () => { visible = true; prime(); if (!tl) cycle(); else tl.resume(); }, () => { visible = false; if (tl) tl.pause(); }, 0.3);
});

/* ---------- Case studies: four short scenes that play on their own ----------
   Each case study opens on a reel: a picture and one line per scene, so the story lands without reading.
   The markup holds every finished picture. Each scene's timeline animates into it and can always settle there.
   With reduced motion, Quick view or no GSAP, the scenes sit side by side as a still storyboard. */

safe("reels", () => {
  const reels = [...document.querySelectorAll("[data-reel]")];
  if (!reels.length) return;
  const LIVE = MOTION && !!G;
  const SCENE = 5; // seconds each scene stays up, so four scenes make the 20 seconds the buttons promise

  // One drawn tissue tile feeds every thesis picture
  let tissue = null;
  const tissueTile = () => {
    if (!tissue) {
      tissue = document.createElement("canvas");
      tissue.width = tissue.height = 512;
      drawTissue(tissue, false, 11);
    }
    return tissue;
  };
  // A real 3 × 3 sharpen at half strength, so the Sharpness row shows what the augmentation did
  const sharpen = (x, n) => {
    const s = x.getImageData(0, 0, n, n).data, out = x.createImageData(n, n), o = out.data;
    const at = (px, py, c) => s[(Math.min(n - 1, Math.max(0, py)) * n + Math.min(n - 1, Math.max(0, px))) * 4 + c];
    for (let py = 0; py < n; py++) {
      for (let px = 0; px < n; px++) {
        const i = (py * n + px) * 4;
        for (let c = 0; c < 3; c++) o[i + c] = 3 * s[i + c] - 0.5 * (at(px - 1, py, c) + at(px + 1, py, c) + at(px, py - 1, c) + at(px, py + 1, c));
        o[i + 3] = 255;
      }
    }
    x.putImageData(out, 0, 0);
  };
  // Counts a number up to the value written in the markup
  const countUp = (el, tl, at, dur) => {
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), unit = el.dataset.unit || "";
    const o = { v: parseFloat(el.dataset.from || 0) };
    const paint = () => (el.textContent = (dec ? o.v.toFixed(dec) : fmt(o.v)) + unit);
    paint();
    tl.to(o, { v: to, duration: dur, ease: "power2.out", onUpdate: paint }, at);
  };
  const rise = (tl, el, at = 0.1) => tl.from(el, { y: 16, opacity: 0, duration: 0.6, ease: "power3.out" }, at);
  const drawIn = (tl, path, at, duration) => {
    path.setAttribute("stroke-dasharray", "1");
    tl.fromTo(path, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration, ease: "none" }, at);
  };

  // Sample records for the school app. Names match the sample attendance in the scroll story.
  const MODULES = [
    ["Classes", [["Class 6", "34 students"], ["Class 7", "38 students"], ["Class 8", "36 students"]]],
    ["Subjects", [["Mathematics", "Classes 6–8"], ["English", "Classes 6–8"], ["Science", "Classes 7–8"]]],
    ["Teachers", [["Farhana Akter", "Mathematics"], ["Imran Hossain", "English"], ["Shirin Sultana", "Science"]]],
    ["Students", [["Ayesha Rahman", "Class 7"], ["Tanvir Hasan", "Class 7"], ["Nusrat Jahan", "Class 7"]]],
    ["Parents", [["Mahbub Rahman", "Ayesha's father"], ["Rokeya Hasan", "Tanvir's mother"], ["Selina Jahan", "Nusrat's mother"]]],
  ];

  // Pieces made from data, built once per reel in every mode
  const BUILD = {
    "pn-goal": (sc) => sc.querySelector(".grade canvas").getContext("2d").drawImage(tissueTile(), 0, 0),
    "pn-data": (sc) => {
      const host = sc.querySelector(".aug5"), src = tissueTile();
      const SPOTS = [[20, 30], [180, 12], [340, 40], [60, 190], [250, 170], [350, 230], [12, 340], [160, 330], [300, 352], [200, 262]];
      const ROWS = [["Original", ""], ["Colour", "hue-rotate(-18deg) saturate(1.45)"], ["Brightness", "brightness(1.22)"], ["Contrast", "contrast(1.45)"], ["Sharpness", "sharpen"]];
      ROWS.forEach(([name, look]) => {
        const row = document.createElement("div");
        row.className = "aug5__row";
        row.innerHTML = `<span>${name}</span><div class="aug5__tiles"></div>`;
        SPOTS.forEach(([sx, sy]) => {
          const c = document.createElement("canvas");
          c.width = c.height = 64;
          const x = c.getContext("2d", { willReadFrequently: look === "sharpen" });
          x.drawImage(src, sx, sy, 160, 160, 0, 0, 64, 64);
          if (look === "sharpen") sharpen(x, 64);
          else if (look) c.style.filter = look;
          row.lastElementChild.append(c);
        });
        host.append(row);
      });
    },
    // The ablation steps from the thesis (STEPS, script.js), drawn as a step line
    "pn-tune": (sc) => {
      const W = 420, H = 230, L = 36, R = 18, T = 26, B = 28, last = STEPS.length - 1;
      const X = (i) => L + (i * (W - L - R)) / last, Y = (v) => T + ((100 - v) / 4.5) * (H - T - B);
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` });
      const defs = svgEl("defs", {}, svg);
      const grad = svgEl("linearGradient", { id: "reel-tune-fill", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svgEl("stop", { offset: 0, "stop-color": "#2997ff", "stop-opacity": 0.28 }, grad);
      svgEl("stop", { offset: 1, "stop-color": "#2997ff", "stop-opacity": 0 }, grad);
      svgEl("rect", { class: "tune__clip", x: 0, y: 0, width: W, height: H }, svgEl("clipPath", { id: "reel-tune-clip" }, defs));
      const grid = svgEl("g", { class: "grid" }, svg);
      for (let v = 96; v <= 100; v++) {
        svgEl("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v) }, grid);
        svgEl("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, grid).textContent = `${v}%`;
      }
      STEPS.forEach((_, i) => (svgEl("text", { x: X(i), y: H - 6, "text-anchor": "middle" }, grid).textContent = i));
      let d = `M ${X(0)} ${Y(STEPS[0].acc)}`;
      for (let i = 1; i <= last; i++) d += ` H ${X(i)} V ${Y(STEPS[i].acc)}`;
      svgEl("path", { class: "area", d: `${d} V ${H - B} H ${X(0)} Z`, "clip-path": "url(#reel-tune-clip)" }, svg);
      svgEl("path", { class: "line", d, pathLength: 1 }, svg);
      STEPS.forEach((s, i) => svgEl("circle", { class: i === last ? "dot is-big" : "dot", cx: X(i), cy: Y(s.acc), r: i === last ? 5 : 3.2 }, svg));
      [[0, "96.07%", 22, "start"], [5, "ReLU", -12, "middle"], [9, "Adam", -12, "middle"], [last, "99.83%", -13, "end"]].forEach(([i, text, dy, anchor]) => {
        svgEl("text", { class: "note", "data-i": i, x: X(i) - (anchor === "start" ? 4 : 0), y: Y(STEPS[i].acc) + dy, "text-anchor": anchor }, svg).textContent = text;
      });
      sc.querySelector(".tune").append(svg);
    },
    "sc-access": (sc) => sc.querySelectorAll(".perm__t i").forEach((t) => (t.dataset.on = t.classList.contains("on") ? "1" : "")),
  };

  // Each scene's timeline. Mostly from() tweens: the resting state is the finished picture.
  const PLAY = {
    "pn-goal": (sc, tl) => {
      const scan = sc.querySelector(".grade__scan"), top = sc.querySelector("[data-top]");
      // The predicted grade lights up only once the scores have settled
      top.classList.remove("is-top");
      tl.from(sc.querySelector(".grade__tile"), { scale: 0.86, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.1)
        .from(sc.querySelectorAll(".grade__list li"), { x: 14, opacity: 0, duration: 0.4, stagger: 0.07, ease: "power2.out" }, 0.35)
        .fromTo(scan, { yPercent: -100, opacity: 1 }, { yPercent: 340, duration: 1.4, ease: "power1.inOut" }, 0.6)
        .to(scan, { opacity: 0, duration: 0.3 }, 1.8)
        .from(sc.querySelectorAll(".grade__list i"), { scaleX: 0, duration: 1.1, stagger: 0.05, ease: "power3.out" }, 1.85)
        .call(() => top.classList.add("is-top"), null, 2.55);
    },
    "pn-data": (sc, tl) => {
      const rows = [...sc.querySelectorAll(".aug5__row")];
      if (!rows.length) return;
      tl.from(rows[0].querySelector("span"), { opacity: 0, duration: 0.3 }, 0.15)
        .from(rows[0].querySelectorAll("canvas"), { scale: 0.4, opacity: 0, duration: 0.45, stagger: 0.04, ease: "back.out(1.6)" }, 0.15);
      // Each original drops four changed copies below it
      rows.slice(1).forEach((row, r) => {
        const at = 0.95 + r * 0.42;
        tl.from(row.querySelector("span"), { opacity: 0, x: -8, duration: 0.3 }, at)
          .from(row.querySelectorAll("canvas"), { y: -24, opacity: 0, duration: 0.5, stagger: 0.025, ease: "power3.out" }, at);
      });
      countUp(sc.querySelector("[data-count]"), tl, 0.95, 1.9);
    },
    "pn-tune": (sc, tl) => {
      const svg = sc.querySelector(".tune svg");
      if (!svg) return;
      const dots = [...svg.querySelectorAll(".dot")];
      // When the line reaches each step, measured along its run and rise
      const seg = dots.map((d, i) => (i ? Math.abs(d.cx.baseVal.value - dots[i - 1].cx.baseVal.value) + Math.abs(d.cy.baseVal.value - dots[i - 1].cy.baseVal.value) : 0));
      const total = seg.reduce((a, b) => a + b, 0);
      let run = 0;
      const when = seg.map((l) => (run += l) / total);
      const D = 2.6, t0 = 0.45;
      tl.from(svg.querySelector(".grid"), { opacity: 0, duration: 0.5 }, 0.1)
        .fromTo(svg.querySelector(".tune__clip"), { attr: { width: 0 } }, { attr: { width: 420 }, duration: D, ease: "none" }, t0);
      drawIn(tl, svg.querySelector(".line"), t0, D);
      dots.forEach((d, i) => tl.from(d, { scale: 0, transformOrigin: "50% 50%", duration: 0.3, ease: "back.out(2.4)" }, t0 + D * when[i]));
      svg.querySelectorAll(".note").forEach((n) => tl.from(n, { opacity: 0, y: 6, duration: 0.35 }, t0 + D * when[+n.dataset.i] + 0.05));
    },
    "pn-result": (sc, tl) => {
      tl.from(sc.querySelectorAll(".race li"), { opacity: 0, y: 10, duration: 0.4, stagger: 0.06, ease: "power2.out" }, 0.1)
        // The others fill first, ProstadeNet last
        .from(sc.querySelectorAll(".race i"), { scaleX: 0, duration: 1.2, stagger: { each: 0.12, from: "end" }, ease: "power3.out" }, 0.5);
      countUp(sc.querySelector("[data-count]"), tl, 0.5, 1.9);
    },

    "sc-app": (sc, tl) => {
      const nav = [...sc.querySelectorAll(".sapp__nav li")], head = sc.querySelector(".sapp__h"), rows = [...sc.querySelectorAll(".sapp__rows li")];
      const open = (m) => {
        nav.forEach((li, i) => li.classList.toggle("is-on", i === m));
        head.textContent = MODULES[m][0];
        rows.forEach((li, r) => { [li.children[0].textContent, li.children[1].textContent] = MODULES[m][1][r]; });
      };
      open(0);
      rise(tl, sc.querySelector(".sapp"));
      tl.fromTo(rows, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.05 }, 0.45);
      for (let m = 1; m < MODULES.length; m++) {
        const at = 0.5 + m * 0.66;
        tl.call(open, [m], at).fromTo(rows, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, immediateRender: false }, at);
      }
    },
    "sc-day": (sc, tl) => {
      rise(tl, sc.querySelector(".att"));
      tl.from(sc.querySelectorAll(".att__rows em"), { scale: 0.5, opacity: 0, duration: 0.35, stagger: 0.3, ease: "back.out(2.2)" }, 0.75)
        .to(sc.querySelector(".att__save"), { scale: 0.9, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.inOut" }, 2.4)
        .from(sc.querySelector(".att__toast"), { y: 10, opacity: 0, duration: 0.4, ease: "power2.out" }, 2.65);
    },
    "sc-access": (sc, tl) => {
      const toggles = [...sc.querySelectorAll(".perm__t i")], req = sc.querySelector(".perm__req");
      toggles.forEach((t) => t.classList.remove("on"));
      rise(tl, sc.querySelector(".perm"));
      // Admin's column switches on first, then Teacher's
      toggles.filter((t) => t.dataset.on).sort((a, b) => a.parentElement.cellIndex - b.parentElement.cellIndex)
        .forEach((t, k) => tl.call(() => t.classList.add("on"), null, 0.75 + k * 0.2));
      tl.from(req, { y: 10, opacity: 0, duration: 0.4, ease: "power2.out" }, 2.25)
        .from(req.querySelector("em"), { scale: 1.8, opacity: 0, duration: 0.35, ease: "back.out(2)" }, 2.7)
        .to(req, { x: -4, duration: 0.06, repeat: 5, yoyo: true, ease: "none" }, 2.95);
    },
    "sc-stack": (sc, tl) => {
      const layers = [...sc.querySelectorAll(".lyr__l")], dot = sc.querySelector(".lyr__dot");
      const ys = layers.map((l) => l.offsetTop + l.offsetHeight / 2 - dot.offsetTop - dot.offsetHeight / 2);
      const hit = (k) => layers.forEach((l, i) => l.classList.toggle("is-hit", i === k));
      const last = ys.length - 1;
      tl.from(layers, { x: 18, opacity: 0, duration: 0.45, stagger: 0.1, ease: "power2.out" }, 0.1)
        .fromTo(dot, { y: ys[0], opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.75)
        .call(hit, [0], 0.8);
      // A request travels down to MySQL, then the answer comes back up
      for (let k = 1; k <= last; k++) tl.to(dot, { y: ys[k], duration: 0.32, ease: "power1.inOut" }, 0.8 + k * 0.38).call(hit, [k], 1.1 + k * 0.38);
      const up = 1.25 + ys.length * 0.38;
      for (let k = last - 1, j = 0; k >= 0; k--, j++) tl.to(dot, { y: ys[k], duration: 0.28, ease: "power1.inOut" }, up + j * 0.3).call(hit, [k], up + j * 0.3 + 0.26);
      tl.call(hit, [-1], up + last * 0.3 + 0.35)
        .from(sc.querySelector(".lyr__msg"), { y: 8, opacity: 0, duration: 0.4, ease: "power2.out" }, up + last * 0.3 + 0.3);
    },

    "rt-data": (sc, tl) => {
      const wins = [...sc.querySelectorAll(".tbl")];
      tl.from(wins, { y: 16, opacity: 0, duration: 0.6, stagger: 0.12, ease: "power3.out" }, 0.1);
      // Rows land like inserts, taking turns between the two tables
      wins.forEach((w, k) => w.querySelectorAll("tr:not(:first-child)").forEach((r, i) => {
        const at = 0.75 + k * 0.2 + i * 0.42;
        tl.from(r, { opacity: 0, duration: 0.3 }, at).from(r, { backgroundColor: "rgba(41, 151, 255, 0.28)", duration: 0.9, ease: "power1.out" }, at);
      }));
    },
    "rt-query": (sc, tl) => {
      rise(tl, sc.querySelector(".sq__code"));
      let at = 0.5;
      // Typed out a character at a time
      sc.querySelectorAll(".sq__code .ln").forEach((ln) => {
        const n = ln.textContent.length, d = n * 0.04;
        tl.fromTo(ln, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: d, ease: `steps(${n})` }, at);
        at += d + 0.12;
      });
      drawIn(tl, sc.querySelector(".sq__arrow path"), at + 0.05, 0.4);
      tl.from(sc.querySelector(".sq__out"), { scale: 0.85, opacity: 0, duration: 0.45, ease: "back.out(1.8)" }, at + 0.3);
      countUp(sc.querySelector(".sq__out b"), tl, at + 0.3, 0.9);
    },
    "rt-dash": (sc, tl) => {
      rise(tl, sc.querySelector(".mini"));
      tl.from(sc.querySelectorAll(".mini__kpis div"), { y: 10, opacity: 0, duration: 0.45, stagger: 0.1, ease: "power2.out" }, 0.45)
        .from(sc.querySelectorAll(".mini__chart i"), { scaleY: 0, duration: 0.8, stagger: 0.07, ease: "power3.out" }, 1);
      sc.querySelectorAll(".mini__kpis b").forEach((b, i) => countUp(b, tl, 0.55 + i * 0.1, 1.3));
    },
    "rt-auto": (sc, tl) => {
      const nodes = [...sc.querySelectorAll(".wf__flow li")];
      tl.from(nodes, { y: 12, opacity: 0, duration: 0.45, stagger: 0.15, ease: "power2.out" }, 0.1);
      nodes.forEach((n, i) => tl.call(() => n.classList.add("is-hit"), null, 0.85 + i * 0.4).call(() => n.classList.remove("is-hit"), null, 1.3 + i * 0.4));
      tl.from(sc.querySelectorAll(".wf__sent li"), { x: 24, opacity: 0, duration: 0.45, stagger: 0.25, ease: "power3.out" }, 2.2);
    },
  };

  const LABEL = { idle: "Pause", playing: "Pause", paused: "Play", ended: "Play again" };
  const players = [], resets = new Map();

  reels.forEach((reel) => {
    const scenes = [...reel.querySelectorAll(".scene")];
    const chs = [...reel.querySelectorAll(".reel__ch")];
    const fills = chs.map((c) => c.querySelector("b"));
    const playBtn = reel.querySelector(".reel__play");
    let built = false;
    const build = () => {
      if (built) return;
      built = true;
      scenes.forEach((sc) => safe(`reel ${sc.dataset.scene}`, () => BUILD[sc.dataset.scene] && BUILD[sc.dataset.scene](sc)));
    };
    scenes.forEach((sc, i) => {
      sc.setAttribute("role", "group");
      sc.setAttribute("aria-roledescription", "scene");
      sc.setAttribute("aria-label", `${i + 1} of ${scenes.length}: ${chs[i] ? chs[i].textContent.trim() : ""}`);
    });

    if (!LIVE || !("IntersectionObserver" in window)) {
      reel.classList.add("is-static");
      whenIdle(build);
      watch(reel, build, null, 0);
      return;
    }
    reel.classList.add("is-live");
    // Drawing the tiles takes a moment, so it happens while the browser is idle rather than as the dialog opens
    whenIdle(build, 6000);

    let idx = 0, tl = null, bar = null, state = "idle", started = false, userPaused = false, autoPaused = false;
    const setState = (s) => {
      state = s;
      playBtn.dataset.state = s === "idle" ? "playing" : s;
      playBtn.setAttribute("aria-label", LABEL[s]);
    };
    // Finish the running scene at once, so its pieces rest in the finished picture
    const settle = () => {
      if (tl) { tl.progress(1).kill(); tl = null; }
      if (bar) { bar.kill(); bar = null; }
    };
    const show = (i, delay = 0) => {
      settle();
      idx = i;
      const sc = scenes[i];
      scenes.forEach((s) => {
        if (s === sc || !s.classList.contains("is-on")) return;
        G.to(s, { opacity: 0, x: -24, duration: 0.3, ease: "power2.in", overwrite: true, onComplete: () => { s.classList.remove("is-on"); G.set(s, { clearProps: "opacity,transform" }); } });
      });
      sc.classList.add("is-on");
      chs.forEach((c, k) => (k === i ? c.setAttribute("aria-current", "step") : c.removeAttribute("aria-current")));
      fills.forEach((f, k) => G.set(f, { scaleX: k < i ? 1 : 0 }));
      tl = G.timeline({ delay, paused: state !== "playing" });
      tl.fromTo(sc, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out", overwrite: true }, 0);
      safe(`reel ${sc.dataset.scene}`, () => PLAY[sc.dataset.scene] && PLAY[sc.dataset.scene](sc, tl));
      bar = G.fromTo(fills[i], { scaleX: 0 }, {
        scaleX: 1, duration: SCENE, delay, ease: "none", paused: state !== "playing",
        onComplete: () => (i < scenes.length - 1 ? show(i + 1) : setState("ended")),
      });
    };
    const go = (k) => {
      userPaused = autoPaused = false;
      if (k >= scenes.length) { settle(); setState("ended"); return; }
      setState("playing");
      show(Math.max(0, k));
    };
    const pause = () => {
      if (state !== "playing") return false;
      setState("paused");
      if (tl) tl.pause();
      if (bar) bar.pause();
      return true;
    };
    const resume = () => {
      if (state === "ended") { go(0); return; }
      setState("playing");
      if (!tl) { show(idx); return; }
      tl.play();
      if (bar) bar.play();
    };
    const reset = () => {
      settle();
      idx = 0;
      started = userPaused = autoPaused = false;
      setState("idle");
      scenes.forEach((s, k) => { G.killTweensOf(s); G.set(s, { clearProps: "opacity,transform" }); s.classList.toggle("is-on", k === 0); });
      fills.forEach((f) => G.set(f, { scaleX: 0 }));
      chs.forEach((c) => c.removeAttribute("aria-current"));
    };

    playBtn.addEventListener("click", () => {
      if (state === "playing") { userPaused = true; pause(); }
      else { userPaused = false; resume(); }
    });
    chs.forEach((c, k) => c.addEventListener("click", () => go(k)));
    // A click on the picture skips ahead, the way stories do
    reel.querySelector(".reel__stage").addEventListener("click", () => go(state === "ended" ? 0 : idx + 1));
    reel.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      go(e.key === "ArrowRight" ? idx + 1 : idx - 1);
    });

    // Plays once its dialog opens and pauses while mostly scrolled out of view.
    // The ratio matters, not just "intersecting": a sliver left at the top of the dialog counts as out of view.
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.2) {
        if (reel.closest(".case-store")) return;
        build();
        if (!started) { started = true; setState("playing"); show(0, 0.5); }
        else if (autoPaused && !userPaused) { autoPaused = false; resume(); }
      } else if (started && pause()) autoPaused = true;
    }, { threshold: [0, 0.2] }).observe(reel);
    resets.set(reel, reset);

    let hiddenPaused = false;
    players.push((hidden) => {
      if (hidden) hiddenPaused = pause();
      else if (hiddenPaused) { hiddenPaused = false; if (!userPaused) resume(); }
    });
  });

  // Nothing plays in a background tab, and nothing jumps ahead on return
  document.addEventListener("visibilitychange", () => players.forEach((p) => p(document.hidden)));
  // A closed case study goes back to the store, and its reel starts from the top next time it opens
  const store = document.querySelector(".case-store");
  if (store && resets.size) {
    new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.querySelectorAll) n.querySelectorAll("[data-reel]").forEach((r) => resets.has(r) && resets.get(r)());
    }))).observe(store, { childList: true });
  }
});

/* ---------- How they work 1: exploded view of the school system ---------- */

safe("exploded", () => {
  if (!MOTION || !G) return;
  const stage = $("#xs"), tilt = $("#xs-tilt"), scene = $("#xs-scene"), packet = $("#xs-packet");
  const layers = [...scene.querySelectorAll(".xs__layer")]; // 0 is MySQL at the bottom, 3 is the screen on top
  const legend = [...document.querySelectorAll("#xs-legend li")]; // listed top to bottom
  const gap = () => (innerWidth < 640 ? 48 : Math.min(144, innerHeight * 0.14));
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
  const aug = $("#aug");
  const filters = ["hue-rotate(-14deg) saturate(1.35)", "brightness(1.18)", "contrast(1.3)", "saturate(0.65) brightness(0.92)"];
  // The four augmented copies take their place now and are painted with the tile
  const copies = filters.map((f) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    c.style.filter = `${f} contrast(1.3) saturate(1.2)`;
    c.setAttribute("aria-hidden", "true");
    aug.append(c);
    return c;
  });
  // Drawing the tile takes a moment, so it happens while the browser is idle, or as soon as the story comes near
  let painted = false;
  const paintTiles = () => {
    if (painted) return;
    painted = true;
    drawTissue(raw, true);
    drawTissue(clean, false);
    copies.forEach((c, i) => {
      const x = c.getContext("2d");
      x.translate(128, 128);
      x.rotate((i * Math.PI) / 2);
      if (i % 2) x.scale(-1, 1);
      x.drawImage(clean, -128, -128, 256, 256);
    });
  };
  whenIdle(paintTiles, 4000);
  watch($("#story"), paintTiles, null, 0);
  const steps = [...document.querySelectorAll("#story-steps li")];
  const setStep = (k) => {
    steps.forEach((li, i) => { li.classList.toggle("on", i === k); li.classList.toggle("done", i < k); });
    $("#tsize").textContent = k >= 1 ? "224 × 224" : "512 × 512";
  };
  if (!MOTION || !G) { setStep(5); return; }

  $("#story").classList.add("is-pinned");
  const img = $("#c-img"), acc = $("#c-acc");
  // The numbers are read off the timeline's own clock, so they always match the step on screen,
  // including just before the story starts (images grow from 4 to 5, accuracy counts up from 5.1 to 5.9)
  const accEase = G.parseEase("power1.out");
  const paint = (t) => {
    img.textContent = fmt(10616 + (53080 - 10616) * Math.min(1, Math.max(0, t - 4)));
    const k = (t - 5.1) / 0.8;
    acc.textContent = k < 0 ? "–" : `${(96.07 + (99.83 - 96.07) * accEase(Math.min(1, k))).toFixed(2)}%`;
  };
  const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const tl = G.timeline({
    defaults: { ease: "power2.inOut" },
    onUpdate: () => { setStep(Math.min(5, Math.floor(tl.time()))); paint(tl.time()); },
    scrollTrigger: { trigger: "#story", start: () => `top ${barH()}`, end: "+=260%", pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
  tl.to("#tframe", { scale: 0.72, duration: 0.8 }, 1)
    .to(clean, { opacity: 1, duration: 0.8 }, 2)
    .to("#tframe", { filter: "contrast(1.3) saturate(1.2) brightness(1.03)", duration: 0.8 }, 3)
    .to(copies, {
      opacity: 1, scale: 0.44, duration: 1,
      xPercent: (i) => offsets[i][0] * 52, yPercent: (i) => offsets[i][1] * 52, rotation: (i) => offsets[i][0] * offsets[i][1] * 4,
    }, 4)
    // Holds the accuracy count-up's place on the clock, then a short rest at the end
    .to({}, { duration: 0.8 }, 5.1)
    .to({}, { duration: 0.35 });
  paint(0);
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
  const y = { v: 2026 };
  const countTo = (i) => {
    label.textContent = ROLES[i][1];
    G.to(y, { v: ROLES[i][0], duration: 0.6, ease: "power2.out", overwrite: true, onUpdate: () => (year.textContent = Math.round(y.v)) });
  };

  // Tall wide screens: the section holds still while the roles slide in one by one and the year counts back.
  // The current role is already in place when the section arrives, so a jump from the menu never lands on an empty list,
  // and earlier roles only dim a little while the next one comes in.
  mm.add("(min-width: 56rem) and (min-height: 800px)", () => {
    wrap.classList.add("has-year", "is-pinned");
    year.textContent = "2026";
    label.textContent = ROLES[0][1];
    const steps = items.length - 1;
    const tl = G.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: { trigger: wrap, start: () => `top ${barH()}`, end: "+=200%", pin: true, scrub: 0.6, invalidateOnRefresh: true, refreshPriority: 1 },
    });
    // When the roles are taller than the window, the list drifts up as they arrive, so the newest stays in view
    const over = () => Math.max(0, list.offsetHeight - wrap.clientHeight + 24) / 2;
    tl.set(items.slice(1), { x: 60, opacity: 0 }, 0)
      .fromTo(list, { y: over }, { y: () => -over(), ease: "none", duration: steps + 0.4, immediateRender: false }, 0)
      .to({}, { duration: 0.2, onUpdate() { light((0.6 * this.progress()) / items.length); } }, 0);
    items.forEach((li, i) => {
      if (!i) return;
      const at = i - 0.8;
      tl.to(li, { x: 0, opacity: 1, duration: 0.6 }, at)
        .to(y, { v: ROLES[i][0], duration: 0.6, ease: "none", onUpdate: () => (year.textContent = Math.round(y.v)), onStart: () => (label.textContent = ROLES[i][1]), onReverseComplete: () => (label.textContent = ROLES[i - 1][1]) }, at)
        .to({}, { duration: 0.6, onUpdate() { light((i + 0.6 * this.progress()) / items.length); } }, at)
        .to(items.slice(0, i), { opacity: 0.7, duration: 0.4 }, at);
    });
    tl.to(items, { opacity: 1, duration: 0.4 }, steps).to({}, { duration: 0.3 });
    return () => { wrap.classList.remove("has-year", "is-pinned"); G.set(items, { clearProps: "transform,opacity" }); G.set(list, { clearProps: "transform" }); };
  });

  // Wide screens too short to hold the section: the year stays beside the roles and counts back as each one reaches the middle
  mm.add("(min-width: 56rem) and (max-height: 799.98px)", () => {
    wrap.classList.add("has-year");
    const triggers = items.map((li, i) => ScrollTrigger.create({ trigger: li, start: "top 55%", onEnter: () => countTo(i), onLeaveBack: () => countTo(Math.max(0, i - 1)) }));
    return () => { wrap.classList.remove("has-year"); triggers.forEach((t) => t.kill()); };
  });

  // Wherever the section does not hold still: the line fills to just past the middle of the window, and each role slides in
  // as it rises into view, fully readable by the time it reaches the lower third.
  mm.add("not all and (min-width: 56rem) and (min-height: 800px)", () => {
    const fill = ScrollTrigger.create({ trigger: list, start: "top 60%", end: "bottom 60%", onUpdate: (self) => light(self.progress), onRefresh: (self) => light(self.progress) });
    // Phones have no room beside the cards, so there they rise into place instead of sliding in from the right
    const narrow = () => innerWidth < 640;
    const arrive = items.map((li) => G.fromTo(li, { x: () => (narrow() ? 0 : 32), y: () => (narrow() ? 24 : 0), opacity: 0.3 }, { x: 0, y: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: li, start: "top 96%", end: "top 66%", scrub: 0.5, invalidateOnRefresh: true } }));
    return () => {
      fill.kill();
      arrive.forEach((t) => { t.scrollTrigger.kill(); t.kill(); });
      G.set(items, { clearProps: "transform,opacity" });
    };
  });
});

/* ---------- Final measure once fonts and images settle ---------- */

if (G) {
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh());
}

// After a switch between Quick view and the full page, go back to the section the reader was on.
window.addEventListener("load", () => {
  let id = null;
  try {
    id = sessionStorage.getItem("view-return");
    sessionStorage.removeItem("view-return");
  } catch (e) {}
  const el = id && document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - barH(), behavior: "instant" });
});
})();
