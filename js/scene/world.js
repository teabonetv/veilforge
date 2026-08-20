import * as THREE from "../vendor/three.module.js";
import { makeEntityModel, makeWanderer } from "./models.js";
import { CONTENT } from "../engine/state.js";

const SKILL_TINT = {
  timber: 0x3d6b3a, trawl: 0x1b4d6e, vein: 0x5a5348, ember: 0xb45309,
  hearth: 0x9a3412, anvil: 0x94a3b8, fletch: 0x3f6212, loom: 0x6d28d9,
  sigil: 0x1d4ed8, vial: 0x047857, course: 0x0f766e, whisper: 0x334155,
  soil: 0x365314, drove: 0x854d0e, chart: 0x312e81, might: 0x7f1d1d,
  guard: 0x1e3a5f, vitality: 0x9f1239, mark: 0x3f6212, weave: 0x4c1d95,
  vow: 0xf59e0b, bounty: 0x111827
};

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x05070f, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b1020, 0.038);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 90);
  const camHome = new THREE.Vector3(0, 4.05, 9.2);
  camera.position.copy(camHome);
  const look = new THREE.Vector3(0, 1.45, 0);
  camera.lookAt(look);

  const hemi = new THREE.HemisphereLight(0x9bb7ff, 0x1a1020, 0.62);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd6a0, 0.95);
  key.position.set(6, 10, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x7aa2ff, 7, 26);
  rim.position.set(-4, 3, -2);
  scene.add(rim);
  const gold = new THREE.PointLight(0xe0b15a, 4.2, 16);
  gold.position.set(2.4, 2.1, 2.6);
  scene.add(gold);
  const torchLight = new THREE.PointLight(0xff9a4a, 3.4, 12);
  torchLight.position.set(-2.4, 2.4, 3.2);
  scene.add(torchLight);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(36, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x0a1024, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 40),
    new THREE.MeshStandardMaterial({ color: 0x12182c, roughness: 0.94, metalness: 0.06 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.8, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a2238, roughness: 0.82, metalness: 0.18 })
  );
  dais.position.y = 0.05;
  scene.add(dais);

  const mats = makeMats();
  const citadel = buildCitadel(mats);
  scene.add(citadel);

  const torches = buildTorches(mats);
  scene.add(torches);

  const stars = new THREE.Points(
    starGeo(520),
    new THREE.PointsMaterial({ color: 0xdce7ff, size: 0.055, transparent: true, opacity: 0.88, depthWrite: false, fog: false })
  );
  scene.add(stars);
  const chartStars = new THREE.Points(
    starGeo(90, 0.35),
    new THREE.PointsMaterial({ color: 0xfff1c2, size: 0.09, transparent: true, opacity: 0, depthWrite: false, fog: false })
  );
  scene.add(chartStars);

  const aurora = buildAurora();
  scene.add(aurora);

  const dioramas = buildDioramas(mats);
  scene.add(dioramas.root);

  const player = makeFighter(0x8eb4ff, mats);
  player.group.position.set(-1.25, 0, 1.55);
  player.group.userData.stub = player.group.children.slice();
  scene.add(player.group);
  let enemy = makeFighter(0xff8aa0, mats);
  enemy.group.position.set(1.55, 0, 1.55);
  enemy.group.visible = false;
  scene.add(enemy.group);
  let enemyId = "";

  const hpBars = buildHpBars();
  scene.add(hpBars.root);

  function resize() {
    const box = canvas.getBoundingClientRect();
    const w = Math.max(64, Math.floor(box.width || canvas.clientWidth || canvas.parentElement?.clientWidth || 480));
    const h = Math.max(64, Math.floor(box.height || canvas.clientHeight || 160));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let t = 0;
  let shown = "";
  let pFlash = 0;
  let eFlash = 0;
  let lastPhp = -1;
  let lastMhp = -1;
  let wasFighting = false;
  let mMax = 1;
  const camPos = new THREE.Vector3();

  function frame(state, skill) {
    t += 0.016;
    const fighting = !!(state?.combat?.fighting);
    const reduced = !!(state?.settings?.reducedMotion);
    const keyId = fighting ? "arena" : (skill || "idle");
    if (keyId !== shown) {
      shown = keyId;
      dioramas.show(fighting ? "arena" : skill);
    }

    tintForSkill(skill, fighting, scene, gold, rim, hemi, floor);
    gold.intensity = skill === "anvil" || skill === "ember" || skill === "hearth" || skill === "vow"
      ? 5.4 + Math.sin(t * 7) * 1.8
      : 3.8 + Math.sin(t * 2.2) * 0.35;
    if (state?._fx > 0) {
      gold.intensity += state._fx * 6;
      rim.intensity = 7 + state._fx * 8;
      state._fx *= 0.82;
      if (state._fx < 0.04) state._fx = 0;
    }
    torchLight.intensity = 2.8 + Math.sin(t * 9.5) * 0.7 + Math.sin(t * 17) * 0.25;
    torchLight.position.y = 2.35 + Math.sin(t * 11) * 0.04;

    citadel.rotation.y = Math.sin(t * 0.11) * 0.035;
    stars.rotation.y = t * 0.012;
    chartStars.rotation.y = t * 0.018;
    chartStars.material.opacity = skill === "chart" && !fighting ? 0.95 : fighting ? 0.15 : 0.08;
    aurora.tick(t, skill);

    for (const flame of torches.userData.flames) {
      flame.scale.setScalar(0.85 + Math.sin(t * 8 + flame.userData.bob) * 0.18);
      flame.position.y = flame.userData.baseY + Math.sin(t * 10 + flame.userData.bob) * 0.05;
    }
    citadel.userData.flames.forEach((c) => {
      c.position.y = 4.55 + Math.sin(t * 3.2 + c.userData.bob) * 0.08;
      c.scale.setScalar(0.9 + Math.sin(t * 6 + c.userData.bob) * 0.12);
    });

    const drift = reduced ? 0 : 1;
    const fightPush = fighting ? 0.55 : 0;
    camPos.set(
      camHome.x + Math.sin(t * 0.17) * 0.42 * drift + (fighting ? 0.35 : 0),
      camHome.y + Math.sin(t * 0.13) * 0.12 * drift + fightPush * 0.15,
      camHome.z + Math.cos(t * 0.14) * 0.28 * drift - fightPush
    );
    camera.position.lerp(camPos, 0.08);
    look.set(fighting ? 0.15 : 0.05, 1.4 + Math.sin(t * 0.2) * 0.05 * drift, fighting ? 1.1 : 0.15);
    camera.lookAt(look);

    const php = state?.combat?.hp ?? 0;
    const pmax = Math.max(1, state?.combat?.maxHp || 10);
    const mhp = state?.combat?.monsterHp ?? 0;
    if (fighting) {
      if (!wasFighting) mMax = Math.max(1, mhp);
      mMax = Math.max(mMax, mhp, 1);
    } else {
      mMax = 1;
    }
    wasFighting = fighting;

    if (lastPhp >= 0 && php < lastPhp - 0.01) pFlash = 1;
    if (lastMhp >= 0 && fighting && mhp < lastMhp - 0.01) eFlash = 1;
    lastPhp = php;
    lastMhp = mhp;
    pFlash *= 0.82;
    eFlash *= 0.82;

    const mid = state?.combat?.monsterId || "";
    const eqKey = JSON.stringify(state?.equipment || {}) + JSON.stringify(state?.pets || {});
    if (eqKey !== player.group.userData.eq) {
      player.group.userData.eq = eqKey;
      const oldW = player.group.userData.wander;
      if (oldW) {
        player.group.remove(oldW);
        oldW.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
      }
      const w = makeWanderer(state.equipment, CONTENT.items, state.pets || {});
      w.scale.setScalar(0.82);
      player.group.add(w);
      player.group.userData.wander = w;
      (player.group.userData.stub || []).forEach((c) => { c.visible = false; });
    }
    if (fighting && mid && mid !== enemyId) {
      enemyId = mid;
      const mdl = CONTENT.monsters[mid]?.model || { kind: "beast-might", seed: 1, hue: 0 };
      const old = enemy.group.userData.persona;
      if (old) {
        enemy.group.remove(old);
        old.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
      }
      const g = makeEntityModel(mdl);
      g.position.set(0, 0.15, 0.12);
      g.scale.setScalar(0.95);
      enemy.group.children.forEach((c) => { if (c !== g) c.visible = false; });
      enemy.group.add(g);
      enemy.group.userData.persona = g;
    }
    if (!fighting) enemyId = "";

    enemy.group.visible = fighting;
    hpBars.root.visible = fighting;
    const idleBob = Math.sin(t * 2.1) * 0.015;
    player.group.position.y = idleBob;
    player.group.position.x = -1.25 + (fighting ? Math.sin(t * 7.2) * 0.07 : Math.sin(t * 0.8) * 0.03);
    player.group.position.z = fighting ? 1.7 : 1.45;
    player.group.rotation.y = fighting ? 0.55 : Math.sin(t * 0.4) * 0.12;
    if (fighting) {
      enemy.group.position.y = Math.sin(t * 2.4 + 1) * 0.015;
      enemy.group.position.x = 1.55 + Math.sin(t * 7.2 + 1.4) * 0.07;
      enemy.group.position.z = 1.7;
      enemy.group.rotation.y = -0.55;
      const lunge = Math.max(0, Math.sin(t * 5.2));
      player.group.position.x += lunge > 0.92 ? 0.12 : 0;
      enemy.group.position.x -= Math.max(0, Math.sin(t * 5.2 + 1.6)) > 0.92 ? 0.12 : 0;
    }

    const pRatio = THREE.MathUtils.clamp(php / pmax, 0.08, 1);
    const eRatio = fighting ? THREE.MathUtils.clamp(mhp / mMax, 0.06, 1) : 1;
    player.flash(pFlash);
    player.hpTint(pRatio);
    enemy.flash(eFlash);
    enemy.hpTint(eRatio);

    if (fighting) hpBars.set(player.group.position, enemy.group.position, pRatio, eRatio, camera);

    dioramas.tick(t, skill, fighting, gold);
    renderer.render(scene, camera);
  }

  return { frame, resize, scene };
}

function makeMats() {
  return {
    stone: new THREE.MeshStandardMaterial({ color: 0x2a3148, roughness: 0.82, metalness: 0.14 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x1c2236, roughness: 0.88, metalness: 0.1 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.7, emissive: 0x3a2a08, emissiveIntensity: 0.42 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.9, metalness: 0.05 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.7, metalness: 0.05, emissive: 0x0a2010, emissiveIntensity: 0.25 }),
    water: new THREE.MeshStandardMaterial({ color: 0x1a5a78, roughness: 0.18, metalness: 0.55, transparent: true, opacity: 0.72, emissive: 0x083040, emissiveIntensity: 0.35 }),
    ember: new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.4, metalness: 0.2, emissive: 0xff5510, emissiveIntensity: 1.4 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x8a93a8, roughness: 0.4, metalness: 0.75 }),
    sand: new THREE.MeshStandardMaterial({ color: 0x6b5a38, roughness: 0.92, metalness: 0.04 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.7, metalness: 0.08, emissive: 0x2a0a50, emissiveIntensity: 0.3 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.92 }),
    flameBlue: new THREE.MeshBasicMaterial({ color: 0x7aa2ff, transparent: true, opacity: 0.9 })
  };
}

function buildCitadel(mats) {
  const citadel = new THREE.Group();
  const keep = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 5.2), mats.stone);
  keep.position.y = 1.7;
  citadel.add(keep);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.2, 4), mats.gold);
  roof.position.y = 4.5;
  roof.rotation.y = Math.PI / 4;
  citadel.add(roof);
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 4.4, 8), mats.stone);
    const a = i * Math.PI / 2 + Math.PI / 4;
    tower.position.set(Math.cos(a) * 3.1, 2.2, Math.sin(a) * 3.1);
    citadel.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.55, 6), mats.gold);
    cap.position.set(tower.position.x, 4.55, tower.position.z);
    citadel.add(cap);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), i % 2 ? mats.flameBlue : mats.flame);
    flame.position.set(tower.position.x, 4.6, tower.position.z);
    flame.userData.bob = i;
    citadel.add(flame);
    flames.push(flame);
  }
  citadel.userData.flames = flames;
  citadel.position.set(-3.35, 0, -3.1);
  citadel.scale.setScalar(0.82);
  return citadel;
}

function buildTorches(mats) {
  const g = new THREE.Group();
  const flames = [];
  const spots = [[-3.4, 3.4], [3.5, 3.1], [-2.6, -0.4], [3.2, -0.2]];
  spots.forEach(([x, z], i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.7, 6), mats.bark);
    post.position.set(x, 0.85, z);
    g.add(post);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.12, 8), mats.iron);
    bowl.position.set(x, 1.72, z);
    g.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), i % 2 ? mats.flameBlue : mats.flame);
    flame.position.set(x, 2.02, z);
    flame.userData.bob = i * 1.7;
    flame.userData.baseY = 2.02;
    g.add(flame);
    flames.push(flame);
  });
  g.userData.flames = flames;
  return g;
}

function buildAurora() {
  const group = new THREE.Group();
  const shader = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(0x3ee0c0) },
      uB: { value: new THREE.Color(0x4f6dff) },
      uC: { value: new THREE.Color(0xc084fc) },
      uAmp: { value: 1 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uA;
      uniform vec3 uB;
      uniform vec3 uC;
      uniform float uAmp;
      void main() {
        float w = sin(vUv.x * 6.283 + uTime * 0.35) * 0.5 + 0.5;
        float band = sin((vUv.x * 4.0 + vUv.y * 2.0) + uTime * 0.55);
        vec3 col = mix(uA, uB, w);
        col = mix(col, uC, smoothstep(0.4, 1.0, band * 0.5 + 0.5));
        float fade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float n = sin(vUv.x * 18.0 + uTime) * sin(vUv.y * 11.0 - uTime * 0.7);
        float alpha = (0.16 + 0.1 * n) * fade * edge * uAmp;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(38, 11, 1, 1), shader);
  mesh.position.set(0, 8.2, -12);
  group.add(mesh);
  const mesh2 = mesh.clone();
  mesh2.material = shader.clone();
  mesh2.position.set(3, 7.2, -10.5);
  mesh2.rotation.z = 0.08;
  group.add(mesh2);
  group.tick = (t, skill) => {
    shader.uniforms.uTime.value = t;
    mesh2.material.uniforms.uTime.value = t + 2.2;
    const amp = skill === "chart" ? 1.35 : skill === "whisper" ? 0.7 : 1;
    shader.uniforms.uAmp.value = amp;
    mesh2.material.uniforms.uAmp.value = amp * 0.75;
    group.position.x = Math.sin(t * 0.14) * 1.6;
  };
  return group;
}

function starGeo(n, spread = 1) {
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 42 * spread;
    arr[i * 3 + 1] = 5.5 + Math.random() * 18;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 42 * spread - 4;
  }
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return g;
}

function tree(mats, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 0.9 * s, 5), mats.bark);
  trunk.position.y = 0.45 * s;
  g.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 1.15 * s, 6), mats.leaf);
  crown.position.y = 1.15 * s;
  g.add(crown);
  const crown2 = new THREE.Mesh(new THREE.ConeGeometry(0.4 * s, 0.8 * s, 6), mats.leaf);
  crown2.position.y = 1.65 * s;
  g.add(crown2);
  return g;
}

function buildDioramas(mats) {
  const root = new THREE.Group();
  const sets = {};

  const timber = new THREE.Group();
  const grove = [[1.8, 0.6], [2.6, 1.8], [3.4, 0.4], [0.6, 2.4], [4.0, 2.2], [-0.2, 0.5], [2.1, -0.6]];
  grove.forEach(([x, z], i) => {
    const tr = tree(mats, 0.75 + (i % 3) * 0.12);
    tr.position.set(x, 0, z);
    timber.add(tr);
  });
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 8), mats.bark);
  stump.position.set(1.2, 0.11, 1.1);
  timber.add(stump);
  sets.timber = timber;

  const trawl = new THREE.Group();
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), mats.water);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(2.1, 0.09, 1.4);
  trawl.add(pool);
  const pool2 = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), mats.water);
  pool2.rotation.x = -Math.PI / 2;
  pool2.position.set(2.4, 0.12, 1.55);
  trawl.add(pool2);
  pool2.userData.water = true;
  const dock = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.55), mats.bark);
  dock.position.set(0.7, 0.22, 1.5);
  trawl.add(dock);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), mats.bark);
  pole.position.set(0.2, 0.9, 1.55);
  pole.rotation.z = 0.45;
  trawl.add(pole);
  sets.trawl = trawl;

  const anvilSet = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 0.75), mats.stoneDark);
  block.position.set(2.15, 0.35, 1.7);
  anvilSet.add(block);
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.38, 0.62), mats.iron);
  anvil.position.set(2.15, 0.82, 1.7);
  anvilSet.add(anvil);
  const horn = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.28), mats.iron);
  horn.position.set(3.0, 0.86, 1.7);
  anvilSet.add(horn);
  const coals = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.7), mats.ember);
  coals.position.set(2.15, 0.18, 2.55);
  coals.userData.forge = true;
  anvilSet.add(coals);
  const bellows = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mats.bark);
  bellows.position.set(1.25, 0.32, 2.45);
  bellows.scale.set(1.4, 0.7, 1);
  anvilSet.add(bellows);
  sets.anvil = anvilSet;

  const chart = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.7, 8), mats.stone);
  plinth.position.set(2.0, 0.35, 1.4);
  chart.add(plinth);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 8), mats.iron);
  scope.position.set(2.0, 1.15, 1.4);
  scope.rotation.z = 0.7;
  scope.rotation.y = -0.3;
  chart.add(scope);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.035, 8, 32), mats.gold);
  ring.position.set(2.0, 2.1, 1.4);
  ring.rotation.x = Math.PI / 2.4;
  ring.userData.spin = 0.4;
  chart.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 8, 24), mats.gold);
  ring2.position.set(2.0, 2.1, 1.4);
  ring2.userData.spin = -0.55;
  chart.add(ring2);
  sets.chart = chart;

  const arena = new THREE.Group();
  const ringFloor = new THREE.Mesh(
    new THREE.RingGeometry(2.15, 3.35, 28),
    new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.85, metalness: 0.12 })
  );
  ringFloor.rotation.x = -Math.PI / 2;
  ringFloor.position.set(0.15, 0.08, 1.65);
  arena.add(ringFloor);
  const sand = new THREE.Mesh(new THREE.CircleGeometry(2.15, 24), mats.sand);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0.15, 0.07, 1.65);
  arena.add(sand);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.15, 6), mats.stone);
    col.position.set(Math.cos(a) * 3.15 + 0.15, 0.58, Math.sin(a) * 3.15 + 1.65);
    arena.add(col);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), i % 2 ? mats.flame : mats.flameBlue);
    lamp.position.copy(col.position);
    lamp.position.y = 1.22;
    arena.add(lamp);
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshBasicMaterial({ color: 0x7f1d1d, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  banner.position.set(-3.2, 1.4, 1.2);
  arena.add(banner);
  sets.arena = arena;

  const vein = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38 + i * 0.06, 0), mats.stoneDark);
    rock.position.set(1.4 + i * 0.55, 0.32, 0.7 + (i % 2) * 0.9);
    rock.rotation.set(i, i * 0.4, 0.2);
    vein.add(rock);
    const gleam = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), mats.gold);
    gleam.position.copy(rock.position);
    gleam.position.y += 0.28;
    vein.add(gleam);
  }
  sets.vein = vein;

  const ember = new THREE.Group();
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.2, 10), mats.stoneDark);
  pit.position.set(2.0, 0.12, 1.6);
  ember.add(pit);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6), mats.ember);
  fire.position.set(2.0, 0.65, 1.6);
  fire.userData.forge = true;
  ember.add(fire);
  const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 5), mats.bark);
  logA.rotation.z = 1.2;
  logA.position.set(2.0, 0.22, 1.6);
  ember.add(logA);
  sets.ember = ember;

  const hearth = new THREE.Group();
  const oven = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.9), mats.stone);
  oven.position.set(2.2, 0.55, 1.5);
  hearth.add(oven);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.2), mats.ember);
  mouth.position.set(2.2, 0.42, 1.96);
  mouth.userData.forge = true;
  hearth.add(mouth);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.35, 8), mats.iron);
  pot.position.set(2.2, 1.25, 1.5);
  hearth.add(pot);
  sets.hearth = hearth;

  const fletch = new THREE.Group();
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.4), mats.bark);
  rack.position.set(2.1, 0.85, 1.5);
  fletch.add(rack);
  for (let i = 0; i < 5; i++) {
    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 4), mats.leaf);
    arrow.rotation.z = Math.PI / 2;
    arrow.position.set(2.1, 0.95, 1.3 + i * 0.08);
    fletch.add(arrow);
  }
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 7), mats.bark);
  log.rotation.z = Math.PI / 2;
  log.position.set(2.1, 0.22, 2.1);
  fletch.add(log);
  sets.fletch = fletch;

  const loom = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.12), mats.bark);
  frame.position.set(2.1, 0.9, 1.4);
  loom.add(frame);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), mats.cloth);
  cloth.position.set(2.1, 0.85, 1.48);
  loom.add(cloth);
  sets.loom = loom;

  const sigil = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.16, 6), mats.stone);
  slab.position.set(2.0, 0.1, 1.5);
  sigil.add(slab);
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 16), mats.gold);
  rune.rotation.x = Math.PI / 2;
  rune.position.set(2.0, 0.22, 1.5);
  rune.userData.spin = 0.8;
  sigil.add(rune);
  sets.sigil = sigil;

  const vial = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.8), mats.bark);
  table.position.set(2.1, 0.7, 1.5);
  vial.add(table);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mats.stoneDark);
  stand.position.set(2.1, 0.32, 1.5);
  vial.add(stand);
  const flask = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0x10b981, transparent: true, opacity: 0.7, emissive: 0x047857, emissiveIntensity: 0.8 }));
  flask.position.set(2.1, 1.0, 1.5);
  flask.userData.forge = true;
  vial.add(flask);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 8), mats.iron);
  neck.position.set(2.1, 1.22, 1.5);
  vial.add(neck);
  sets.vial = vial;

  const course = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), mats.bark);
    flag.position.set(0.4 + i * 0.55, 0.55, 0.4 + Math.sin(i) * 0.8);
    course.add(flag);
    const clothP = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshBasicMaterial({ color: 0x0f766e, side: THREE.DoubleSide }));
    clothP.position.set(flag.position.x + 0.18, 0.95, flag.position.z);
    course.add(clothP);
  }
  sets.course = course;

  const whisper = new THREE.Group();
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.45, 12), mats.stoneDark);
  well.position.set(2.0, 0.22, 1.5);
  whisper.add(well);
  const mist = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.28 }));
  mist.position.set(2.0, 0.85, 1.5);
  mist.userData.forge = true;
  whisper.add(mist);
  sets.whisper = whisper;

  const soil = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 0.85), mats.sand);
    bed.position.set(1.3 + (i % 2) * 1.15, 0.08, 0.9 + Math.floor(i / 2) * 1.15);
    soil.add(bed);
    const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), mats.leaf);
    sprout.position.set(bed.position.x, 0.32, bed.position.z);
    soil.add(sprout);
  }
  sets.soil = soil;

  const drove = new THREE.Group();
  const fence = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.08), mats.bark);
  fence.position.set(2.1, 0.3, 0.7);
  drove.add(fence);
  const fence2 = fence.clone();
  fence2.position.z = 2.5;
  drove.add(fence2);
  for (let i = 0; i < 3; i++) {
    const beast = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.35, 4, 8), new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.7 }));
    beast.position.set(1.5 + i * 0.5, 0.35, 1.5 + (i % 2) * 0.3);
    beast.rotation.z = Math.PI / 2;
    drove.add(beast);
  }
  sets.drove = drove;

  const training = new THREE.Group();
  const dummy = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.4, 8), mats.bark);
  dummy.position.set(2.1, 0.7, 1.55);
  training.add(dummy);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mats.sand);
  head.position.set(2.1, 1.5, 1.55);
  training.add(head);
  sets.might = training;
  sets.guard = training;
  sets.vitality = training;
  sets.mark = training;
  sets.weave = training;
  sets.vow = training;
  sets.bounty = training;

  const idle = new THREE.Group();
  idle.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.6), mats.gold));
  idle.children[0].position.set(2.15, 0.5, 1.7);
  sets.idle = idle;

  for (const [id, g] of Object.entries(sets)) {
    g.visible = false;
    g.userData.skillId = id;
    if (!g.parent) root.add(g);
  }

  function show(skill) {
    const id = sets[skill] ? skill : "idle";
    for (const g of Object.values(sets)) g.visible = false;
    sets[id].visible = true;
  }
  show("idle");

  function tick(t, skill, fighting, goldLight) {
    const active = fighting ? sets.arena : (sets[skill] || sets.idle);
    active.traverse((c) => {
      if (c.userData.spin) c.rotation.y += c.userData.spin * 0.01;
      if (c.userData.forge) {
        const pulse = 0.85 + Math.sin(t * 8) * 0.2;
        c.scale.y = pulse;
        if (c.material?.emissiveIntensity != null) c.material.emissiveIntensity = 1.1 + Math.sin(t * 9) * 0.5;
      }
      if (c.userData.water || (c.material === mats.water)) {
        c.position.y = 0.09 + Math.sin(t * 1.6) * 0.02;
        if (c.material?.opacity != null) c.material.opacity = 0.62 + Math.sin(t * 1.8) * 0.08;
      }
    });
    if (skill === "anvil" && !fighting) {
      goldLight.position.set(2.15, 1.1 + Math.sin(t * 8) * 0.08, 2.2);
    } else if (!fighting) {
      goldLight.position.set(2.4, 2.1, 2.6);
    }
  }

  return { root, show, tick };
}

function makeFighter(color, mats) {
  const group = new THREE.Group();
  const orig = new THREE.Color(color);
  const hurt = new THREE.Color(0x4a1520);
  const flashCol = new THREE.Color(0xfff1dc);
  const mat = new THREE.MeshStandardMaterial({ color: orig.clone(), roughness: 0.45, metalness: 0.22, emissive: 0x000000, emissiveIntensity: 0 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 5, 10), mat);
  body.position.y = 0.86;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), mat);
  head.position.y = 1.5;
  group.add(head);
  const tabard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.12), mats.gold);
  tabard.position.set(0, 0.95, 0.22);
  group.add(tabard);
  return {
    group,
    flash(amount) {
      mat.emissive.copy(flashCol);
      mat.emissiveIntensity = amount * 2.1;
    },
    hpTint(ratio) {
      const r = THREE.MathUtils.clamp(ratio, 0, 1);
      body.scale.set(1, 0.86 + r * 0.14, 1);
      mat.color.copy(hurt).lerp(orig, r);
    }
  };
}

function buildHpBars() {
  const root = new THREE.Group();
  function bar(col) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0x0a0f1c, depthTest: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.07), new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
    fill.position.z = 0.01;
    g.add(bg, fill);
    g.userData.fill = fill;
    return g;
  }
  const a = bar(0x6ee7b7);
  const b = bar(0xfb7185);
  root.add(a, b);
  function set(pPos, ePos, pR, eR, cam) {
    a.position.set(pPos.x, 2.05, pPos.z);
    b.position.set(ePos.x, 2.05, ePos.z);
    a.lookAt(cam.position);
    b.lookAt(cam.position);
    a.userData.fill.scale.x = Math.max(0.04, pR);
    a.userData.fill.position.x = (pR - 1) * 0.43;
    b.userData.fill.scale.x = Math.max(0.04, eR);
    b.userData.fill.position.x = (eR - 1) * 0.43;
  }
  return { root, set };
}

function tintForSkill(skill, fighting, scene, gold, rim, hemi, floor) {
  const c = SKILL_TINT[skill] || 0x1e293b;
  scene.fog.color.setHex(fighting ? 0x1a0c10 : 0x0b1020);
  gold.color.setHex(skill === "ember" || skill === "vow" || skill === "anvil" ? 0xffae5e : 0xe0b15a);
  rim.color.setHex(fighting ? 0xff6b6b : c);
  hemi.color.setHex(fighting ? 0xffc4a8 : 0x9bb7ff);
  floor.material.color.setHex(fighting ? 0x1a1214 : 0x12182c);
}
