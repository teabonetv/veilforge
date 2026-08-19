import * as THREE from "three";

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x05070f, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b1020, 0.045);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  camera.position.set(0, 4.2, 9.5);
  camera.lookAt(0, 1.6, 0);

  const hemi = new THREE.HemisphereLight(0x9bb7ff, 0x1a1020, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd6a0, 1.1);
  key.position.set(6, 10, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x7aa2ff, 8, 24);
  rim.position.set(-4, 3, -2);
  scene.add(rim);
  const gold = new THREE.PointLight(0xe0b15a, 5, 18);
  gold.position.set(2.5, 2.2, 3);
  scene.add(gold);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(14, 48),
    new THREE.MeshStandardMaterial({ color: 0x12182c, roughness: 0.92, metalness: 0.08 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const citadel = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x2a3148, roughness: 0.8, metalness: 0.15 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.7, emissive: 0x3a2a08, emissiveIntensity: 0.4 });
  const keep = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 5.2), stone);
  keep.position.y = 1.7;
  citadel.add(keep);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.2, 4), goldM);
  roof.position.y = 4.5;
  roof.rotation.y = Math.PI / 4;
  citadel.add(roof);
  for (let i = 0; i < 4; i++) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 4.4, 8), stone);
    const a = i * Math.PI / 2 + Math.PI / 4;
    tower.position.set(Math.cos(a) * 3.1, 2.2, Math.sin(a) * 3.1);
    citadel.add(tower);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x7aa2ff : 0xe0b15a })
    );
    flame.position.set(tower.position.x, 4.6, tower.position.z);
    flame.userData.bob = i;
    citadel.add(flame);
  }
  citadel.position.set(-3.2, 0, -2.4);
  scene.add(citadel);

  const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.7), goldM);
  anvil.position.set(2.2, 0.45, 2.1);
  scene.add(anvil);
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), stone);
  block.position.set(2.2, 0.15, 2.1);
  scene.add(block);

  const player = makeFighter(0x8eb4ff);
  player.position.set(-1.2, 0, 1.4);
  scene.add(player);
  const enemy = makeFighter(0xff8aa0);
  enemy.position.set(1.6, 0, 1.4);
  enemy.visible = false;
  scene.add(enemy);

  const stars = new THREE.Points(
    starGeo(),
    new THREE.PointsMaterial({ color: 0xdce7ff, size: 0.05, transparent: true, opacity: 0.85 })
  );
  scene.add(stars);

  const aurora = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 8),
    new THREE.MeshBasicMaterial({ color: 0x4f6dff, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  aurora.position.set(0, 7.5, -8);
  scene.add(aurora);

  const skillProps = new THREE.Group();
  scene.add(skillProps);

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 480;
    const h = canvas.clientHeight || 280;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let t = 0;
  function frame(state, skill) {
    t += 0.016;
    citadel.rotation.y = Math.sin(t * 0.12) * 0.04;
    stars.rotation.y = t * 0.01;
    aurora.position.x = Math.sin(t * 0.15) * 2;
    aurora.material.opacity = 0.1 + Math.sin(t * 0.6) * 0.04;
    citadel.children.forEach((c) => {
      if (c.userData.bob != null) c.position.y = 4.55 + Math.sin(t * 3 + c.userData.bob) * 0.08;
    });
    const fighting = state.combat.fighting;
    enemy.visible = fighting;
    player.position.x = -1.2 + (fighting ? Math.sin(t * 6) * 0.05 : 0);
    if (fighting) enemy.position.x = 1.6 + Math.sin(t * 6 + 1) * 0.05;
    tintForSkill(skill, scene, gold, rim);
    renderer.render(scene, camera);
  }

  return { frame, resize, scene };
}

function makeFighter(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), mat);
  body.position.y = 0.85;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat);
  head.position.y = 1.48;
  g.add(head);
  return g;
}

function starGeo() {
  const g = new THREE.BufferGeometry();
  const n = 400;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 40;
    arr[i * 3 + 1] = 6 + Math.random() * 16;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return g;
}

function tintForSkill(skill, scene, gold, rim) {
  const map = {
    timber: 0x3d6b3a, trawl: 0x1b4d6e, vein: 0x5a5348, ember: 0xb45309,
    hearth: 0x9a3412, anvil: 0x94a3b8, fletch: 0x3f6212, loom: 0x6d28d9,
    sigil: 0x1d4ed8, vial: 0x047857, course: 0x0f766e, whisper: 0x334155,
    soil: 0x365314, drove: 0x854d0e, chart: 0x312e81, might: 0x7f1d1d,
    guard: 0x1e3a5f, vitality: 0x9f1239, mark: 0x3f6212, weave: 0x4c1d95,
    vow: 0xf59e0b, bounty: 0x111827
  };
  const c = map[skill] || 0x1e293b;
  scene.fog.color.setHex(0x0b1020);
  gold.color.setHex(skill === "ember" || skill === "vow" ? 0xffae5e : 0xe0b15a);
  rim.color.setHex(c);
}
