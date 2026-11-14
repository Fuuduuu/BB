const svgNS = 'http://www.w3.org/2000/svg';
const exportedLayers = new Set([
  'photo.image',
  'components.bodies',
  'components.pins',
  'components.labels',
  'measurements.readings',
]);
const presentation = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant-numeric',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
  'vector-effect',
  'visibility',
  'display',
];

/** Only scene layers below the interaction layers are serialized; URLs stay external. */
export function cloneExportSvg(
  source: SVGSVGElement,
  matrix: readonly number[],
  width: number,
  height: number,
  includePhoto: boolean,
) {
  const scene = source.querySelector('[data-scene]');
  if (!scene) throw new Error('Workbench scene missing');
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('xmlns', svgNS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const group = document.createElementNS(svgNS, 'g');
  group.setAttribute('data-scene', '');
  group.setAttribute('transform', `matrix(${matrix.join(' ')})`);
  svg.append(group);
  for (const child of scene.children) {
    const layer = child.getAttribute('data-layer');
    const surface =
      child === scene.firstElementChild && child.tagName.toLowerCase() === 'rect' && !layer;
    if (surface ? !includePhoto : !layer || !exportedLayers.has(layer)) continue;
    if (!includePhoto && layer === 'photo.image') continue;
    const clone = child.cloneNode(true) as Element;
    const originals = [child, ...child.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    originals.forEach((element, index) => {
      const computed = getComputedStyle(element);
      for (const name of presentation) {
        const value = computed.getPropertyValue(name);
        if (value && !value.includes('var(')) copies[index]!.setAttribute(name, value);
      }
    });
    group.append(clone);
  }
  return svg;
}

export function exportFailureStatus(error: unknown) {
  return error instanceof DOMException && error.name === 'SecurityError'
    ? 'tainted'
    : `error:${error instanceof Error ? error.message : String(error)}`;
}

export function loadImage(url: string, anonymous = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (anonymous) image.crossOrigin = 'anonymous';
    image.style.imageOrientation = 'none';
    const timeout = window.setTimeout(() => reject(new Error('image load timeout')), 15_000);
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`image load failed (${anonymous ? 'anonymous' : 'normal'})`));
    };
    image.src = url;
  });
}

export async function svgImage(svg: SVGSVGElement) {
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }),
  );
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function newCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D unavailable');
  return { canvas, context };
}

export async function pngBlob(canvas: HTMLCanvasElement) {
  const started = performance.now();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('PNG encoder returned null'))),
      'image/png',
    );
  });
  return { blob, toBlobMs: performance.now() - started, pngBytes: blob.size };
}

/** Decode the exact encoded PNG whose Blob is also retained for the native preview. */
export async function decodePngPixels(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const { context } = newCanvas(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}
