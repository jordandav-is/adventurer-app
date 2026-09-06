import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const MOODS = {
  dawn: {
    sun: 0xffd099,
    power: 3.1,
    sky: 0xb8cbd0,
    ambient: 1.1,
    glass: 1.65,
    fog: 0x454239,
    exposure: 1.03,
    beam: 0.2,
  },
  noon: {
    sun: 0xffedce,
    power: 3.7,
    sky: 0xd5e1e5,
    ambient: 1.45,
    glass: 1.9,
    fog: 0x55564f,
    exposure: 0.94,
    beam: 0.17,
  },
  dusk: {
    sun: 0xffaa76,
    power: 1.8,
    sky: 0xb3b9d5,
    ambient: 0.8,
    glass: 1.2,
    fog: 0x3a3238,
    exposure: 1.03,
    beam: 0.15,
  },
  night: {
    sun: 0xa9c7ff,
    power: 0.85,
    sky: 0x849ac6,
    ambient: 0.6,
    glass: 0.65,
    fog: 0x192331,
    exposure: 1.08,
    beam: 0.07,
  },
};

/** Fixed-view Gothic diorama. The caller owns the camera and the character. */
export function createCathedral(scene, renderer) {
  const group = new THREE.Group();
  group.name = "The Cathedral of the Eight";
  scene.add(group);
  const previous = {
    fog: scene.fog,
    background: scene.background,
    environment: scene.environment,
    exposure: renderer.toneMappingExposure,
  };
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set(),
    batches = new Map();
  const fog = new THREE.FogExp2(0x454239, 0.018),
    background = new THREE.Color(0x272d2b);
  scene.fog = fog;
  scene.background = background;
  let disposed = false,
    currentMood = null,
    ownedEnvironment = null,
    ownedExposure = null;
  const environments = new Map();
  let sun = null,
    pmrem = null;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    if (scene.fog === fog) scene.fog = previous.fog;
    if (scene.background === background) scene.background = previous.background;
    if (scene.environment === ownedEnvironment)
      scene.environment = previous.environment;
    if (renderer.toneMappingExposure === ownedExposure)
      renderer.toneMappingExposure = previous.exposure;
    for (const parts of batches.values())
      for (const part of parts) part.dispose();
    geometries.forEach((value) => value.dispose());
    materials.forEach((value) => value.dispose());
    textures.forEach((value) => value.dispose());
    environments.forEach((value) => value.dispose());
    sun?.shadow.dispose();
    pmrem?.dispose();
    batches.clear();
    geometries.clear();
    materials.clear();
    textures.clear();
    environments.clear();
  }
  try {
    let seed = 812734;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const geo = (value) => {
      geometries.add(value);
      return value;
    };
    const mat = (value) => {
      materials.add(value);
      return value;
    };
    const standard = (options) => mat(new THREE.MeshStandardMaterial(options));
    const stone = standard({
      color: 0xcac3ad,
      roughness: 0.86,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });
    const trim = standard({
      color: 0xd4c8a7,
      roughness: 0.8,
      normalScale: new THREE.Vector2(0.32, 0.32),
    });
    const shadowStone = standard({ color: 0x706f61, roughness: 0.95 });
    const bronze = standard({
      color: 0x95825a,
      metalness: 0.62,
      roughness: 0.47,
    });
    const dark = standard({ color: 0x252b29, roughness: 0.85 });
    const banner = standard({ color: 0x632f35, roughness: 1 });
    const floor = standard({
      color: 0xc1c0ac,
      roughness: 0.55,
      normalScale: new THREE.Vector2(0.35, 0.35),
    });
    const door = standard({
      color: 0xbab3a1,
      roughness: 0.67,
      metalness: 0.27,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });
    const glass = standard({
      color: 0xffffff,
      emissive: 0xffdfa7,
      emissiveIntensity: 1.5,
      roughness: 0.65,
      side: THREE.DoubleSide,
      transparent: false,
      alphaTest: 0.3,
    });
    const lancetGlass = glass.clone();
    materials.add(lancetGlass);
    const wax = standard({ color: 0xd6c59f, roughness: 0.82 });
    const flame = mat(
      new THREE.MeshBasicMaterial({ color: 0xffd69a, toneMapped: false }),
    );
    const matrix = new THREE.Matrix4(),
      quaternion = new THREE.Quaternion(),
      position = new THREE.Vector3(),
      scale = new THREE.Vector3(),
      euler = new THREE.Euler();
    // Merge by material after assembly: moldings and masonry stay cheap to render.
    const add = (
      geometry,
      material,
      x = 0,
      y = 0,
      z = 0,
      sx = 1,
      sy = 1,
      sz = 1,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      position.set(x, y, z);
      scale.set(sx, sy, sz);
      euler.set(rx, ry, rz);
      quaternion.setFromEuler(euler);
      matrix.compose(position, quaternion, scale);
      geometry.applyMatrix4(matrix);
      if (material === stone || material === trim) {
        const p = geometry.attributes.position,
          n = geometry.attributes.normal,
          uv = geometry.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const nx = Math.abs(n.getX(i)),
            ny = Math.abs(n.getY(i)),
            nz = Math.abs(n.getZ(i));
          uv.setXY(
            i,
            (nx > nz ? p.getZ(i) : p.getX(i)) * 0.42,
            (ny > Math.max(nx, nz) ? p.getZ(i) : p.getY(i)) * 0.42,
          );
        }
      }
      // Polyhedra are non-indexed; mergeGeometries requires one indexing contract.
      if (!geometry.index) {
        const indices = new Uint32Array(geometry.attributes.position.count);
        for (let i = 0; i < indices.length; i++) indices[i] = i;
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      }
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material).push(geometry);
    };
    const box = (m, x, y, z, w, h, d) =>
      add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    const cylinder = (m, x, y, z, radius, height, top = radius, sides = 12) =>
      add(new THREE.CylinderGeometry(top, radius, height, sides), m, x, y, z);
    const ring = (m, x, y, z, radius, thickness, horizontal = false) =>
      add(
        new THREE.TorusGeometry(radius, thickness, 6, 64),
        m,
        x,
        y,
        z,
        1,
        1,
        1,
        horizontal ? -Math.PI / 2 : 0,
      );
    const line = (m, points, radius = 0.025) => {
      const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
      );
      add(
        new THREE.TubeGeometry(
          curve,
          Math.max(8, Math.min(64, points.length * 8)),
          radius,
          6,
          false,
        ),
        m,
      );
    };
    const arch = (m, x, spring, z, r, thickness) => {
      const points = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        points.push([
          x - r * (1 - t * t),
          spring + r * (1.85 * t - 0.35 * t * t),
          z,
        ]);
      }
      for (let i = 23; i >= 0; i--) {
        const t = i / 24;
        points.push([
          x + r * (1 - t * t),
          spring + r * (1.85 * t - 0.35 * t * t),
          z,
        ]);
      }
      line(m, points, thickness);
    };
    const quatrefoil = (x, y, z, size, material = trim) => {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ring(
          material,
          x + Math.cos(a) * size * 0.48,
          y + Math.sin(a) * size * 0.48,
          z,
          size * 0.48,
          size * 0.1,
        );
      }
    };
    const pinnacle = (x, y, z, height) => {
      cylinder(
        shadowStone,
        x,
        y + height * 0.23,
        z,
        0.13,
        height * 0.46,
        0.11,
        8,
      );
      cylinder(trim, x, y + height * 0.47, z, 0.17, 0.07, 0.17, 8);
      cylinder(trim, x, y + height * 0.72, z, 0.13, height * 0.48, 0, 8);
      for (let k = 0; k < 3; k++)
        for (let j = 0; j < 4; j++) {
          const a = (j * Math.PI) / 2;
          add(
            new THREE.OctahedronGeometry(0.045),
            trim,
            x + Math.cos(a) * (0.105 - k * 0.022),
            y + height * (0.54 + k * 0.12),
            z + Math.sin(a) * (0.105 - k * 0.022),
            1,
            1.8,
            1,
          );
        }
      add(new THREE.SphereGeometry(0.036, 8, 6), bronze, x, y + height, z);
    };

    // A broad sanctuary landing. The hero's soles remain exactly at y=0.
    box(floor, 0, -0.18, -4, 24, 0.34, 32);
    cylinder(shadowStone, 0, -0.16, 0, 2.35, 0.26, 2.35, 96);
    cylinder(floor, 0, -0.055, 0, 2.27, 0.11, 2.27, 96);
    for (const r of [1.65, 1.71, 2.16, 2.2])
      ring(bronze, 0, 0.007, 0, r, 0.008, true);
    // Open-front balustrade around the landing, leaving the figure corridor unobstructed.
    for (const side of [-1, 1]) {
      const rail = [];
      for (let j = 0; j < 10; j++) {
        const a = 0.08 + j * 0.11,
          x = side * 2.45 * Math.cos(a),
          z = -2.45 * Math.sin(a);
        cylinder(trim, x, 0.07, z, 0.105, 0.14, 0.09, 8);
        cylinder(shadowStone, x, 0.36, z, 0.037, 0.45, 0.05, 8);
        cylinder(trim, x, 0.6, z, 0.072, 0.07, 0.072, 8);
        rail.push([x, 0.67, z]);
        if (j === 0 || j === 9) pinnacle(x, 0.68, z, 0.28);
      }
      line(trim, rail, 0.055);
      line(
        bronze,
        rail.map(([x, y, z]) => [x, y + 0.045, z]),
        0.014,
      );
    }
    // Eight inlaid rays, real geometry, around a quiet central character footprint.
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const shape = new THREE.Shape();
      shape.moveTo(Math.cos(a) * 0.64, Math.sin(a) * 0.64);
      shape.lineTo(Math.cos(a + 0.035) * 1.6, Math.sin(a + 0.035) * 1.6);
      shape.lineTo(Math.cos(a) * 2.05, Math.sin(a) * 2.05);
      shape.lineTo(Math.cos(a - 0.035) * 1.6, Math.sin(a - 0.035) * 1.6);
      shape.closePath();
      add(
        new THREE.ShapeGeometry(shape),
        bronze,
        0,
        0.008,
        0,
        1,
        1,
        1,
        -Math.PI / 2,
      );
    }
    // Curved steps ascend behind, never through, the figure.
    for (let i = 0; i < 5; i++) {
      cylinder(
        i % 2 ? stone : trim,
        0,
        -0.03 + i * 0.065,
        -10.7,
        3.5 - i * 0.14,
        0.065,
        3.5 - i * 0.14,
        96,
      );
      ring(bronze, 0, 0.005 + i * 0.065, -10.7, 3.43 - i * 0.14, 0.012, true);
    }
    // Rear wall and nave returns; thick piers articulate depth instead of a wallpaper plane.
    box(stone, 0, 5.5, -13.55, 21, 11, 0.65);
    for (const x of [-9.7, 9.7]) box(stone, x, 5.5, -5, 0.7, 11, 17);
    for (const y of [0.35, 1.85, 4.05, 4.21, 9.0, 9.16, 10.4]) {
      box(trim, 0, y, -13.12, 20, 0.08, 0.2);
      box(shadowStone, 0, y - 0.075, -13.2, 20, 0.045, 0.11);
    }
    const wallZ = -13.14;
    // Oversized eightfold rose: luminous glass behind physical concentric stone and tracery.
    const roseScale = 1.35,
      roseY = 5.85;
    add(
      new THREE.PlaneGeometry(3.64 * roseScale, 3.64 * roseScale),
      glass,
      0,
      roseY,
      wallZ + 0.075,
    );
    for (const [r, t, z, m] of [
      [1.79, 0.095, 0.1, shadowStone],
      [1.85, 0.055, 0.18, trim],
      [1.94, 0.06, 0.13, stone],
      [2.02, 0.028, 0.19, bronze],
      [1.72, 0.023, 0.2, trim],
    ])
      ring(m, 0, roseY, wallZ + z, r * roseScale, t);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      line(
        trim,
        [
          [
            Math.cos(a) * 0.4 * roseScale,
            roseY + Math.sin(a) * 0.4 * roseScale,
            wallZ + 0.17,
          ],
          [
            Math.cos(a) * 1.63 * roseScale,
            roseY + Math.sin(a) * 1.63 * roseScale,
            wallZ + 0.17,
          ],
        ],
        0.025,
      );
      quatrefoil(
        Math.cos(a) * 1.53 * roseScale,
        roseY + Math.sin(a) * 1.53 * roseScale,
        wallZ + 0.2,
        0.18,
      );
    }
    ring(trim, 0, roseY, wallZ + 0.2, 0.4 * roseScale, 0.035);

    const column = (x, z, height, radius = 0.26) => {
      cylinder(shadowStone, x, 0.22, z, radius * 1.75, 0.44, radius * 1.75, 8);
      cylinder(trim, x, 0.47, z, radius * 1.58, 0.11, radius * 1.4, 8);
      cylinder(stone, x, height / 2 + 0.48, z, radius, height, radius, 12);
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        cylinder(
          trim,
          x + Math.cos(a) * radius,
          height / 2 + 0.48,
          z + Math.sin(a) * radius,
          radius * 0.22,
          height,
          radius * 0.22,
          8,
        );
      }
      for (const y of [0.58, 1.25, height + 0.35, height + 0.47])
        cylinder(trim, x, y, z, radius * 1.35, 0.08, radius * 1.35, 12);
      cylinder(
        trim,
        x,
        height + 0.56,
        z,
        radius * 1.25,
        0.15,
        radius * 1.65,
        8,
      );
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        add(
          new THREE.OctahedronGeometry(radius * 0.32),
          trim,
          x + Math.cos(a) * radius * 1.2,
          height + 0.51,
          z + Math.sin(a) * radius * 1.2,
          0.7,
          1.7,
          0.8,
        );
      }
    };
    // Three deeply recessed portals, crowned by crocketed gables and clustered jambs.
    for (const [x, width, spring] of [
      [0, 1.25, 1.55],
      [-4.25, 0.95, 1.42],
      [4.25, 0.95, 1.42],
    ]) {
      box(dark, x, 1.18, -12.94, width * 2 + 0.22, 1.85, 0.15);
      add(new THREE.PlaneGeometry(width * 1.82, 1.65), door, x, 1.17, -12.83);
      box(bronze, x, 1.16, -12.78, 0.035, 1.69, 0.045);
      // Separate lower fanlight: the door masks its lower half, below the great rose.
      add(
        new THREE.PlaneGeometry(width * 1.92, width * 1.92),
        glass,
        x,
        2.14,
        -12.87,
      );
      ring(bronze, x, 2.14, -12.79, width * 0.94, 0.026);
      for (const side of [-1, 1]) {
        ring(bronze, x + side * 0.17, 1.1, -12.73, 0.062, 0.012);
        for (let j = 0; j < 3; j++) {
          const r = width + j * 0.1;
          cylinder(
            j === 1 ? shadowStone : trim,
            x + side * r,
            0.94,
            -12.6 + j * 0.06,
            0.046,
            1.34,
            0.046,
            8,
          );
        }
        column(x + side * (width + 0.39), -12.36, 2.3, 0.12);
        pinnacle(x + side * (width + 0.39), 2.93, -12.36, 0.94);
      }
      for (let j = 0; j < 4; j++)
        arch(
          j % 2 ? trim : shadowStone,
          x,
          spring,
          -12.56 + j * 0.07,
          width + j * 0.1,
          j === 0 ? 0.085 : 0.042,
        );
      const apex = spring + width * 1.72 + 0.48,
        outer = width + 0.55;
      const gable = new THREE.Shape();
      gable.moveTo(x - outer, spring);
      gable.lineTo(x, apex);
      gable.lineTo(x + outer, spring);
      // Follow the arch back to the left: a solid carved spandrel, not a filled doorway.
      for (let j = 0; j <= 24; j++) {
        const t = j / 24;
        gable.lineTo(
          x + width * (1 - t * t),
          spring + width * (1.85 * t - 0.35 * t * t),
        );
      }
      for (let j = 23; j >= 0; j--) {
        const t = j / 24;
        gable.lineTo(
          x - width * (1 - t * t),
          spring + width * (1.85 * t - 0.35 * t * t),
        );
      }
      gable.closePath();
      add(
        new THREE.ExtrudeGeometry(gable, {
          depth: 0.12,
          bevelEnabled: false,
          steps: 1,
        }),
        stone,
        0,
        0,
        -12.38,
      );
      for (let j = 0; j < 3; j++) {
        line(
          j === 1 ? shadowStone : trim,
          [
            [x - outer, spring + j * 0.065, -12.15],
            [x, apex + j * 0.065, -12.15],
          ],
          0.043,
        );
        line(
          j === 1 ? shadowStone : trim,
          [
            [x, apex + j * 0.065, -12.15],
            [x + outer, spring + j * 0.065, -12.15],
          ],
          0.043,
        );
      }
      for (const side of [-1, 1])
        for (let j = 1; j < 9; j++) {
          const t = j / 9;
          add(
            new THREE.OctahedronGeometry(0.055),
            trim,
            x + side * outer * t,
            apex * (1 - t) + (spring + 0.04) * t + 0.13,
            -12.1,
            1,
            1.7,
            0.85,
          );
        }
      pinnacle(x, apex + 0.08, -12.18, 0.45);
      quatrefoil(x, apex - 0.2, -12.11, 0.1, bronze);
    }
    // Traceried lancet bays, with visible mullions and foliate spandrels.
    for (const x of [-7.6, -6.3, 6.3, 7.6]) {
      box(shadowStone, x, 6.35, -13.05, 1.12, 4.5, 0.1);
      add(new THREE.PlaneGeometry(1.0, 4.4), lancetGlass, x, 6.35, -12.96);
      for (const side of [-1, 1]) {
        cylinder(trim, x + side * 0.52, 6.0, -12.82, 0.052, 3.7, 0.052, 8);
        cylinder(trim, x + side * 0.17, 5.9, -12.79, 0.028, 3.5, 0.028, 8);
      }
      arch(trim, x, 7.82, -12.82, 0.52, 0.055);
      quatrefoil(x, 8.04, -12.75, 0.2);
      box(trim, x, 4.14, -12.75, 1.26, 0.12, 0.32);
      for (const y of [5.2, 6.3, 7.3])
        box(trim, x, y, -12.79, 1.02, 0.035, 0.06);
    }
    for (const x of [-8.3, -5.6, -2.85, 2.85, 5.6, 8.3]) {
      column(x, -12.3, 8.6, 0.21);
      box(shadowStone, x, 3.55, -12.57, 0.47, 1.6, 0.24);
      arch(trim, x, 3.87, -12.39, 0.21, 0.032);
      // Abstract robed votive figures, carved from the same stone (no external models).
      cylinder(trim, x, 3.34, -12.33, 0.13, 0.64, 0.058, 10);
      add(new THREE.SphereGeometry(0.078, 10, 8), trim, x, 3.79, -12.32);
      cylinder(trim, x, 2.98, -12.29, 0.2, 0.1, 0.2, 8);
    }
    // Blind arcading below the clerestory, and taller nave piers at the frame edges.
    for (let x = -9; x <= 9; x += 0.46) {
      arch(trim, x, 9.4, -13.03, 0.21, 0.022);
      cylinder(trim, x - 0.21, 9.23, -13.01, 0.022, 0.34, 0.022, 6);
    }
    for (const z of [-8, -3.8, 1.5])
      for (const side of [-1, 1]) {
        const x = side * 8.4;
        column(x, z, 6.8, 0.38);
        // Flying ribs rise into the dim vault beyond the crop.
        line(
          trim,
          [
            [x, z === 1.5 ? 5.8 : 5.2, z],
            [side * 4.8, 7, z - 0.3],
            [0, 8.3, z - 0.6],
          ],
          0.095,
        );
        box(stone, side * 9.1, 2.6, z - 0.75, 1.5, 5.2, 0.35);
        arch(trim, side * 9.1, 3.0, z - 0.51, 0.63, 0.065);
        box(banner, side * 9.1, 1.8, z - 0.52, 0.82, 2.0, 0.06);
        for (const edge of [-0.36, 0.36])
          box(bronze, side * 9.1 + edge, 1.8, z - 0.48, 0.016, 2, 0.015);
        ring(bronze, side * 9.1, 2.1, z - 0.47, 0.2, 0.014);
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          line(
            bronze,
            [
              [
                side * 9.1 + Math.cos(a) * 0.07,
                2.1 + Math.sin(a) * 0.07,
                z - 0.46,
              ],
              [
                side * 9.1 + Math.cos(a) * 0.17,
                2.1 + Math.sin(a) * 0.17,
                z - 0.46,
              ],
            ],
            0.009,
          );
        }
      }
    // Warm votive lights frame the landing without entering the figure corridor.
    const candleLights = [];
    for (const [x, z] of [
      [-2.65, -2.5],
      [2.65, -2.5],
      [-4.1, -8.8],
      [4.1, -8.8],
    ]) {
      cylinder(shadowStone, x, 0.16, z, 0.27, 0.32, 0.21, 8);
      cylinder(bronze, x, 0.76, z, 0.05, 1.02, 0.07, 10);
      cylinder(bronze, x, 1.28, z, 0.25, 0.05, 0.25, 16);
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5,
          cx = x + Math.cos(a) * 0.17,
          cz = z + Math.sin(a) * 0.17,
          h = 0.15 + random() * 0.15;
        cylinder(wax, cx, 1.3 + h / 2, cz, 0.032, h, 0.029, 8);
        add(
          new THREE.SphereGeometry(0.029, 8, 6),
          flame,
          cx,
          1.34 + h,
          cz,
          0.65,
          2.2,
          0.65,
        );
      }
      const light = new THREE.PointLight(0xffb35e, 5.5, 4.5, 2);
      light.position.set(x, 1.65, z);
      group.add(light);
      candleLights.push(light);
    }
    for (const [material, parts] of batches) {
      const merged = mergeGeometries(parts, false);
      parts.forEach((part) => part.dispose());
      const mesh = new THREE.Mesh(geo(merged), material);
      mesh.castShadow =
        material !== glass && material !== lancetGlass && material !== flame;
      mesh.receiveShadow =
        material !== glass && material !== lancetGlass && material !== flame;
      group.add(mesh);
    }
    batches.clear();

    const time = { value: 0 };
    // Soft shafts are feathered at every boundary; they don't veil the character's face.
    const beamMaterial = mat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          tint: { value: new THREE.Color(0xffd29b) },
          strength: { value: 0.18 },
          time,
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float strength, time; void main(){ float edge=pow(sin(vUv.x*3.14159265),1.4); float fade=smoothstep(0.0,.18,vUv.y)*(1.0-smoothstep(.78,1.0,vUv.y)); float dust=.84+.16*sin(vUv.y*31.0+time*.12); float lead=.65+.35*pow(sin(vUv.x*47.0),2.0); gl_FragColor=vec4(tint,edge*fade*strength*dust*lead); }`,
      }),
    );
    for (const [x, y, spread] of [
      [-7.6, 7.8, 1.1],
      [-6.3, 7.8, 0.9],
      [6.3, 7.8, 0.9],
      [7.6, 7.8, 1.1],
      [-1.3, 6.8, 1.3],
      [0, 7.3, 1.5],
      [1.3, 6.8, 1.3],
    ]) {
      const g = geo(new THREE.BufferGeometry());
      const endX = x - 3.4;
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            endX - spread,
            0.08,
            -3.6,
            endX + spread,
            0.08,
            -3.6,
            x + 0.12,
            y,
            -12.75,
            x - 0.12,
            y,
            -12.75,
          ],
          3,
        ),
      );
      g.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
      );
      g.setIndex([0, 1, 2, 0, 2, 3]);
      group.add(new THREE.Mesh(g, beamMaterial));
    }
    // Colored pools on the aisle suggest glass transmission, without an expensive projector.
    const poolMaterial = mat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { strength: { value: 0.17 } },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 vUv; uniform float strength; void main(){vec2 p=(vUv-.5)*2.0;float a=(1.0-smoothstep(.35,1.0,length(p)))*strength;vec3 c=mix(vec3(.8,.22,.10),vec3(.12,.42,.55),smoothstep(-.5,.5,sin(p.x*14.0+p.y*8.0)));float lead=smoothstep(.08,.2,abs(sin(p.x*18.0)*sin(p.y*14.0)));gl_FragColor=vec4(c,a*lead);}`,
      }),
    );
    for (const x of [-3.4, 3.4]) {
      const mesh = new THREE.Mesh(
        geo(new THREE.PlaneGeometry(3.5, 7)),
        poolMaterial,
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = 0.3;
      mesh.position.set(x, 0.012, -4);
      group.add(mesh);
    }
    const contactMaterial = mat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 vUv;void main(){float a=(1.0-smoothstep(0.0,1.0,length((vUv-.5)*2.0)))*.25;gl_FragColor=vec4(.025,.023,.02,a);}`,
      }),
    );
    const contact = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(1.05, 0.8)),
      contactMaterial,
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.014;
    group.add(contact);
    const particles = new Float32Array(120 * 3),
      seeds = new Float32Array(120);
    for (let i = 0; i < 120; i++) {
      particles[i * 3] = (random() - 0.5) * 13;
      particles[i * 3 + 1] = random() * 5;
      particles[i * 3 + 2] = -random() * 13;
      seeds[i] = random();
    }
    const dustGeometry = geo(new THREE.BufferGeometry());
    dustGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particles, 3),
    );
    dustGeometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    const dustMaterial = mat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { time, tint: { value: new THREE.Color(0xe6cea0) } },
        vertexShader: `attribute float seed;uniform float time;varying float alpha;void main(){vec3 p=position;p.x+=sin(time*.12+seed*83.0)*.2;p.y+=sin(time*.17+seed*42.0)*.17;vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;gl_PointSize=clamp(19.0/-v.z,1.0,3.0);alpha=.18+.25*sin(seed*32.0+time*.3);}`,
        fragmentShader: `uniform vec3 tint;varying float alpha;void main(){gl_FragColor=vec4(tint,(1.0-smoothstep(.1,.5,length(gl_PointCoord-.5)))*alpha);}`,
      }),
    );
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    group.add(dust);
    sun = new THREE.DirectionalLight(0xffd099, 3.1);
    sun.position.set(-3, 7, 1);
    sun.target.position.set(0, 0.5, -4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 3;
    Object.assign(sun.shadow.camera, {
      left: -8,
      right: 8,
      top: 8,
      bottom: -6,
      near: 0.5,
      far: 30,
    });
    sun.shadow.camera.updateProjectionMatrix();
    const hemisphere = new THREE.HemisphereLight(0xb8cbd0, 0x494237, 1.1);
    const face = new THREE.DirectionalLight(0xd5e4f4, 1.25);
    face.position.set(1.8, 3.4, 5.5);
    const rim = new THREE.DirectionalLight(0xffcf97, 1.5);
    rim.position.set(-3.5, 4, -6);
    group.add(sun, sun.target, hemisphere, face, rim);
    // Reflections retain the room's dark ceiling and bright window, not outdoor sky.
    const reflectionScene = new THREE.Scene();
    reflectionScene.background = new THREE.Color();
    const reflectionRoomMat = mat(
      new THREE.MeshBasicMaterial({ color: 0x514b3b, side: THREE.BackSide }),
    );
    reflectionScene.add(
      new THREE.Mesh(geo(new THREE.BoxGeometry(20, 14, 26)), reflectionRoomMat),
    );
    const reflectionWindowMat = mat(
      new THREE.MeshBasicMaterial({ color: 0xffddaa }),
    );
    const reflectionWindow = new THREE.Mesh(
      geo(new THREE.PlaneGeometry(6, 6)),
      reflectionWindowMat,
    );
    reflectionWindow.position.set(0, 2, -12);
    reflectionScene.add(reflectionWindow);
    pmrem = new THREE.PMREMGenerator(renderer);
    function setMood(key) {
      if (disposed) return;
      const next = Object.hasOwn(MOODS, key) ? key : "dawn";
      if (next === currentMood) return;
      const mood = MOODS[next];
      sun.color.setHex(mood.sun);
      sun.intensity = mood.power;
      hemisphere.color.setHex(mood.sky);
      hemisphere.intensity = mood.ambient;
      face.intensity = next === "night" ? 1.65 : 1.25;
      rim.color.setHex(mood.sun);
      rim.intensity = next === "night" ? 0.7 : 1.5;
      glass.emissive.setHex(mood.sun);
      lancetGlass.emissive.setHex(mood.sun);
      glass.emissiveIntensity = lancetGlass.emissiveIntensity = mood.glass;
      fog.color.setHex(mood.fog);
      background.setHex(mood.fog).multiplyScalar(0.4);
      beamMaterial.uniforms.tint.value.setHex(mood.sun);
      beamMaterial.uniforms.strength.value = mood.beam;
      poolMaterial.uniforms.strength.value = next === "night" ? 0.08 : 0.2;
      reflectionRoomMat.color
        .setHex(mood.sky)
        .multiplyScalar(next === "night" ? 0.16 : 0.3);
      reflectionWindowMat.color.setHex(mood.sun).multiplyScalar(mood.glass);
      if (!environments.has(next))
        environments.set(next, pmrem.fromScene(reflectionScene, 0.08, 0.1, 50));
      ownedEnvironment = environments.get(next).texture;
      scene.environment = ownedEnvironment;
      ownedExposure = mood.exposure;
      renderer.toneMappingExposure = ownedExposure;
      currentMood = next;
    }
    const loader = new THREE.TextureLoader(),
      base = `${import.meta.env.BASE_URL}environments/cathedral/`;
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const loadTexture = (name, srgb, targets, slots, tiled = false) =>
      new Promise((resolve, reject) => {
        const pending = loader.load(
          base + name,
          (texture) => {
            if (disposed) {
              texture.dispose();
              resolve();
              return;
            }
            texture.colorSpace = srgb
              ? THREE.SRGBColorSpace
              : THREE.NoColorSpace;
            texture.anisotropy = anisotropy;
            if (tiled) {
              texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
              texture.repeat.set(
                name.startsWith("floor") ? 8 : 2,
                name.startsWith("floor") ? 8 : 2,
              );
            }
            for (const target of targets) {
              for (const slot of slots) target[slot] = texture;
              target.needsUpdate = true;
            }
            resolve();
          },
          undefined,
          () => {
            pending.dispose();
            textures.delete(pending);
            reject(
              new Error(`Cathedral texture failed to load: ${base}${name}`),
            );
          },
        );
        textures.add(pending);
      });
    const ready = Promise.all([
      loadTexture("stone-color.webp", true, [stone, trim], ["map"], true),
      loadTexture(
        "stone-normal.webp",
        false,
        [stone, trim],
        ["normalMap"],
        true,
      ),
      loadTexture("floor-color.webp", true, [floor], ["map"], true),
      loadTexture("floor-normal.webp", false, [floor], ["normalMap"], true),
      loadTexture("door-color.webp", true, [door], ["map"]),
      loadTexture("door-normal.webp", false, [door], ["normalMap"]),
      loadTexture("rose.png", true, [glass], ["map", "emissiveMap"]),
      loadTexture("lancet.png", true, [lancetGlass], ["map", "emissiveMap"]),
    ]).then(() => undefined);
    try {
      setMood("dawn");
    } catch (error) {
      ready.catch(() => {});
      dispose();
      throw error;
    }
    return {
      ready,
      setMood,
      update(seconds) {
        if (disposed) return;
        time.value = seconds;
        for (let i = 0; i < candleLights.length; i++)
          candleLights[i].intensity =
            5.5 +
            Math.sin(seconds * 3.7 + i * 2.1) * 0.24 +
            Math.sin(seconds * 7.3 + i) * 0.12;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
