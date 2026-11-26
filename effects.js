// Visual effects: hero intro, live candle chart, parallax layers, scroll reveals, card tilt.
(() => {
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE_POINTER = window.matchMedia("(pointer: fine)").matches;
  const TILT_MAX_DEG = 6;
  const COUNT_MS = 1600;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Hero headline: wrap each word so it can rise in ---------- */
  function wrapWord(text, wrapper) {
    const outer = document.createElement("span");
    outer.className = "w";
    const inner = document.createElement("span");
    if (wrapper) {
      const el = document.createElement(wrapper);
      el.textContent = text;
      inner.appendChild(el);
    } else {
      inner.textContent = text;
    }
    outer.appendChild(inner);
    return outer;
  }

  function splitHeadline(h1) {
    const parts = [];
    h1.childNodes.forEach((node) => {
      const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : null;
      node.textContent.split(/(\s+)/).forEach((chunk) => {
        if (!chunk) return;
        parts.push(/^\s+$/.test(chunk) ? document.createTextNode(" ") : wrapWord(chunk, tag));
      });
    });
    h1.replaceChildren(...parts);
    $$(".w > span", h1).forEach((s, i) => { s.style.transitionDelay = `${0.08 * i + 0.1}s`; });
  }

  /* ---------- Stats count-up ---------- */
  function countUp(el) {
    const target = Number(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    if (REDUCED || !Number.isFinite(target)) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Hero canvas: an endless, softly scrolling candlestick chart ---------- */
  function startCandles(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const SPACING = 16, BODY = 7, SPEED = 0.35;
    let w = 0, h = 0, dpr = 1, offset = 0, running = true;
    let price = 100;
    let candles = [];

    const nextCandle = () => {
      const open = price;
      const drift = (Math.random() - 0.48) * 2.4;
      const close = open + drift;
      const high = Math.max(open, close) + Math.random() * 1.4;
      const low = Math.min(open, close) - Math.random() * 1.4;
      price = close;
      return { open, close, high, low };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const needed = Math.ceil(w / SPACING) + 2;
      while (candles.length < needed) candles.push(nextCandle());
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      let lo = Infinity, hi = -Infinity;
      candles.forEach((c) => { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); });
      const pad = (hi - lo) * 0.25 || 1;
      const top = h * 0.18, bottom = h * 0.82;
      const y = (p) => bottom - ((p - (lo - pad)) / (hi - lo + 2 * pad)) * (bottom - top);

      // Moving-average glow line
      ctx.beginPath();
      let avg = candles[0].close;
      candles.forEach((c, i) => {
        avg = avg * 0.85 + c.close * 0.15;
        const x = i * SPACING - offset;
        i === 0 ? ctx.moveTo(x, y(avg)) : ctx.lineTo(x, y(avg));
      });
      ctx.strokeStyle = "rgba(90,255,212,.35)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(90,255,212,.6)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      candles.forEach((c, i) => {
        const x = i * SPACING - offset;
        const fade = Math.min(1, x / (w * 0.35));
        const up = c.close >= c.open;
        ctx.globalAlpha = Math.max(0, fade);
        ctx.strokeStyle = ctx.fillStyle = up ? "rgba(212,255,90,.55)" : "rgba(236,235,230,.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + BODY / 2, y(c.high));
        ctx.lineTo(x + BODY / 2, y(c.low));
        ctx.stroke();
        const yo = y(c.open), yc = y(c.close);
        ctx.fillRect(x, Math.min(yo, yc), BODY, Math.max(1.5, Math.abs(yc - yo)));
      });
      ctx.globalAlpha = 1;

      // Live price dot on the last candle
      const last = candles[candles.length - 1];
      const lx = (candles.length - 1) * SPACING - offset + BODY / 2;
      ctx.beginPath();
      ctx.arc(lx, y(last.close), 3, 0, Math.PI * 2);
      ctx.fillStyle = "#d4ff5a";
      ctx.shadowColor = "#d4ff5a";
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const loop = () => {
      if (running) {
        offset += SPEED;
        if (offset >= SPACING) { offset -= SPACING; candles.shift(); candles.push(nextCandle()); }
        draw();
      }
      requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    if (REDUCED) { draw(); return; }
    new IntersectionObserver(([e]) => { running = e.isIntersecting && !document.hidden; }).observe(canvas);
    document.addEventListener("visibilitychange", () => { running = !document.hidden; });
    requestAnimationFrame(loop);
  }

  /* ---------- Scroll reveals ---------- */
  function setupReveals() {
    const groups = [
      [".stats-title"], [".stats .stat", 0.12], [".section-head"], [".featured"], [".grid .card", 0.08], [".skills > div", 0.06],
      [".process .step", 0.12], [".contact h2"], [".contact p"], [".contact .ctas"],
    ];
    groups.forEach(([sel, stagger = 0]) => {
      $$(sel).forEach((el, i) => {
        el.classList.add("reveal");
        if (stagger) el.style.setProperty("--d", `${(i % 4) * stagger}s`);
      });
    });
    $$(".arch .node").forEach((n, i) => n.style.setProperty("--d", `${0.07 * i}s`));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        $$("b[data-count]", e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    $$(".reveal, .arch").forEach((el) => io.observe(el));
  }

  /* ---------- Pointer effects: spotlight + tilt on cards, glow on featured visuals ---------- */
  function setupPointer() {
    $$(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
        if (FINE_POINTER && !REDUCED) {
          card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * TILT_MAX_DEG}deg) rotateY(${(px - 0.5) * TILT_MAX_DEG}deg) translateY(-4px)`;
        }
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
    $$(".featured .visual").forEach((v) => {
      v.addEventListener("pointermove", (e) => {
        const r = v.getBoundingClientRect();
        v.style.setProperty("--gx", `${e.clientX - r.left}px`);
        v.style.setProperty("--gy", `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Parallax engine: one rAF loop, eased toward targets ---------- */
  function setupParallax() {
    const progress = $(".progress");
    const hero = $(".hero");
    const heroContent = $(".hero-content");
    const layers = $$("[data-speed]");
    const phones = $$(".phones img");
    const phoneSpeeds = [0.08, -0.06, 0.12];
    const shots = $$(".shot img");
    const statement = $(".statement");
    const lines = $$(".statement .line");
    let mouseX = 0, mouseY = 0, easedMX = 0, easedMY = 0;

    if (FINE_POINTER) {
      window.addEventListener("pointermove", (e) => {
        mouseX = e.clientX / window.innerWidth - 0.5;
        mouseY = e.clientY / window.innerHeight - 0.5;
      });
    }

    const centerOffset = (el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 - window.innerHeight / 2;
    };

    const frame = () => {
      const sy = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.transform = `scaleX(${maxScroll > 0 ? sy / maxScroll : 0})`;

      easedMX += (mouseX - easedMX) * 0.06;
      easedMY += (mouseY - easedMY) * 0.06;

      layers.forEach((el) => {
        const speed = Number(el.dataset.speed) || 0;
        const depth = Number(el.dataset.mouse) || 0;
        el.style.transform = `translate3d(${easedMX * depth}px, ${sy * speed + easedMY * depth}px, 0)`;
      });

      if (hero && heroContent) {
        const t = Math.min(1, sy / hero.offsetHeight);
        heroContent.style.opacity = String(1 - t * 1.1);
      }

      phones.forEach((img, i) => {
        img.style.transform = `translate3d(0, ${centerOffset(img.parentElement) * -phoneSpeeds[i]}px, 0)`;
      });

      shots.forEach((img) => {
        const frame = img.parentElement;
        const travel = Math.max(0, img.offsetHeight - frame.offsetHeight);
        const t = Math.max(-1, Math.min(1, centerOffset(frame) / window.innerHeight));
        img.style.transform = `translate3d(0, ${-((1 - t) / 2) * travel}px, 0)`;
      });

      if (statement && lines.length) {
        const r = statement.getBoundingClientRect();
        const t = (window.innerHeight - r.top) / (window.innerHeight + r.height);
        lines.forEach((line, i) => {
          const dir = i % 2 === 0 ? -1 : 1;
          line.style.transform = `translate3d(${dir * (t - 0.5) * 40 - (dir > 0 ? 20 : 0)}%, 0, 0)`;
        });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- Boot ---------- */
  const hero = $(".hero");
  const h1 = $(".hero h1");
  if (h1) splitHeadline(h1);
  const canvas = $(".hero-canvas");
  if (canvas) startCandles(canvas);

  let started = false;
  const startIntro = () => {
    if (started) return;
    started = true;
    hero && hero.classList.add("ready");
  };
  requestAnimationFrame(startIntro);
  setTimeout(startIntro, 300); // fallback when rAF is throttled (background tabs)

  setupReveals();
  setupPointer();
  if (!REDUCED) setupParallax();
})();
