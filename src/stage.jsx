// A fixed woodland composition; inspection turns the figure, never the landscape.
// The renderer is retained when changing models, and all async work is mount-scoped.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { useEffect, useRef } from "react";
import { createWoodland } from "./woodland.js";

export const ENVS = {
  dawn: { name: "Golden hour" },
  noon: { name: "Clear daylight" },
  dusk: { name: "Last light" },
  night: { name: "Moonlit grove" },
};

function disposeFigure(figure) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  figure.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  textures.forEach((value) => { value.dispose(); value.source?.data?.close?.(); });
  skeletons.forEach((value) => value.dispose());
  figure.removeFromParent();
}

export default function Stage({ url, env = "dawn", motion = true, facing = 0, onReady, onHandle }) {
  const hostRef = useRef(null), runtime = useRef(null);
  const callbacks = useRef({ onReady, onHandle });
  callbacks.current = { onReady, onHandle };

  useEffect(() => {
    const host = hostRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      callbacks.current.onReady?.(new Error("WebGL is unavailable. Enable hardware acceleration and reopen the viewer."));
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px;cursor:grab";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "3D character in a woodland overlook. Drag or use left and right arrows to turn. Scroll, pinch, or use plus and minus to zoom. Home resets the view.");
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 500);
    const figurePivot = new THREE.Group();
    scene.add(figurePivot);
    let woodland;
    try { woodland = createWoodland(scene, renderer); }
    catch (error) {
      renderer.dispose(); canvas.remove();
      callbacks.current.onReady?.(error);
      return;
    }
    // Handle rejection immediately, including while the model is still downloading.
    let environmentError = null;
    const environmentReady = woodland.ready.catch((error) => { environmentError = error; });
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const target = new THREE.Vector3();
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false, contextLost = false, figure = null, mixer = null;
    let fullDistance = 5.2, zoom = 0, targetZoom = 0, angle = 0, targetAngle = 0, front = 0;
    let figureWidth = 1.2, elapsed = 0, previousTime = 0, frame = 0;
    let moving = true, visible = true;
    let pending = null;

    const reset = () => { targetAngle = front; targetZoom = 0; };
    const rotateBy = (radians) => { targetAngle += radians; };
    const zoomBy = (amount) => { targetZoom = THREE.MathUtils.clamp(targetZoom + amount, 0, 1); };
    const updateCamera = () => {
      camera.position.set(0, THREE.MathUtils.lerp(1.4, 1.52, zoom), THREE.MathUtils.lerp(fullDistance, 2.05, zoom));
      target.set(0, THREE.MathUtils.lerp(0.9, 1.42, zoom), 0);
      camera.lookAt(target);
    };
    const resize = () => {
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2, Math.sqrt(2400000 / (width * height))));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      fullDistance = Math.max(5.2, figureWidth * 0.72 / (Math.tan(THREE.MathUtils.degToRad(16)) * camera.aspect));
      camera.updateProjectionMatrix(); updateCamera();
    };
    const clearFigure = () => {
      if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(figure); mixer = null; }
      if (figure) { disposeFigure(figure); figure = null; }
    };
    const load = (source) => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      clearFigure(); reset(); angle = front; zoom = 0; figurePivot.rotation.y = front;
      const active = () => !disposed && !controller.signal.aborted;
      const promise = (async () => {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error(`The figure could not be downloaded (HTTP ${response.status}).`);
        const buffer = await response.arrayBuffer();
        if (!active()) return;
        const base = source.startsWith("blob:") ? "" : new URL(".", new URL(source, location.href)).href;
        const gltf = await loader.parseAsync(buffer, base);
        if (!active()) { disposeFigure(gltf.scene); return; }
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        if (!Number.isFinite(size.y) || size.y <= 0) {
          disposeFigure(gltf.scene);
          throw new Error("The file contains no visible, finite-height character geometry.");
        }
        figure = gltf.scene;
        figure.scale.multiplyScalar(1.8 / size.y);
        box.setFromObject(figure);
        const center = box.getCenter(new THREE.Vector3());
        figure.position.x -= center.x;
        figure.position.y -= box.min.y;
        figure.position.z -= center.z;
        figureWidth = box.max.x - box.min.x;
        figure.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = true; object.receiveShadow = true;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (material?.isMeshStandardMaterial) material.envMapIntensity = 0.65;
          }
        });
        figurePivot.add(figure);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(figure);
          mixer.clipAction(gltf.animations[0]).play();
        }
        resize();
        await environmentReady;
        if (!active()) return;
        if (environmentError) throw new Error(`The woodland assets could not load: ${environmentError.message}`);
        callbacks.current.onReady?.();
      })();
      promise.catch((error) => {
        if (active()) callbacks.current.onReady?.(error);
      });
      return () => controller.abort();
    };

    // Pointer capture keeps drags stable outside the canvas. Two pointers control zoom.
    const pointers = new Map();
    let pinchDistance = 0;
    const separation = () => {
      const values = pointers.values(), a = values.next().value, b = values.next().value;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const pointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
      canvas.style.cursor = "grabbing";
      if (pointers.size === 2) pinchDistance = separation();
    };
    const pointerMove = (event) => {
      const point = pointers.get(event.pointerId);
      if (!point) return;
      const dx = event.clientX - point.x;
      point.x = event.clientX; point.y = event.clientY;
      if (pointers.size === 1) rotateBy(dx * 0.009);
      else if (pointers.size === 2) {
        const distance = separation();
        zoomBy((distance - pinchDistance) / Math.max(200, host.clientHeight));
        pinchDistance = distance;
      }
    };
    const pointerUp = (event) => {
      pointers.delete(event.pointerId);
      if (!pointers.size) canvas.style.cursor = "grab";
    };
    const wheel = (event) => {
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
      zoomBy(-pixels * 0.001);
    };
    const keyDown = (event) => {
      switch (event.key) {
        case "ArrowLeft": rotateBy(-0.15); break;
        case "ArrowRight": rotateBy(0.15); break;
        case "+": case "=": zoomBy(0.1); break;
        case "-": case "_": zoomBy(-0.1); break;
        case "Home": reset(); break;
        default: return;
      }
      event.preventDefault();
    };
    const loseContext = (event) => {
      event.preventDefault(); contextLost = true;
      callbacks.current.onReady?.(new Error("The graphics context was lost. Close and reopen the viewer to restore it."));
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("lostpointercapture", pointerUp);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("keydown", keyDown);
    canvas.addEventListener("webglcontextlost", loseContext);
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    intersection.observe(host);

    const render = (time) => {
      frame = requestAnimationFrame(render);
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      if (document.hidden || !visible || contextLost) return;
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 14);
      angle += (targetAngle - angle) * blend;
      zoom += (targetZoom - zoom) * blend;
      figurePivot.rotation.y = angle;
      updateCamera();
      if (moving && !reducedMotion.matches) { elapsed += delta; mixer?.update(delta); }
      woodland.update(elapsed);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(render);
    const handle = {
      reset, rotateBy, zoomBy,
      setFraming: (framing) => { targetZoom = framing === "portrait" ? 1 : 0; },
      setFacing: (radians) => { front = radians; reset(); },
      setEnv: (key) => woodland.setMood(Object.hasOwn(ENVS, key) ? key : "dawn"),
      setMotion: (enabled) => { moving = enabled; },
      snapshot: () => new Promise((resolve, reject) => {
        if (disposed || contextLost) { reject(new Error("The viewer is no longer available.")); return; }
        renderer.render(scene, camera);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The portrait could not be captured.")), "image/jpeg", 0.92);
      }),
    };
    runtime.current = { handle, load };
    callbacks.current.onHandle?.(handle);
    return () => {
      disposed = true; pending?.abort(); cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("lostpointercapture", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyDown);
      canvas.removeEventListener("webglcontextlost", loseContext);
      pointers.clear(); clearFigure(); woodland.dispose();
      renderer.dispose(); canvas.remove(); runtime.current = null;
      callbacks.current.onHandle?.(null);
    };
  }, []);

  useEffect(() => { runtime.current?.handle.setEnv(env); }, [env]);
  useEffect(() => { runtime.current?.handle.setMotion(motion); }, [motion]);
  useEffect(() => { runtime.current?.handle.setFacing(facing); }, [facing]);
  useEffect(() => url ? runtime.current?.load(url) : undefined, [url]);
  return <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />;
}
