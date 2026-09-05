// User-supplied Tripo model; local preview only, never copied into the production build.
// Source: https://studio.tripo3d.ai/3d-model/horned-humanoid-ranger-in-leather-armor-with-staff-standing-in-a-fores-1fbd0791-444f-493b-90ff-5b1a7e486a92
import { mkdir, writeFile } from "node:fs/promises";

const project = "1fbd0791-444f-493b-90ff-5b1a7e486a92";
const response = await fetch(`https://api.tripo3d.ai/v2/studio/project/detail/v3/${project}?locale=en`);
if (!response.ok) throw new Error(`Tripo project lookup failed: HTTP ${response.status}`);
const detail = await response.json();
const url = detail.data?.model_url;
if (!url) throw new Error("The public project no longer exposes a model. Download your GLB from Tripo and use Open GLB in the preview.");
const model = await fetch(url);
if (!model.ok) throw new Error(`Tripo model download failed: HTTP ${model.status}`);
const bytes = new Uint8Array(await model.arrayBuffer());
const header = new DataView(bytes.buffer);
if (bytes.length < 12 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.length) {
  throw new Error("Tripo did not return a complete GLB 2.0 file.");
}
const directory = new URL("../.preview-assets/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("ranger.glb", directory), bytes);
console.log(`Saved .preview-assets/ranger.glb (${(bytes.length / 1048576).toFixed(1)} MiB). Open /stage-preview.html with the Vite dev server.`);
