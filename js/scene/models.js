import * as THREE from "../vendor/three.module.js";

function col(hue, s = 0.45, l = 0.42) {
  const c = new THREE.Color();
  c.setHSL((hue % 360) / 360, s, l);
  return c;
}

function mat(hue, { metal = 0.18, rough = 0.55, emissive = 0, emi = 0 } = {}) {
  return new THREE.MeshStandardMaterial({
    color: col(hue),
    roughness: rough,
    metalness: metal,
    emissive,
    emissiveIntensity: emi
  });
}

function bit(seed, n) {
  return ((seed >>> n) & 1) === 1;
}

/** Unique procedural mesh for items, monsters, dungeons, and actions. */
export function makeEntityModel(model = {}, extra = {}) {
  const seed = model.seed || 1;
  const hue = model.hue ?? (seed % 360);
  const kind = model.kind || extra.kind || "material";
  const g = new THREE.Group();
  const m = mat(hue, extra.mat || {});
  const m2 = mat(hue + 40, { metal: 0.4, rough: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c9a0, metalness: 0.55, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1028, roughness: 0.8, metalness: 0.1 });

  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
  };

  const k = kind;
  if (k === "log" || k === "grove") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22 + (seed % 7) * 0.02, 0.26, 1.4, 6 + (seed % 3)), m), 0, 0.7, 0, 0, 0, 1.2);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.35 + (seed % 5) * 0.03, 8, 6), mat(hue + 80, { rough: 0.9 })), 0.1, 1.15, 0);
    if (bit(seed, 3)) add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), gold), 0.35, 1.2, 0.1);
  } else if (k === "ore" || k === "seam") {
    for (let i = 0; i < 4 + (seed % 3); i++) {
      add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + (i % 3) * 0.08, 0), i % 2 ? m : m2), (i - 1.5) * 0.22, 0.25 + (i % 2) * 0.1, (i % 3) * 0.1, i, i * 0.3, 0.1);
    }
  } else if (k === "bar") {
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.32), m2), 0, 0.2, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.28), gold), 0, 0.36, 0);
  } else if (k === "fish" || k === "tide") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), m), 0, 0.35, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 5), m2), 0.42, 0.35, 0, 0, 0, -1.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 4), gold), -0.32, 0.4, 0, 0, 0, 1.1);
  } else if (k === "food" || k === "oven") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.18, 10), m), 0, 0.15, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(hue + 20, { rough: 0.7 })), 0, 0.32, 0);
  } else if (k.startsWith("pet-")) {
    addPetShape(g, k.slice(4), hue, seed, m, m2, gold);
  } else if (k === "saber") {
    const long = 1.2 + (seed % 9) * 0.05;
    const thick = 0.08 + (seed % 5) * 0.012;
    if (bit(seed, 1)) add(new THREE.Mesh(new THREE.BoxGeometry(thick, long, 0.045), m2), 0, 0.85, 0);
    else add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, thick * 0.7, long, 6), m2), 0, 0.85, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28 + (seed % 6) * 0.04, 0.08, 0.12), gold), 0, 0.28, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6), dark), 0, 0.08, 0);
    if (bit(seed, 4)) add(new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), gold), 0, 0.28 + long * 0.55, 0);
    if (bit(seed, 7)) add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 10), gold), 0, 0.28, 0, Math.PI / 2, 0, 0);
  } else if (k === "cleaver") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.45 + (seed % 5) * 0.04, 0.55 + (seed % 4) * 0.06, 0.08), m2), 0.12, 0.7, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55 + (seed % 5) * 0.05, 6), dark), -0.18, 0.35, 0);
    if (bit(seed, 3)) add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.04), gold), 0.28, 0.95, 0);
  } else if (k === "needle") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035 + (seed % 4) * 0.008, 1.35 + (seed % 6) * 0.05, 5), m2), 0, 0.85, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.06 + (seed % 3) * 0.02, 6, 6), gold), 0, 0.12, 0);
    if (bit(seed, 5)) add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 10), gold), 0, 0.22, 0);
  } else if (k === "bow") {
    const rad = 0.48 + (seed % 6) * 0.03;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.035 + (seed % 3) * 0.008, 6, 14, Math.PI), m);
    arc.rotation.z = -Math.PI / 2;
    add(arc, 0, 0.7, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, rad * 1.9, 4), gold), rad * 0.45, 0.7, 0);
    if (bit(seed, 2)) add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), gold), 0, 0.7 + rad, 0);
  } else if (k === "crozier") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.25 + (seed % 5) * 0.06, 6), m), 0, 0.75, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.12 + (seed % 4) * 0.02, 0.035, 6, 12), gold), 0.12, 1.45, 0);
    if (bit(seed, 6)) add(new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), m2), 0.12, 1.45, 0);
  } else if (k === "helm") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.3 + (seed % 4) * 0.02, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), m2), 0, 0.35, 0);
    if (bit(seed, 2)) add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22 + (seed % 4) * 0.05, 4), gold), 0, 0.7, 0);
    if (bit(seed, 8)) add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.12), gold), 0, 0.42, 0.12);
  } else if (k === "body") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.32), m2), 0, 0.5, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.08), gold), 0, 0.55, 0.18);
  } else if (k === "legs") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), m), -0.14, 0.4, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), m), 0.14, 0.4, 0);
  } else if (k === "boots") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.4), m2), -0.16, 0.12, 0.04);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.4), m2), 0.16, 0.12, 0.04);
  } else if (k === "gloves") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), m), -0.28, 0.2, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), m), 0.28, 0.2, 0);
  } else if (k === "shield") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.08, 6), m2), 0, 0.45, 0, 1.2, 0, 0);
    add(new THREE.Mesh(new THREE.CircleGeometry(0.16, 6), gold), 0, 0.45, 0.06);
  } else if (k === "cape") {
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), m), 0, 0.6, -0.1);
  } else if (k === "amulet") {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), gold), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), m2), 0, 0.28, 0);
  } else if (k === "ring") {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16), gold), 0, 0.3, 0, 1.1, 0, 0);
  } else if (k === "ammo") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), m), 0, 0.5, 0, 0, 0, 1.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold), 0.42, 0.5, 0, 0, 0, -1.2);
  } else if (k === "axe") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 5), dark), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.08), m2), 0.22, 1.0, 0);
  } else if (k === "pick") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.05, 5), dark), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.1), m2), 0, 1.05, 0);
  } else if (k === "rod") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 5), m), 0, 0.8, 0, 0, 0, 0.4);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), gold), 0.45, 1.35, 0);
  } else if (k === "potion" || k === "alembic") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m), 0, 0.28, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), gold), 0, 0.52, 0);
  } else if (k === "rune" || k === "circle") {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 20), gold), 0, 0.2, 0, Math.PI / 2, 0, 0);
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), m2), 0, 0.22, 0);
  } else if (k === "gem") {
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), m2), 0, 0.35, 0);
  } else if (k === "herb" || k === "seed" || k === "plot") {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), mat(hue + 90, { rough: 0.9 })), 0, 0.4, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), m), 0.12, 0.55, 0.05);
  } else if (k === "gate" || k.startsWith("gate-")) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), dark), -0.55, 0.8, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), dark), 0.55, 0.8, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.22), m2), 0, 1.55, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 12), gold), 0, 0.7, 0.12);
    if (k === "gate-sewer") add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 10), m), 0, 0.45, 0.1);
    if (k === "gate-fen") add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 5), mat(hue + 80, { rough: 0.9 })), 0.7, 0.4, 0);
    if (k === "gate-pyre") add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), mat(20, { emissive: 0xff6a2a, emi: 0.9 })), 0, 0.9, 0.2);
    if (k === "gate-spire") add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 4), gold), 0, 1.95, 0);
    if (k === "gate-keep") add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.2), m2), 0, 0.4, 0);
    if (k === "gate-well") add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 10), m2), 0, 0.2, 0.2);
    if (k === "gate-heart") add(new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat(hue, { emi: 0.4, emissive: 0x4a1020 })), 0, 0.85, 0.2);
    if (k === "gate-stacks") add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.18), gold), 0, 0.7, 0.18);
    if (k === "gate-page") add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.08), gold), 0, 0.75, 0.2);
  } else if (k.startsWith("beast-") || k.startsWith("boss-")) {
    addBeast(g, k, hue, seed, m, m2, gold);
  } else if (k === "forge" || k === "pyre") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.7), dark), 0, 0.25, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 5), mat(20, { emissive: 0xff6a2a, emi: 0.8, rough: 0.4 })), 0, 0.65, 0);
  } else if (k === "scope") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 8), m2), 0, 0.7, 0, 0, 0, 0.8);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 16), gold), 0.35, 1.05, 0);
  } else if (k === "circuit") {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 20), m2), 0, 0.15, 0, Math.PI / 2, 0, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), gold), 0, 0.4, 0);
  } else if (k === "rack") {
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.3), dark), 0, 0.55, 0);
    for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4), m2), -0.35 + i * 0.22, 0.7, 0, 0, 0, 1.2);
  } else if (k === "frame") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.08), dark), 0, 0.6, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.85), m), 0, 0.6, 0.05);
  } else if (k === "mark") {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 16), gold), 0, 0.5, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), m2), 0, 0.5, 0);
  } else if (k === "pen") {
    add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.7), dark), 0, 0.08, 0);
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.28, 4, 8), m), 0.15, 0.28, 0, 0, 0, 1.2);
  } else if (k === "coins" || k === "currency") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), gold), -0.12, 0.2, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), m2), 0.14, 0.26, 0.05);
  } else if (k === "bones") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), gold), 0, 0.4, 0, 0, 0, 1.1);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), m), -0.4, 0.4, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), m), 0.4, 0.4, 0);
  } else if (k === "hide") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), m), 0, 0.32, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), m2), 0, 0.32, 0.2);
  } else if (k === "essence" || k === "dust") {
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat(hue, { emi: 0.6, emissive: 0x6b4cff })), 0, 0.4, 0);
  } else if (k === "ashes") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), dark), 0, 0.18, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), m), 0.16, 0.28, 0.05);
  } else if (k === "pouch") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), m), 0, 0.28, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 8), gold), 0, 0.52, 0);
  } else if (k === "compost") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.4, 8), m), 0, 0.22, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), mat(hue + 80, { rough: 0.9 })), 0, 0.42, 0);
  } else if (k === "fodder") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), m), 0, 0.18, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), gold), -0.18, 0.38, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), gold), 0.18, 0.38, 0);
  } else if (k === "key") {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 12), gold), -0.2, 0.4, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.08), m2), 0.18, 0.4, 0);
  } else if (k === "token") {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8), gold), 0, 0.22, 0);
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), m2), 0, 0.28, 0);
  } else if (k === "robe") {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), m), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), gold), 0, 1.05, 0);
  } else if (k === "hidebody") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.28), m), 0, 0.5, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), gold), 0, 0.55, 0.16);
  } else {
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + (seed % 5) * 0.02, 0), m), 0, 0.35, 0);
    if (bit(seed, 4)) add(new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 6, 12), gold), 0, 0.35, 0, 0.5, 0, 0);
  }

  g.traverse((c) => {
    if (c.rotation && bit(seed, 5)) c.rotation.y += ((seed % 20) - 10) * 0.02;
  });
  g.scale.setScalar(0.85 + (seed % 9) * 0.03);
  return g;
}

function addBeast(g, k, hue, seed, m, m2, gold) {
  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
  };
  if (k === "beast-rat") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), m), 0.1, 0.28, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), m2), -0.28, 0.32, 0.1);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), gold), -0.5, 0.4, 0, 0, 0, 1);
  } else if (k === "beast-wolf") {
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), m), 0.1, 0.35, 0, 0, 0, 1.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), m2), -0.05, 0.62, 0.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), m2), 0.18, 0.62, 0.2);
  } else if (k === "beast-bat") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), m), 0, 0.7, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), m2), -0.45, 0.7, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), m2), 0.45, 0.7, 0);
  } else if (k === "beast-spider") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), m), 0, 0.32, 0);
    for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 4), gold), Math.cos(i) * 0.35, 0.2, Math.sin(i) * 0.35, 0.8, i, 0);
  } else if (k === "beast-knight") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.28), m2), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), gold), 0, 1.05, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), gold), 0.32, 0.6, 0);
  } else if (k === "beast-moth") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), darkMat()), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), m), -0.32, 0.55, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), m2), 0.32, 0.55, 0);
  } else if (k === "beast-crab" || k === "boss-crab") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), m), 0, 0.32, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), gold), -0.55, 0.38, 0.1);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), gold), 0.55, 0.38, 0.1);
  } else if (k === "beast-hydra" || k === "boss-hydra") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), m), 0, 0.3, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), m2), -0.28, 0.85, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), gold), 0, 1.05, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), m2), 0.28, 0.85, 0);
  } else if (k === "beast-ghoul" || k === "boss-ghoul" || k === "boss-cultist") {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.15, 6), m), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), k.includes("cultist") ? gold : m2), 0, 1.05, 0);
  } else if (k === "beast-troll" || k === "beast-brute" || k === "boss-troll") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.55), m), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.45), m2), 0, 1.15, 0.05);
  } else if (k === "beast-drake" || k === "boss-drake") {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 6), m), 0, 0.45, 0, 1.1, 0, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 5), gold), 0.45, 0.7, -0.1, 0, 0, -0.8);
  } else if (k === "beast-golem" || k === "boss-colossus") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), m2), 0, 0.6, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), gold), 0, 1.25, 0);
  } else if (k === "beast-serpent") {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 6, 16, Math.PI), m), 0, 0.35, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), gold), 0.4, 0.55, 0);
  } else if (k === "beast-wraith") {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.2, 6), m), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), gold), 0, 1.1, 0);
  } else if (k === "beast-stag") {
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 4, 8), m), 0, 0.4, 0, 0, 0, 1.15);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), gold), -0.12, 0.85, 0.1);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), gold), 0.12, 0.85, 0.1);
  } else if (k === "beast-imp") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), m), 0, 0.4, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), gold), -0.16, 0.62, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), gold), 0.16, 0.62, 0);
  } else if (k === "beast-mark") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), m), 0, 0.7, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 6), m2), 0, 0.35, -0.35, 0.9, 0, 0);
  } else if (k === "beast-weave") {
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), m), 0, 0.7, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 18), gold), 0, 0.7, 0, 0.6, 0, 0);
  } else if (k === "boss-oath") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.3), m2), 0, 0.6, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), gold), 0, 1.3, 0);
  } else if (k === "boss-codex" || k === "boss-ledger") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.18), gold), 0, 0.55, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.12), m), 0, 0.55, 0.06);
  } else {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.9), m), 0, 0.45, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), m2), 0, 0.9, 0.25);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), gold), -0.12, 1.15, 0.3);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), gold), 0.12, 1.15, 0.3);
  }
  if (bit(seed, 2)) g.scale.x *= 1.08;
  if (bit(seed, 6)) g.scale.y *= 1.1;
}

function addPetShape(g, skill, hue, seed, m, m2, gold) {
  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
  };
  const s = skill.replace(/^pet-/, "");
  if (s === "timber" || s === "loom") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), m2), 0, 0.2, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), m), -0.22, 0.22, 0);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), mat(hue + 40, { rough: 0.8 })), 0.22, 0.22, 0);
  } else if (s === "trawl" || s === "vial") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), gold), 0.18, 0.16, 0, 0, 0, -1.2);
  } else if (s === "vein" || s === "anvil") {
    add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), m2), 0, 0.16, 0);
  } else if (s === "ember" || s === "vow") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(20, { emissive: 0xff6a2a, emi: 0.8 })), 0, 0.18, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), mat(30, { emi: 0.6, emissive: 0xff9a4a })), 0, 0.32, 0);
  } else if (s === "hearth" || s === "vitality") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 10), gold), 0, 0.16, 0, Math.PI / 2, 0, 0);
  } else if (s === "fletch" || s === "mark") {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 5), m2), 0, 0.18, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.04), gold), 0, 0.18, 0);
  } else if (s === "sigil" || s === "weave" || s === "chart") {
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), m2), 0, 0.18, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 12), gold), 0, 0.18, 0, 0.5, 0, 0);
  } else if (s === "course") {
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.18, 4, 8), m), 0, 0.16, 0);
  } else if (s === "whisper" || s === "bounty") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), darkMat()), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), gold), 0, 0.3, 0);
  } else if (s === "soil" || s === "drove") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), m), 0, 0.14, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold), -0.08, 0.26, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold), 0.08, 0.26, 0);
  } else if (s === "might") {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), m), 0, 0.14, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), gold), -0.06, 0.24, 0.04);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), gold), 0.06, 0.24, 0.04);
  } else if (s === "guard") {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m2), 0, 0.14, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), gold), 0, 0.14, 0.08);
  } else {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12 + (seed % 4) * 0.01, 8, 6), m), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), gold), 0, 0.28, 0);
  }
}

export function makeWanderer(equipment = {}, items = {}, pets = {}) {
  const root = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2a1838, roughness: 0.62, metalness: 0.12 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc4b4a4, roughness: 0.7, metalness: 0.04 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3b5, metalness: 0.55, roughness: 0.35 });

  const bodyId = equipment.body;
  const bodyHue = items[bodyId]?.hue ?? 270;
  const armor = items[bodyId] ? mat(bodyHue, { metal: 0.4, rough: 0.4 }) : cloth;

  const boots = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.42), items[equipment.boots] ? metal : darkMat());
  boots.position.set(-0.14, 0.12, 0.04);
  root.add(boots);
  const boots2 = boots.clone();
  boots2.position.x = 0.14;
  root.add(boots2);

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), items[equipment.legs] ? armor : cloth);
  legs.position.y = 0.55;
  root.add(legs);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.62, 6, 10), armor);
  torso.position.y = 1.22;
  root.add(torso);

  const helmId = equipment.helm;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), helmId ? metal : skin);
  head.position.y = 1.78;
  root.add(head);
  if (helmId) {
    const helm = makeEntityModel(items[helmId]?.model || { kind: "helm", hue: items[helmId]?.hue || 270, seed: 1 });
    helm.scale.setScalar(0.42);
    helm.position.set(0, 1.92, 0);
    root.add(helm);
  } else {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, 1.2), cloth);
    hood.position.set(0, 1.82, -0.02);
    root.add(hood);
  }

  if (equipment.cape) {
    const capeM = items[equipment.cape]?.model;
    if (capeM) {
      const capeMesh = makeEntityModel(capeM);
      capeMesh.scale.setScalar(0.55);
      capeMesh.position.set(0, 1.05, -0.32);
      root.add(capeMesh);
    } else {
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.15), mat(items[equipment.cape]?.hue || 280, { rough: 0.8 }));
      cape.position.set(0, 1.15, -0.28);
      root.add(cape);
    }
  }
  if (equipment.gloves) {
    const gm = mat(items[equipment.gloves]?.hue || 260, { metal: 0.3, rough: 0.5 });
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.2), gm);
    gl.position.set(0.42, 1.05, 0.08);
    root.add(gl);
    const gr = gl.clone();
    gr.position.x = -0.42;
    root.add(gr);
  }
  if (equipment.amulet) {
    const am = makeEntityModel(items[equipment.amulet]?.model || { kind: "amulet", hue: 50, seed: 2 });
    am.scale.setScalar(0.28);
    am.position.set(0, 1.42, 0.28);
    root.add(am);
  }
  if (equipment.ring) {
    const rg = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), goldMat());
    rg.position.set(0.4, 1.02, 0.12);
    root.add(rg);
  }
  if (equipment.ammo) {
    const qv = makeEntityModel(items[equipment.ammo]?.model || { kind: "ammo", hue: 40, seed: 3 });
    qv.scale.setScalar(0.32);
    qv.position.set(-0.12, 1.15, -0.22);
    root.add(qv);
  }

  const w = items[equipment.weapon];
  if (w?.model) {
    const blade = makeEntityModel(w.model);
    blade.scale.setScalar(0.55);
    blade.position.set(0.48, 0.85, 0.12);
    blade.rotation.z = -0.4;
    root.add(blade);
  }
  if (items[equipment.shield]?.model) {
    const sh = makeEntityModel(items[equipment.shield].model);
    sh.scale.setScalar(0.45);
    sh.position.set(-0.48, 0.95, 0.1);
    root.add(sh);
  }
  if (items[equipment.body]?.model) {
    const plate = makeEntityModel(items[equipment.body].model);
    plate.scale.setScalar(0.22);
    plate.position.set(0, 1.28, 0.22);
    root.add(plate);
  }
  if (items[equipment.boots]?.model) {
    const bt = makeEntityModel(items[equipment.boots].model);
    bt.scale.setScalar(0.22);
    bt.position.set(0, 0.28, 0.22);
    root.add(bt);
  }
  const ownedPets = Object.entries(pets).filter(([, on]) => on).map(([id]) => id);
  ownedPets.slice(0, 3).forEach((id, i) => {
    const skill = id.replace(/^pet-/, "");
    const companion = makeEntityModel({ kind: `pet-${skill}`, seed: 40 + i * 13, hue: 40 + i * 47, eid: id });
    companion.scale.setScalar(0.55);
    companion.position.set(0.38 + i * 0.12, 1.62 + (i % 2) * 0.08, -0.12);
    root.add(companion);
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 28), new THREE.MeshBasicMaterial({ color: 0x7b6cff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);
  return root;
}

function goldMat() {
  return new THREE.MeshStandardMaterial({ color: 0xe8c9a0, metalness: 0.55, roughness: 0.35 });
}

function darkMat() {
  return new THREE.MeshStandardMaterial({ color: 0x1a1028, roughness: 0.75, metalness: 0.08 });
}

export function silhouetteStyle(model = {}) {
  const hue = model.hue ?? 270;
  const seed = model.seed || 1;
  const r = 18 + (seed % 10);
  return {
    background: `radial-gradient(circle at 30% 20%, hsl(${hue} 40% 28%), hsl(${(hue + 40) % 360} 35% 12%) 70%)`,
    borderColor: `hsl(${hue} 40% 42%)`,
    borderRadius: `${6 + (seed % 10)}px`,
    boxShadow: `inset 0 0 ${8 + (seed % 8)}px hsl(${hue} 50% 30% / 0.4)`
  };
}
