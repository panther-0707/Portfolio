/* Scroll-driven server: shakes as you scroll, drains its UPS battery, powers off at the bottom.
   Scrolling back up recharges it. Needs three.js (r128) loaded first. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var wrap = document.getElementById("rig-wrap");
  var cv = document.getElementById("rig");
  var fillEl = document.getElementById("bat-fill");
  var pctEl = document.getElementById("bat-pct");
  var stEl = document.getElementById("bat-state");
  var barEl = document.getElementById("bat-bar");
  var btn = document.getElementById("reboot");
  var logEl = document.getElementById("log");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- battery model (HUD works even without WebGL) ---------- */
  var STATE_TXT = { ok: "RUNNING", warn: "LOW BATTERY", crit: "CRITICAL: SAVING STATE", off: "HALTED: POWER OFF" };
  var COL = { ok: 0x7ee787, warn: 0xffb454, crit: 0xff5d5d, off: 0x000000 };
  var LOG = [
    [100, "ok", "[  ok  ] eufs-rack-01 booted, mains connected"],
    [90, "ok", "[  ok  ] ups: running on battery"],
    [80, "ok", "[  ok  ] docker: 6 containers healthy"],
    [70, "warn", "[ warn ] chassis: vibration detected"],
    [60, "ok", "[  ok  ] raid: array resync complete"],
    [50, "warn", "[ warn ] fan2: rpm below threshold"],
    [40, "warn", "[ warn ] thermal: cpu throttling"],
    [30, "warn", "[ warn ] ups: battery low"],
    [20, "crit", "[ crit ] ups: 20% remaining"],
    [10, "crit", "[ crit ] saving state to disk"],
    [5, "crit", "[ crit ] stopping services..."],
    [0, "off", "[ off  ] system halted. power off."]
  ];

  var target = 0, battery = 1, pct = 100, state = "ok", logCount = -1;
  var onUpdate = null;

  function stateOf(p) { return p > 30 ? "ok" : p > 10 ? "warn" : p > 0 ? "crit" : "off"; }

  function renderLog() {
    var n = 0;
    while (n < LOG.length && pct <= LOG[n][0]) n++;
    if (n === logCount || !logEl) return;
    logCount = n;
    logEl.textContent = "";
    LOG.slice(Math.max(0, n - 6), n).forEach(function (e) {
      var d = document.createElement("div");
      d.className = e[1];
      d.textContent = e[2];
      logEl.appendChild(d);
    });
  }

  function readScroll() {
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    target = Math.min(1, Math.max(0, window.scrollY / max));
    battery = Math.max(0, 1 - target / 0.97);
    pct = battery > 0 ? Math.max(1, Math.round(battery * 100)) : 0;
    pctEl.textContent = pct + "%";
    fillEl.style.width = pct + "%";
    barEl.setAttribute("aria-valuenow", String(pct));
    var s = stateOf(pct);
    if (s !== state) {
      state = s;
      stage.setAttribute("data-state", s);
      stEl.textContent = STATE_TXT[s];
      btn.hidden = s !== "off";
    }
    renderLog();
    if (onUpdate) onUpdate();
  }
  window.rackBattery = function () { return pct; };
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", readScroll);
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
  readScroll();

  /* ---------- 3D scene ---------- */
  if (!window.THREE) return;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  var rig = new THREE.Group();
  scene.add(rig);

  var metal = new THREE.MeshStandardMaterial({ color: 0x2b343e, metalness: 0.7, roughness: 0.4 });
  var metalLt = new THREE.MeshStandardMaterial({ color: 0x7d8a97, metalness: 0.8, roughness: 0.35 });
  var dark = new THREE.MeshStandardMaterial({ color: 0x10151a, metalness: 0.3, roughness: 0.7 });
  var board = new THREE.MeshStandardMaterial({ color: 0x0d3a2e, metalness: 0.2, roughness: 0.8 });
  var ramMat = new THREE.MeshStandardMaterial({ color: 0x1b5a8a, metalness: 0.3, roughness: 0.6 });

  function B(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function add(geo, mat, x, y, z, parent) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    (parent || rig).add(m);
    return m;
  }

  var W = 5.6, H = 1.1, D = 3.8;
  var zF = D / 2 + 0.08;

  // chassis (open top so you can see inside)
  add(B(W, 0.06, D), metal, 0, -H / 2, 0);
  add(B(0.06, H, D), metal, -W / 2, 0, 0);
  add(B(0.06, H, D), metal, W / 2, 0, 0);
  add(B(W, H, 0.06), metal, 0, 0, -D / 2);
  add(B(W, H, 0.12), metal, 0, 0, D / 2);
  [-1, 1].forEach(function (s) { add(B(0.3, H, 0.06), metalLt, s * (W / 2 + 0.15), 0, D / 2 + 0.03); });

  // motherboard, CPU heatsinks, RAM banks, PSU
  add(B(W - 0.3, 0.04, D - 0.4), board, 0, -H / 2 + 0.05, 0.1);
  [-0.95, 0.95].forEach(function (sx) {
    add(B(1.0, 0.1, 1.0), metalLt, sx, -0.43, 0);
    for (var i = 0; i < 10; i++) add(B(0.05, 0.3, 0.9), metalLt, sx - 0.45 + i * 0.1, -0.23, 0);
    for (var j = 0; j < 4; j++) add(B(0.9, 0.32, 0.05), ramMat, sx, -0.32, -1.0 - j * 0.16);
  });
  add(B(1.3, 0.8, 0.9), dark, 2.0, -0.1, -1.4);

  // LEDs (driven by the battery state)
  var ledGeo = new THREE.BoxGeometry(0.07, 0.07, 0.03);
  var leds = [];
  function led(x, y, z, kind, rate, parent) {
    var m = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    m.position.set(x, y, z);
    (parent || rig).add(m);
    leds.push({ m: m, kind: kind, rate: rate, ph: Math.random() * 6.28 });
  }

  // front bezel: 10 drive bays
  [0.25, -0.25].forEach(function (y) {
    for (var c = 0; c < 5; c++) {
      var x = -1.05 + c * 0.86;
      add(B(0.74, 0.38, 0.05), dark, x, y, zF);
      add(B(0.5, 0.05, 0.03), metalLt, x - 0.05, y - 0.1, zF + 0.035);
      led(x + 0.28, y + 0.12, zF + 0.04, "drive", 6 + Math.random() * 14);
    }
  });

  // controls: LCD, power button, status LEDs
  add(B(1.15, 0.5, 0.04), dark, -2.2, -0.2, zF);
  var lcdC = document.createElement("canvas");
  lcdC.width = 256; lcdC.height = 100;
  var lcdX = lcdC.getContext("2d");
  var lcdTex = new THREE.CanvasTexture(lcdC);
  var lcd = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.41), new THREE.MeshBasicMaterial({ map: lcdTex }));
  lcd.position.set(-2.2, -0.2, zF + 0.03);
  rig.add(lcd);
  var pwrBtn = add(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 24), metalLt, -2.45, 0.28, zF + 0.03);
  pwrBtn.rotation.x = Math.PI / 2;
  var ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 8, 28), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  ring.position.set(-2.45, 0.28, zF + 0.05);
  rig.add(ring);
  led(-1.95, 0.28, zF + 0.04, "static", 0);
  led(-1.75, 0.28, zF + 0.04, "drive", 4);
  led(2.0, 0.32, -1.4, "static", 0); // PSU

  // fans
  var fans = [];
  [-1.8, 0, 1.8].forEach(function (fx) {
    var g = new THREE.Group();
    g.position.set(fx, -0.2, 1.05);
    rig.add(g);
    add(B(1.1, 0.5, 0.06), dark, 0, 0, -0.52, g);
    add(B(1.1, 0.5, 0.06), dark, 0, 0, 0.52, g);
    add(B(0.06, 0.5, 1.1), dark, -0.52, 0, 0, g);
    add(B(0.06, 0.5, 1.1), dark, 0.52, 0, 0, g);
    var rot = new THREE.Group();
    rot.position.y = 0.06;
    g.add(rot);
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), metalLt, 0, 0, 0, rot);
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2;
      var bg = new THREE.Group();
      bg.rotation.y = -a;
      var blade = add(B(0.34, 0.015, 0.15), metalLt, 0.3, 0, 0, bg);
      blade.rotation.x = 0.5;
      rot.add(bg);
    }
    rot.rotation.y = Math.random() * 6.28;
    fans.push(rot);
  });

  // floor grid
  var grid = new THREE.GridHelper(26, 26, 0x1d2832, 0x121920);
  grid.position.y = -H / 2 - 0.05;
  scene.add(grid);

  // lights
  var amb = new THREE.AmbientLight(0x6f8fb0, 0.6);
  var key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(3, 6, 5);
  var glow = new THREE.PointLight(0x7ee787, 1.6, 10);
  glow.position.set(0, 1.3, 0.8);
  scene.add(amb, key, glow);

  rig.rotation.y = -0.45;

  /* ---------- LCD ---------- */
  var lcdKey = "";
  function drawLcd() {
    var k = state + pct;
    if (k === lcdKey) return;
    lcdKey = k;
    var c = lcdX, col = state === "ok" ? "#7ee787" : state === "warn" ? "#ffb454" : "#ff5d5d";
    c.fillStyle = "#03100a";
    c.fillRect(0, 0, 256, 100);
    if (state !== "off") {
      c.fillStyle = col;
      c.font = "bold 40px monospace";
      c.fillText("UPS " + pct + "%", 14, 44);
      c.strokeStyle = col;
      c.strokeRect(14, 58, 228, 16);
      c.fillRect(16, 60, Math.round(224 * pct / 100), 12);
      c.font = "16px monospace";
      c.fillText(state === "ok" ? "RUNNING" : state === "warn" ? "LOW BATTERY" : "SAVING STATE", 14, 94);
    }
    lcdTex.needsUpdate = true;
  }

  /* ---------- sizing ---------- */
  function size() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    var t = Math.tan((35 / 2) * Math.PI / 180);
    var d = Math.max(3.9 / (t * cam.aspect), 2.3 / t) * 1.08;
    cam.position.set(0, d * 0.45, d * 0.89);
    cam.lookAt(0, -0.1, 0);
    if (onUpdate) onUpdate();
  }
  if (window.ResizeObserver) new ResizeObserver(size).observe(wrap);
  else window.addEventListener("resize", size);

  /* ---------- animation ---------- */
  var pw = 1, vel = 0, lastY = window.scrollY, t0 = performance.now(), last = t0;
  var tmp = new THREE.Color();

  function step(t, dt, still) {
    var tp = battery > 0 ? 0.35 + 0.65 * battery : 0;
    pw = still ? tp : pw + (tp - pw) * Math.min(1, dt * (tp === 0 ? 2.2 : 6));

    // gentle 2 Hz dim pulse when critical (no rapid flashing)
    var fl = !still && pct > 0 && pct <= 15 ? 0.7 + 0.3 * Math.sin(t * 13) : 1;
    var L = Math.min(1, pw * 1.3) * fl;

    amb.intensity = 0.1 + 0.5 * L;
    key.intensity = 0.2 + 0.7 * L;
    glow.intensity = 1.6 * L;
    glow.color.setHex(state === "off" ? 0x5ccfe6 : COL[state]);

    // shake
    var amp = still ? 0 : (0.012 + vel * 0.1 + (1 - battery) * 0.03) * Math.min(1, pw * 4);
    var s = function (f, p) { return Math.sin(t * f + p); };
    rig.position.x = amp * (s(47, 0) + 0.6 * s(71, 2));
    rig.position.y = amp * 0.8 * (s(53, 1) + 0.5 * s(89, 3));
    rig.rotation.y = -0.45 + amp * 0.05 * s(31, 5);
    rig.rotation.z = amp * 0.08 * s(41, 4);

    // fans spin down with the battery
    var fv = pw * pw * 20;
    for (var i = 0; i < fans.length; i++) fans[i].rotation.y += fv * dt;

    // LEDs
    var ls = Math.max(0, Math.min(1, (pw - 0.04) / 0.5));
    var sc = COL[state];
    for (var j = 0; j < leds.length; j++) {
      var e = leds[j];
      var b = e.kind === "drive" ? (Math.sin(t * e.rate * (0.4 + 0.6 * pw) + e.ph) > -0.2 ? 1 : 0.12) : 1;
      e.m.material.color.setHex(sc === 0 ? 0x7ee787 : sc).multiplyScalar(b * ls);
    }
    ring.material.color.setHex(sc === 0 ? 0x7ee787 : sc).multiplyScalar(ls);

    drawLcd();
    renderer.render(scene, cam);
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var y = window.scrollY;
    vel += (Math.min(1, Math.abs(y - lastY) / 45) - vel) * 0.12;
    lastY = y;
    step((now - t0) / 1000, dt, false);
    requestAnimationFrame(frame);
  }

  size();
  if (reduce) {
    onUpdate = function () { step(0, 0, true); };
    onUpdate();
  } else {
    requestAnimationFrame(frame);
  }
})();