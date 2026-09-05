import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const MOODS = {
  dawn: { sky: 0x5d88b1, horizon: 0xeac99c, fog: 0x9aafbd, sun: 0xffcd8c, power: 4.7, ambient: 0.82, exposure: 1.02, haze: 0.024 },
  noon: { sky: 0x779cbb, horizon: 0xcbd9d9, fog: 0x9eb5bf, sun: 0xfff1d1, power: 4.1, ambient: 1.5, exposure: 0.9, haze: 0.018 },
  dusk: { sky: 0x737d9b, horizon: 0xdba889, fog: 0x9b98a5, sun: 0xffb079, power: 2.6, ambient: 0.95, exposure: 0.98, haze: 0.027 },
  night: { sky: 0x101d35, horizon: 0x465c77, fog: 0x354b64, sun: 0xa8caff, power: 1.05, ambient: 0.7, exposure: 1.08, haze: 0.033 },
};

/** A fixed-view woodland diorama. The caller owns the camera and character. */
export function createWoodland(scene, renderer) {
  const group = new THREE.Group();
  group.name = "Woodland overlook";
  scene.add(group);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const previous = { fog: scene.fog, environment: scene.environment, exposure: renderer.toneMappingExposure };
  const fog = new THREE.FogExp2(0xa4b3b6, 0.023);
  scene.fog = fog;
  let disposed = false, seed = 192837, currentMood = null, ownedEnvironment = null, ownedExposure = null;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const between = (a, b) => a + random() * (b - a);
  const geometry = (value) => { geometries.add(value); return value; };
  const material = (value) => { materials.add(value); return value; };
  const standard = (options) => material(new THREE.MeshStandardMaterial(options));
  const place = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), euler = new THREE.Euler();
  const color = new THREE.Color();
  const instance = (mesh, index, x, y, z, sx, sy, sz, angle = 0, lean = 0) => {
    position.set(x, y, z); scale.set(sx, sy, sz);
    euler.set(lean, angle, 0); quaternion.setFromEuler(euler);
    matrix.compose(position, quaternion, scale); mesh.setMatrixAt(index, matrix);
  };
  const instanced = (geo, mat, count, shadow = true) => {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  };
  const finishInstances = (mesh) => { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); };
  const stone = standard({ color: 0xb9b6a2, roughness: 0.94, normalScale: new THREE.Vector2(0.6, 0.6) });
  const rockMaterial = standard({ color: 0x858b7b, roughness: 1, normalScale: new THREE.Vector2(0.85, 0.85) });
  const groundMaterial = standard({ color: 0x777960, roughness: 1, normalScale: new THREE.Vector2(0.65, 0.65) });
  const bark = standard({ color: 0xaca38c, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9) });
  const bronze = standard({ color: 0x8e8657, roughness: 0.82, metalness: 0.28 });
  const darkStone = standard({ color: 0x626953, roughness: 1 });

  // All heights meet the hero's soles at y=0; the sculpted earth falls away behind the terrace.
  const terrainHeight = (x, z) => {
    const r = Math.hypot(x, z);
    const edge = Math.max(0, r - 1.75);
    const valley = Math.max(0, -z - 4) * 0.29;
    return -0.18 - valley + Math.min(edge, 2) * 0.045 * (Math.sin(x * 1.8 + z) + Math.cos(z * 2.4));
  };
  const terrain = geometry(new THREE.PlaneGeometry(30, 38, 100, 110));
  terrain.rotateX(-Math.PI / 2); terrain.translate(0, 0, -9);
  const terrainPositions = terrain.attributes.position;
  for (let i = 0; i < terrainPositions.count; i++) {
    terrainPositions.setY(i, terrainHeight(terrainPositions.getX(i), terrainPositions.getZ(i)));
    terrain.attributes.uv.setXY(i, terrainPositions.getX(i) / 2.8, terrainPositions.getZ(i) / 2.8);
  }
  terrain.computeVertexNormals(); place(terrain, groundMaterial, 0, 0, 0, false);

  const slabParts = [], inlayParts = [];
  const wedge = (inner, outer, start, end, depth, bevel) => {
    const shape = new THREE.Shape(), steps = Math.max(5, Math.ceil((end - start) * 18));
    for (let i = 0; i <= steps; i++) {
      const a = start + (end - start) * i / steps;
      const x = Math.cos(a) * outer, y = Math.sin(a) * outer;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const a = start + (end - start) * i / steps;
      shape.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
    }
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, steps: 1, curveSegments: 8 });
    result.rotateX(-Math.PI / 2); result.translate(0, -depth - bevel, 0);
    return result;
  };
  // Three staggered courses, chipped joints and a recessed compass rose—not a primitive plinth.
  for (let ring = 0; ring < 3; ring++) {
    const inner = [0.015, 0.64, 1.25][ring], outer = [0.61, 1.22, 1.68][ring];
    const count = [8, 16, 22][ring];
    for (let i = 0; i < count; i++) {
      const start = (i + ring * 0.31) / count * Math.PI * 2;
      const broken = ring === 2 && (i === 3 || i === 12 || i === 18);
      const gap = ring === 0 ? 0.011 : between(0.017, 0.038);
      const radius = outer - (ring === 2 ? between(0.015, broken ? 0.27 : 0.11) : between(0, 0.018));
      const sink = ring === 2 ? between(0.006, broken ? 0.1 : 0.032) : 0;
      const part = wedge(inner, radius, start + gap, start + Math.PI * 2 / count - gap, 0.135, 0.014);
      part.translate(0, -sink, 0); slabParts.push(part);
      if (ring === 2 && !broken) {
        const trim = wedge(1.45, 1.46, start + 0.05, start + Math.PI * 2 / count - 0.05, 0.006, 0);
        trim.translate(0, -sink, 0); inlayParts.push(trim);
      }
    }
  }
  const merge = (parts) => { const result = geometry(mergeGeometries(parts, false)); for (const part of parts) part.dispose(); return result; };
  place(merge(slabParts), stone);
  const inlay = place(merge(inlayParts), bronze); inlay.position.y = 0.003;
  const compassParts = [];
  for (let i = 0; i < 8; i++) {
    const shape = new THREE.Shape();
    const long = i % 2 === 0 ? 0.53 : 0.38;
    shape.moveTo(0, long); shape.lineTo(0.055, 0.13); shape.lineTo(0, 0.04); shape.lineTo(-0.055, 0.13); shape.closePath();
    const part = new THREE.ShapeGeometry(shape); part.rotateX(-Math.PI / 2); part.rotateY(i * Math.PI / 4); part.translate(0, 0.002, 0); compassParts.push(part);
  }
  place(merge(compassParts), bronze, 0, 0, 0, false);

  // Layered weathered rock: smoothly displaced, high enough resolution to read as eroded stone.
  const makeRock = (variant) => {
    const geo = new THREE.SphereGeometry(1, 22, 15), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const displacement = 1 + 0.12 * Math.sin(x * 6 + variant) * Math.cos(z * 5 - y * 4) + 0.08 * Math.sin(y * 11 + z * 3 + variant);
      p.setXYZ(i, x * displacement, y * displacement * 0.8, z * displacement);
    }
    geo.computeVertexNormals(); return geometry(geo);
  };
  const rockGeometries = [makeRock(0), makeRock(2), makeRock(5)];
  for (let variant = 0; variant < 3; variant++) {
    const rocks = instanced(rockGeometries[variant], rockMaterial, 24);
    for (let i = 0; i < 24; i++) {
      const cliff = i < 12;
      const x = cliff ? between(2.15, 4.9) : between(-5.6, 5.6);
      const z = cliff ? between(-4.8, -0.8) : between(-8, -3.8);
      const s = cliff ? between(0.43, 1.15) : between(0.16, 0.65);
      const y = cliff ? terrainHeight(x, z) + s * 0.46 + Math.max(0, x - 2.1) * 0.4 : terrainHeight(x, z) + s * 0.22;
      instance(rocks, i, x, y, z, s, s * between(0.7, 1.35), s * between(0.8, 1.4), between(0, 6.28));
      color.setHSL(between(0.13, 0.19), between(0.07, 0.16), between(0.58, 0.9)); rocks.setColorAt(i, color);
    }
    finishInstances(rocks);
  }
  const rubble = instanced(rockGeometries[0], stone, 65);
  for (let i = 0; i < 65; i++) {
    const a = between(0, Math.PI * 2), r = between(1.82, 3.1), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = between(0.035, 0.13);
    instance(rubble, i, x, terrainHeight(x, z) + s * 0.3, z, s * 1.6, s * 0.65, s, between(0, 6.28));
  }
  finishInstances(rubble);

  // A broken druidic gateway, constructed from individual dressed voussoirs and fluted piers.
  const archParts = [];
  const archX = -1.95, archZ = -3.8;
  const block = (w, h, d, x, y, z, rotation = 0) => {
    const shape = new THREE.Shape();
    const chamfer = Math.min(w, h) * 0.065;
    shape.moveTo(-w / 2 + chamfer, -h / 2); shape.lineTo(w / 2 - chamfer, -h / 2);
    shape.lineTo(w / 2, -h / 2 + chamfer); shape.lineTo(w / 2, h / 2 - chamfer);
    shape.lineTo(w / 2 - chamfer, h / 2); shape.lineTo(-w / 2 + chamfer, h / 2);
    shape.lineTo(-w / 2, h / 2 - chamfer); shape.lineTo(-w / 2, -h / 2 + chamfer); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, steps: 1 });
    geo.translate(0, 0, -d / 2); geo.rotateZ(rotation); geo.translate(x, y, z); return geo;
  };
  for (const side of [-1, 1]) {
    const x = archX + side * 0.76;
    const courses = side === -1 ? 6 : 4;
    archParts.push(block(0.64, 0.2, 0.63, x, -0.04, archZ));
    for (let i = 0; i < courses; i++) archParts.push(block(i === 0 ? 0.5 : 0.4, 0.3, 0.43, x + Math.sin(i * 2) * 0.012, 0.2 + i * 0.31, archZ));
    if (side === -1) archParts.push(block(0.62, 0.16, 0.62, x, 1.99, archZ));
  }
  for (let i = 0; i < 11; i++) {
    const a = Math.PI - i * 0.19;
    archParts.push(block(0.24, 0.36, 0.45, archX + Math.cos(a) * 0.77, 2.02 + Math.sin(a) * 0.77, archZ, a - Math.PI / 2));
  }
  place(merge(archParts), stone);
  const fallen = place(geometry(block(0.45, 1.02, 0.4, 0, 0, 0)), stone, -1.96, 0.12, -2.6);
  fallen.rotation.set(0.3, -0.38, 1.28);
  const runeParts = [];
  for (let i = 0; i < 5; i++) {
    const x = archX - 0.76, y = 0.45 + i * 0.26;
    const points = [new THREE.Vector3(x, y - 0.055, archZ + 0.235), new THREE.Vector3(x - 0.055, y, archZ + 0.235), new THREE.Vector3(x, y + 0.075, archZ + 0.235), new THREE.Vector3(x + 0.055, y, archZ + 0.235), new THREE.Vector3(x, y - 0.055, archZ + 0.235)];
    runeParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.007, 4, false));
  }
  place(merge(runeParts), darkStone, 0, 0, 0, false);

  const wind = { value: 0 };
  const foliageMaterial = (tint, strength) => {
    const mat = standard({ color: tint, roughness: 0.88, side: THREE.DoubleSide, alphaTest: 0.42, transparent: false });
    // Identical object-space displacement is applied to both the lit and shadow passes.
    const inject = (shader) => {
      shader.uniforms.woodlandTime = wind;
      shader.vertexShader = `uniform float woodlandTime;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 windOrigin = vec3(0.0);
        #ifdef USE_INSTANCING
          windOrigin = instanceMatrix[3].xyz;
        #endif
        float bend = uv.y * uv.y;
        float gust = sin(woodlandTime * 1.13 + windOrigin.x * 1.7 + windOrigin.z * 0.83);
        transformed.x += (gust + 0.35 * sin(woodlandTime * 2.4 + position.y * 4.0 + windOrigin.z)) * bend * ${strength.toFixed(3)};
        transformed.z += cos(woodlandTime * 0.81 + windOrigin.x) * bend * ${(strength * 0.38).toFixed(3)};`);
    };
    mat.onBeforeCompile = inject; mat.customProgramCacheKey = () => `woodland-wind-${strength}`;
    const depth = material(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.42, side: THREE.DoubleSide }));
    depth.onBeforeCompile = inject; depth.customProgramCacheKey = mat.customProgramCacheKey;
    return { mat, depth };
  };
  const leaves = foliageMaterial(0xabb979, 0.085), fern = foliageMaterial(0x9baa73, 0.065), flowers = foliageMaterial(0xd0b5d4, 0.045);
  const bladeMaterial = foliageMaterial(0x737e49, 0.07);
  const sprig = geometry(new THREE.PlaneGeometry(1, 1, 2, 5)); sprig.translate(0, 0.5, 0);
  const foliageMeshes = [];
  const foliageInstances = (type, count, geo = sprig, cast = true) => {
    const mesh = instanced(geo, type.mat, count, cast); mesh.customDepthMaterial = type.depth; foliageMeshes.push(mesh); return mesh;
  };

  // Curved tapering limbs have cylindrical bark UVs; roots and secondary forks are merged.
  const treeParts = [], canopy = [];
  const limb = (points, radius, endRadius, segments = 16) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(segments, false), vertices = [], normals = [], uvs = [], indices = [];
    const center = new THREE.Vector3(), offset = new THREE.Vector3();
    const sides = 10, length = curve.getLength();
    for (let i = 0; i <= segments; i++) {
      curve.getPointAt(i / segments, center);
      const r = THREE.MathUtils.lerp(radius, endRadius, Math.pow(i / segments, 0.8));
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2;
        offset.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
        const ridge = 1 + 0.055 * Math.sin(j * 3 + i * 0.7);
        vertices.push(center.x + offset.x * r * ridge, center.y + offset.y * r * ridge, center.z + offset.z * r * ridge);
        normals.push(offset.x, offset.y, offset.z); uvs.push(j / sides * 1.8, i / segments * length * 0.85);
        if (i < segments && j < sides) { const a0 = i * (sides + 1) + j, b = a0 + sides + 1; indices.push(a0, b, a0 + 1, b, b + 1, a0 + 1); }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices);
    treeParts.push(geo);
  };
  const trees = [[-2.9, -1.5, 4.4, 0.34], [2.75, -2.4, 4.8, 0.4], [-4.2, -5.7, 5.7, 0.38], [4.5, -7.5, 6.2, 0.42], [-6.4, -12, 7.1, 0.38], [6.7, -13, 7.2, 0.4]];
  for (const [x, z, height, radius] of trees) {
    const sign = Math.sign(x), base = terrainHeight(x, z), bend = -sign * between(0.35, 0.8);
    limb([[x, base - 0.04, z], [x + sign * 0.16, base + height * 0.28, z + 0.1], [x + bend * 0.5, base + height * 0.64, z - 0.12], [x + bend, base + height, z - 0.2]], radius, 0.065, 24);
    for (let root = 0; root < 6; root++) {
      const a = root / 6 * Math.PI * 2, reach = between(0.5, 1.1);
      limb([[x, base + 0.32, z], [x + Math.cos(a) * reach * 0.45, base + 0.08, z + Math.sin(a) * reach * 0.45], [x + Math.cos(a) * reach, terrainHeight(x + Math.cos(a) * reach, z + Math.sin(a) * reach) + 0.015, z + Math.sin(a) * reach]], radius * 0.4, 0.012, 8);
    }
    for (let b = 0; b < 7; b++) {
      const startY = base + height * between(0.52, 0.86), startX = x + bend * (startY - base) / height;
      const a = b * 2.4, reach = between(0.75, 1.8), tipX = startX + Math.cos(a) * reach;
      const tipY = startY + between(0.45, 1.25), tipZ = z + Math.sin(a) * reach;
      limb([[startX, startY, z], [startX + Math.cos(a) * reach * 0.4, startY + 0.25, z + Math.sin(a) * reach * 0.3], [tipX, tipY, tipZ]], radius * 0.34, 0.016, 12);
      for (let twig = 0; twig < 3; twig++) {
        const tx = tipX + between(-0.6, 0.6), ty = tipY + between(0.1, 0.55), tz = tipZ + between(-0.5, 0.5);
        limb([[tipX, tipY, tipZ], [tx, ty, tz]], 0.022, 0.004, 5);
        canopy.push([tx, ty, tz]);
      }
    }
  }
  // This real overhead bough intercepts the key light, casting moving leaf-shaped dapples.
  limb([[-2.9, 2.55, -1.5], [-2.6, 3.22, -0.25], [-1.8, 3.72, 1.7]], 0.11, 0.024, 18);
  for (let twig = 0; twig < 12; twig++) {
    const x = between(-2.8, -1.05), y = between(3.45, 4), z = between(0.55, 2.2);
    limb([[-2.2, 3.5, 0.9], [x, y, z]], 0.028, 0.004, 6); canopy.push([x, y, z]);
  }
  place(merge(treeParts), bark);
  const crown = foliageInstances(leaves, canopy.length * 7);
  let crownIndex = 0;
  for (const [x, y, z] of canopy) {
    for (let i = 0; i < 7; i++) {
      const s = between(0.55, 1.05);
      instance(crown, crownIndex, x + between(-0.42, 0.42), y + between(-0.35, 0.18), z + between(-0.4, 0.4), s, s * 0.72, s, between(0, 6.28), between(-0.5, 0.5));
      color.setHSL(between(0.17, 0.24), between(0.24, 0.42), between(0.65, 0.95)); crown.setColorAt(crownIndex++, color);
    }
  }
  finishInstances(crown);
  const botanical = (type, count, minSize, maxSize, bias = 0) => {
    const mesh = foliageInstances(type, count);
    for (let i = 0; i < count; i++) {
      let x, z;
      do { x = between(-6.3, 6.3); z = between(-9, 2.65); } while (Math.hypot(x, z) < 1.84 || (Math.abs(x) < 0.95 && z > -3) || (z > 0.65 && Math.abs(x) < 1.75));
      const s = between(minSize, maxSize), y = terrainHeight(x, z);
      instance(mesh, i, x, y - 0.015, z, s * (1 + bias), s, s, between(-Math.PI, Math.PI), between(-0.09, 0.09));
      color.setHSL(between(0.13, 0.19), between(0.08, 0.23), between(0.68, 1)); mesh.setColorAt(i, color);
    }
    finishInstances(mesh); return mesh;
  };
  botanical(fern, 420, 0.23, 0.69, 0.2);
  botanical(flowers, 230, 0.18, 0.49);
  botanical(leaves, 280, 0.32, 0.83);
  const grassParts = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399, h = between(0.35, 0.85), width = between(0.012, 0.024), bend = between(0.08, 0.22);
    const positions = [], uv = [], indices = [];
    for (let j = 0; j <= 4; j++) {
      const t = j / 4, taper = (1 - t) * width;
      for (const side of [-1, 1]) { positions.push(Math.cos(a) * (bend * t * t + side * taper), t * h, Math.sin(a) * (bend * t * t + side * taper)); uv.push((side + 1) / 2, t); }
      if (j < 4) { const n = j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); grassParts.push(geo);
  }
  const grasses = foliageInstances(bladeMaterial, 650, merge(grassParts), false);
  for (let i = 0; i < 650; i++) {
    let x, z;
    do { x = between(-7, 7); z = between(-10, 3); } while (Math.hypot(x, z) < 1.77 || (Math.abs(x) < 0.95 && z > -3) || (z > 0.65 && Math.abs(x) < 1.75));
    const s = between(0.22, 0.62); instance(grasses, i, x, terrainHeight(x, z), z, s, s, s, between(0, 6.28));
    color.setHSL(between(0.14, 0.23), between(0.2, 0.38), between(0.45, 0.8)); grasses.setColorAt(i, color);
  }
  finishInstances(grasses);

  // Overlapping ridges have actual depth; fog, not a flat painted horizon, separates the layers.
  for (let layer = 0; layer < 5; layer++) {
    const distance = 22 + layer * 15, width = 42 + layer * 19;
    const geo = new THREE.PlaneGeometry(width, 13, 140, 20); const p = geo.attributes.position;
    const shades = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = (p.getY(i) + 6.5) / 13;
      const ridge = 2.1 + layer * 0.65 + 1.3 * Math.sin(x * 0.16 + layer * 2) + 0.62 * Math.sin(x * 0.39 + layer) + 0.24 * Math.sin(x * 0.93) + 0.14 * Math.sin(x * 2.3 + layer * 4);
      const valley = Math.exp(-x * x / 90) * 2.1;
      const fold = Math.sin(x * 0.47 + layer * 2) * 2.8 + Math.sin(x * 1.13 + layer) * 0.65;
      p.setXYZ(i, x, -10 + t * (10 + ridge - valley), -distance + Math.sin(x * 0.2) * 1.5 + (1 - t) * (7 + fold));
      color.setHSL(0.56 - (1 - t) * 0.04, 0.18, 0.45 + t * 0.22 + Math.sin(x * 0.47 + layer * 2) * 0.065);
      color.toArray(shades, i * 3);
    }
    geo.computeVertexNormals();
    geo.setAttribute("color", new THREE.BufferAttribute(shades, 3));
    const mat = standard({ color: new THREE.Color().setHSL(0.57, 0.15, 0.48 + layer * 0.035), vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    place(geometry(geo), mat, 0, 0, 0, false);
  }
  // Fine, original botanical silhouettes preserve a lacy treeline without hundreds of full trees.
  const forestCanvas = document.createElement("canvas"); forestCanvas.width = 512; forestCanvas.height = 768;
  const forestContext = forestCanvas.getContext("2d");
  const drawBranch = (x, y, length, angle, width, depth) => {
    const endX = x + Math.cos(angle) * length, endY = y + Math.sin(angle) * length;
    forestContext.strokeStyle = "#536558"; forestContext.lineWidth = width; forestContext.lineCap = "round";
    forestContext.beginPath(); forestContext.moveTo(x, y);
    forestContext.quadraticCurveTo(x + Math.cos(angle + 0.12) * length * 0.55, y + Math.sin(angle + 0.12) * length * 0.55, endX, endY); forestContext.stroke();
    if (depth > 0) {
      drawBranch(endX, endY, length * between(0.62, 0.76), angle - between(0.24, 0.58), width * 0.65, depth - 1);
      drawBranch(endX, endY, length * between(0.61, 0.77), angle + between(0.24, 0.58), width * 0.65, depth - 1);
    }
    if (depth < 3) {
      for (let leaf = 0; leaf < 65; leaf++) {
        const a = between(0, 6.28), r = Math.sqrt(random()) * (depth + 1) * 11;
        forestContext.fillStyle = `hsl(${between(112, 151)}, ${between(14, 27)}%, ${between(28, 47)}%)`;
        forestContext.beginPath(); forestContext.ellipse(endX + Math.cos(a) * r, endY + Math.sin(a) * r * 0.65, between(1.2, 3.5), between(1.5, 3.8), a, 0, Math.PI * 2); forestContext.fill();
      }
    }
  };
  drawBranch(256, 761, 210, -Math.PI / 2, 17, 7);
  const forestTexture = new THREE.CanvasTexture(forestCanvas); forestTexture.colorSpace = THREE.SRGBColorSpace; textures.add(forestTexture);
  const distantMaterial = standard({ map: forestTexture, color: 0x9bafc8, roughness: 1, side: THREE.DoubleSide, alphaTest: 0.42 });
  const distant = instanced(sprig, distantMaterial, 260, false);
  for (let i = 0; i < 260; i++) {
    const x = between(-23, 23), z = between(-39, -15), s = between(1.2, 3.7);
    const hollow = Math.exp(-x * x / 28) * 1.35;
    instance(distant, i, x, terrainHeight(x, z) - 0.3 - hollow, z, s, s * between(1.25, 1.8), s, between(-0.3, 0.3));
    color.setHSL(between(0.52, 0.6), between(0.12, 0.22), between(0.64, 0.96)); distant.setColorAt(i, color);
  }
  finishInstances(distant);

  const skyUniforms = {
    topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() }, sunDirection: { value: new THREE.Vector3(-0.6, 0.38, -1).normalize() },
    time: wind, sunStrength: { value: 1 },
  };
  const skyMaterial = material(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms,
    vertexShader: `varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDirection;
      uniform vec3 topColor, horizonColor, sunColor, sunDirection;
      uniform float time, sunStrength;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 d = normalize(vDirection);
        float altitude = max(d.y, 0.0);
        vec3 c = mix(horizonColor, topColor, pow(clamp(altitude * 2.7, 0.0, 1.0), 0.42));
        vec2 p = d.xz / max(0.16, d.y + 0.3) * vec2(2.8, 5.2) + vec2(time * 0.003, time * 0.001);
        float clouds = noise(p) * 0.51 + noise(p * 2.1) * 0.27 + noise(p * 4.4) * 0.14 + noise(p * 8.7) * 0.08;
        float veil = smoothstep(0.43, 0.69, clouds) * smoothstep(-0.035, 0.095, d.y) * 0.72;
        c = mix(c, horizonColor * 1.24, veil);
        float sun = max(dot(d, sunDirection), 0.0);
        c += sunColor * (pow(sun, 26.0) * 0.23 + pow(sun, 450.0) * 1.3) * sunStrength;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const skyGeometry = geometry(new THREE.SphereGeometry(200, 32, 16));
  const sky = place(skyGeometry, skyMaterial, 0, 0, 0, false); sky.receiveShadow = false; sky.renderOrder = -10;
  const environmentScene = new THREE.Scene();
  const environmentSky = new THREE.Mesh(skyGeometry, skyMaterial); environmentScene.add(environmentSky);
  const pmrem = new THREE.PMREMGenerator(renderer), environments = new Map();

  const sun = new THREE.DirectionalLight(0xffd4a0, 3.5); sun.position.set(-6, 9, 5);
  sun.target.position.set(0, 0.6, -0.5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -5, near: 0.5, far: 25 });
  sun.shadow.camera.updateProjectionMatrix();
  const hemisphere = new THREE.HemisphereLight(0xd3e5ed, 0x4a4935, 1.15);
  const faceFill = new THREE.DirectionalLight(0xc7e0fa, 0.65); faceFill.position.set(1.8, 3.4, 5.5); faceFill.target.position.set(0, 1.05, 0);
  const rim = new THREE.DirectionalLight(0xffd7a2, 0.7); rim.position.set(-3.5, 4, -4);
  group.add(sun, sun.target, hemisphere, faceFill, faceFill.target, rim);
  // A subtle radial occlusion bed supports real directional contact shadows at the feet.
  const shadowGeometry = geometry(new THREE.PlaneGeometry(1.05, 0.78)); shadowGeometry.rotateX(-Math.PI / 2);
  const shadowMaterial = material(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    uniforms: {}, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; void main() { float r = length((vUv - 0.5) * 2.0); gl_FragColor = vec4(0.055, 0.062, 0.049, (1.0 - smoothstep(0.0, 1.0, r)) * 0.19); }`,
  }));
  place(shadowGeometry, shadowMaterial, 0, 0.004, 0, false);

  const motePositions = new Float32Array(100 * 3), moteSeeds = new Float32Array(100);
  for (let i = 0; i < 100; i++) { motePositions[i * 3] = between(-4.5, 4.5); motePositions[i * 3 + 1] = between(0.15, 4.1); motePositions[i * 3 + 2] = between(-5, 1.8); moteSeeds[i] = random(); }
  const moteGeometry = geometry(new THREE.BufferGeometry()); moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3)); moteGeometry.setAttribute("seed", new THREE.BufferAttribute(moteSeeds, 1));
  const moteMaterial = material(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: wind, tint: { value: new THREE.Color(0xeedda8) }, strength: { value: 0.32 } },
    vertexShader: `attribute float seed; uniform float time; varying float vAlpha;
      void main() { vec3 p = position; p.x += sin(time * 0.13 + seed * 41.0) * 0.22; p.y += sin(time * 0.19 + seed * 17.0) * 0.2; p.z += cos(time * 0.12 + seed * 23.0) * 0.17;
      vec4 view = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * view; gl_PointSize = clamp(13.0 / -view.z, 1.0, 3.2); vAlpha = 0.3 + 0.7 * pow(sin(time * 0.3 + seed * 32.0) * 0.5 + 0.5, 3.0); }`,
    fragmentShader: `uniform vec3 tint; uniform float strength; varying float vAlpha; void main() { float a = 1.0 - smoothstep(0.05, 0.5, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(tint, a * vAlpha * strength); #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }`.replace("; #include", ";\n #include"),
  }));
  const motes = new THREE.Points(moteGeometry, moteMaterial); motes.frustumCulled = false; group.add(motes);

  function setMood(key) {
    if (disposed) return;
    const next = Object.hasOwn(MOODS, key) ? key : "dawn";
    if (next === currentMood) return;
    const mood = MOODS[next];
    skyUniforms.topColor.value.setHex(mood.sky); skyUniforms.horizonColor.value.setHex(mood.horizon);
    skyUniforms.sunColor.value.setHex(mood.sun); skyUniforms.sunStrength.value = next === "night" ? 0.25 : 1;
    fog.color.setHex(mood.fog); fog.density = mood.haze;
    sun.color.setHex(mood.sun); sun.intensity = mood.power;
    hemisphere.color.setHex(next === "night" ? 0x94b4dc : 0xc9e0ef); hemisphere.intensity = mood.ambient;
    hemisphere.groundColor.setHex(next === "night" ? 0x242b35 : 0x4a4935);
    faceFill.intensity = next === "night" ? 2.2 : 0.65;
    rim.color.setHex(mood.sun); rim.intensity = next === "night" ? 0.45 : 0.7;
    moteMaterial.uniforms.strength.value = next === "night" ? 0.65 : 0.28;
    moteMaterial.uniforms.tint.value.setHex(next === "night" ? 0xb6e7b2 : 0xeedda8);
    if (!environments.has(next)) environments.set(next, pmrem.fromScene(environmentScene, 0.06, 0.1, 300));
    ownedEnvironment = environments.get(next).texture; scene.environment = ownedEnvironment;
    ownedExposure = mood.exposure; renderer.toneMappingExposure = ownedExposure;
    currentMood = next;
  }

  const loader = new THREE.TextureLoader();
  const base = `${import.meta.env.BASE_URL}environments/woodland/`;
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loadTexture = (name, srgb, targets, slot, tile) => new Promise((resolve, reject) => {
    const pending = loader.load(`${base}${name}`, (texture) => {
      if (disposed) { texture.dispose(); resolve(); return; }
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = anisotropy;
      if (tile) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; }
      for (const target of targets) { target[slot] = texture; target.needsUpdate = true; }
      resolve();
    }, undefined, () => {
      pending.dispose(); textures.delete(pending);
      reject(new Error(`Woodland texture failed to load: ${base}${name}`));
    });
    textures.add(pending);
  });
  const ready = Promise.all([
    loadTexture("stone-color.webp", true, [stone, rockMaterial], "map", true),
    loadTexture("stone-normal.webp", false, [stone, rockMaterial], "normalMap", true),
    loadTexture("ground-color.webp", true, [groundMaterial], "map", true),
    loadTexture("ground-normal.webp", false, [groundMaterial], "normalMap", true),
    loadTexture("bark-color.webp", true, [bark], "map", true),
    loadTexture("bark-normal.webp", false, [bark], "normalMap", true),
    loadTexture("leaves.png", true, [leaves.mat, leaves.depth], "map", false),
    loadTexture("fern.png", true, [fern.mat, fern.depth], "map", false),
    loadTexture("flowers.png", true, [flowers.mat, flowers.depth], "map", false),
  ]).then(() => undefined);

  function dispose() {
    if (disposed) return;
    disposed = true; group.removeFromParent();
    if (scene.fog === fog) scene.fog = previous.fog;
    if (scene.environment === ownedEnvironment) scene.environment = previous.environment;
    if (renderer.toneMappingExposure === ownedExposure) renderer.toneMappingExposure = previous.exposure;
    for (const mesh of foliageMeshes) mesh.dispose();
    group.traverse(object => { if (object.isInstancedMesh && !foliageMeshes.includes(object)) object.dispose(); });
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
    for (const texture of textures) texture.dispose();
    for (const target of environments.values()) target.dispose();
    sun.shadow.dispose(); pmrem.dispose();
    geometries.clear(); materials.clear(); textures.clear(); environments.clear();
  }
  try { setMood("dawn"); } catch (error) { dispose(); throw error; }
  return { ready, update(timeSeconds) { if (!disposed) wind.value = timeSeconds; }, setMood, dispose };
}
