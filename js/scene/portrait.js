import * as THREE from "../vendor/three.module.js";
import { makeEntityModel, makeWanderer } from "./models.js";

export function createPortrait(canvas) {
  if (!canvas) {
    return { showModel() {}, showWanderer() {}, frame() {}, resize() {}, renderer: null };
  }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0x080610, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0714, 0.06);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
  camera.position.set(0, 1.15, 3.4);
  camera.lookAt(0, 0.85, 0);
  scene.add(new THREE.HemisphereLight(0xb9a4e3, 0x1a1020, 0.85));
  const key = new THREE.DirectionalLight(0xffe4c4, 0.9);
  key.position.set(2.2, 4, 3);
  scene.add(key);
  const rim = new THREE.PointLight(0x7b6cff, 5, 12);
  rim.position.set(-2, 1.4, 1.5);
  scene.add(rim);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x14091c, roughness: 0.92, metalness: 0.08 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  let subject = new THREE.Group();
  scene.add(subject);
  let t = 0;
  let mode = "empty";

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 280;
    const h = canvas.clientHeight || 280;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();

  function clearSubject() {
    scene.remove(subject);
    subject.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
    });
    subject = new THREE.Group();
    scene.add(subject);
  }

  function showModel(model, kind) {
    mode = kind || model?.kind || "item";
    clearSubject();
    const mesh = makeEntityModel(model || {}, { kind: mode });
    mesh.position.y = 0.05;
    subject.add(mesh);
    camera.position.set(0, 1.05, 3.1);
    camera.lookAt(0, 0.7, 0);
  }

  function showWanderer(equipment, items) {
    mode = "wanderer";
    clearSubject();
    const w = makeWanderer(equipment, items);
    subject.add(w);
    camera.position.set(0.35, 1.45, 4.1);
    camera.lookAt(0, 1.05, 0);
  }

  function frame() {
    t += 0.016;
    subject.rotation.y = Math.sin(t * 0.35) * 0.35 + (mode === "wanderer" ? 0.15 : 0);
    renderer.render(scene, camera);
  }

  return { showModel, showWanderer, frame, resize, renderer };
}
