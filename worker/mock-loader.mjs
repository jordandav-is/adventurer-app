export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      shortCircuit: true,
      url: "virtual:cloudflare:workers"
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === "virtual:cloudflare:workers") {
    return {
      shortCircuit: true,
      format: "module",
      source: "export class DurableObject {}"
    };
  }
  return nextLoad(url, context);
}
