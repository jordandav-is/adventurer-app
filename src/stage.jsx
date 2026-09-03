// The stage: a rigged figure on a stone plinth under a procedural sky. Lazy-loaded so three.js
// never touches the main bundle. Environments are sky-shader parameters, not image assets — the
// same sky lights the figure (PMREM) and paints the backdrop, so they always agree.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { useEffect, useRef } from "react";

export const ENVS = {
  dawn:  { name: "Dawn Meadow",  elevation: 7,  azimuth: 200, turbidity: 8,  rayleigh: 2.5, mie: 0.03,  ground: "#56663c", sky: "#e2c4a0", exposure: 0.4,  sun: 2.6, sunColor: "#ffd9b0", fill: 0.5 },
  noon:  { name: "High Noon",    elevation: 48, azimuth: 175, turbidity: 3,  rayleigh: 1.0, mie: 0.005, ground: "#4b7638", sky: "#cfe1f2", exposure: 0.4,  sun: 3.0, sunColor: "#ffffff", fill: 0.7 },
  dusk:  { name: "Ember Dusk",   elevation: 3,  azimuth: 250, turbidity: 10, rayleigh: 3.0, mie: 0.05,  ground: "#3e3947", sky: "#c9785a", exposure: 0.6,  sun: 2.0, sunColor: "#ffb07a", fill: 0.5 },
  night: { name: "Moonlit",      elevation: 18, azimuth: 30,  turbidity: 1,  rayleigh: 0.04, mie: 0.0008, ground: "#232a3d", sky: "#1a2238", exposure: 0.22, sun: 1.6, sunColor: "#a9bdff", fill: 1.0 },
};

export default function Stage({ url, env = "dawn", onReady, onHandle }) {
  const ref = useRef(null), api = useRef(null);
  useEffect(() => {
    const host = ref.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 3000);
    camera.position.set(0, 1.4, 5.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { target: new THREE.Vector3(0, 0.9, 0), enablePan: false, enableDamping: true, minDistance: 2, maxDistance: 8, minPolarAngle: 0.6, maxPolarAngle: 1.65, autoRotate: true, autoRotateSpeed: 0.8 });
    controls.addEventListener("start", () => { controls.autoRotate = false; });

    const sky = new Sky(); sky.scale.setScalar(1000);
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005;
    Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: 1, far: 30 });
    const fill = new THREE.HemisphereLight(0xffffff, 0x223322, 1);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.18, 0.22, 64), new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.92 }));
    plinth.position.y = -0.11; plinth.receiveShadow = true; plinth.castShadow = true;
    // The ground is a disc that fades to nothing at its rim, so the sky takes over with no horizon seam.
    const fade = document.createElement("canvas"); fade.width = fade.height = 256;
    const g2d = fade.getContext("2d"), grad = g2d.createRadialGradient(128, 128, 20, 128, 128, 128);
    grad.addColorStop(0, "#fff"); grad.addColorStop(0.55, "#fff"); grad.addColorStop(1, "#000");
    g2d.fillStyle = grad; g2d.fillRect(0, 0, 256, 256);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, alphaMap: new THREE.CanvasTexture(fade) }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.22; ground.receiveShadow = true;
    scene.add(sky, sun, fill, plinth, ground);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const setEnv = (key) => {
      const e = ENVS[key] || ENVS.dawn, u = sky.material.uniforms;
      const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - e.elevation), THREE.MathUtils.degToRad(e.azimuth));
      u.sunPosition.value.copy(dir); u.turbidity.value = e.turbidity; u.rayleigh.value = e.rayleigh; u.mieCoefficient.value = e.mie; u.mieDirectionalG.value = 0.8;
      scene.environment?.dispose();
      scene.environment = pmrem.fromScene(new THREE.Scene().add(sky.clone()), 0, 0.1, 100).texture;
      sun.position.copy(dir).multiplyScalar(20); sun.intensity = e.sun; sun.color.set(e.sunColor);
      fill.intensity = e.fill; fill.color.set(e.sky);
      ground.material.color.set(e.ground);
      renderer.toneMappingExposure = e.exposure;
    };
    setEnv(env);

    let mixer = null, figure = null;
    new GLTFLoader().load(url, (gltf) => {
      figure = gltf.scene;
      figure.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(figure), size = box.getSize(new THREE.Vector3());
      figure.scale.setScalar(1.8 / size.y);
      box.setFromObject(figure);
      const c = box.getCenter(new THREE.Vector3());
      figure.position.set(-c.x, -box.min.y, -c.z);
      scene.add(figure);
      if (gltf.animations.length) { mixer = new THREE.AnimationMixer(figure); mixer.clipAction(gltf.animations[0]).play(); }
      onReady?.();
    }, undefined, () => onReady?.(new Error("The figure would not load.")));

    const clock = new THREE.Clock();
    let raf = 0;
    const size = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 44 : 32; camera.updateProjectionMatrix(); };
    const loop = () => { raf = requestAnimationFrame(loop); if (document.hidden) return; mixer?.update(clock.getDelta()); controls.update(); renderer.render(scene, camera); };
    const ro = new ResizeObserver(size); ro.observe(host); size(); loop();

    api.current = {
      setEnv,
      snapshot: () => new Promise((ok) => { renderer.render(scene, camera); renderer.domElement.toBlob(ok, "image/jpeg", 0.92); }),
    };
    onHandle?.(api.current);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); pmrem.dispose(); scene.environment?.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { Object.values(x).forEach((v) => v?.isTexture && v.dispose()); x.dispose(); }); });
      renderer.dispose(); host.removeChild(renderer.domElement); api.current = null;
    };
  }, [url]);
  useEffect(() => { api.current?.setEnv(env); }, [env]);
  return <div ref={ref} style={{ position: "absolute", inset: 0 }} />;
}
