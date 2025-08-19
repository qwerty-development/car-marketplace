// A lightweight global registry to register UI anchors for onboarding highlights
// Components can register a measurable ref or a custom measure function keyed by a stable ID

export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MeasureFunc = () => Promise<AnchorRect | null>;

const anchorRegistry: Map<string, MeasureFunc> = new Map();

export function registerAnchorWithMeasure(id: string, measure: MeasureFunc) {
  anchorRegistry.set(id, measure);
}

export function registerAnchorRef(id: string, ref: { current: any }) {
  const measure: MeasureFunc = () =>
    new Promise(resolve => {
      try {
        const node = ref?.current;
        if (!node || typeof node.measureInWindow !== 'function') {
          resolve(null);
          return;
        }
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (!width || !height) {
            resolve(null);
          } else {
            resolve({ x, y, width, height });
          }
        });
      } catch {
        resolve(null);
      }
    });

  anchorRegistry.set(id, measure);
}

export function unregisterAnchor(id: string) {
  anchorRegistry.delete(id);
}

export async function measureAnchor(id: string): Promise<AnchorRect | null> {
  const measure = anchorRegistry.get(id);
  if (!measure) return null;
  return measure();
}

export async function waitForAnchor(
  id: string,
  { timeoutMs = 6000, intervalMs = 150 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<AnchorRect | null> {
  const start = Date.now();
  return new Promise(resolve => {
    const tick = async () => {
      const rect = await measureAnchor(id);
      if (rect) {
        resolve(rect);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}


