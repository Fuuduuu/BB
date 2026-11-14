import { newCanvas, svgImage } from './png-svg';

export type FontFamilyEvidence = {
  family: string;
  generic: boolean;
  documentSentinelDistance: number;
  isolatedSentinelDistance: number;
  documentDistance: number;
  isolatedDistance: number;
};

export function classifyFontEvidence(input: {
  documentDistance: number;
  fallbackDistance: number;
  documentFallbackDistance: number;
  candidates: FontFamilyEvidence[];
  documentGenericSentinelDistance?: number;
  isolatedGenericSentinelDistance?: number;
}) {
  const classify = (context: 'document' | 'isolated') => {
    const genericDistance =
      context === 'document'
        ? (input.documentGenericSentinelDistance ?? input.documentFallbackDistance)
        : (input.isolatedGenericSentinelDistance ?? input.documentFallbackDistance);
    const candidates = input.candidates.map((item) => {
      const sentinelDistance =
        context === 'document' ? item.documentSentinelDistance : item.isolatedSentinelDistance;
      const rasterDistance = context === 'document' ? item.documentDistance : item.isolatedDistance;
      const availability = item.generic
        ? 'generic'
        : genericDistance <= 1000
          ? 'indistinguishable'
          : sentinelDistance === 0
            ? 'available'
            : sentinelDistance > 1000
              ? 'unavailable-or-fallback'
              : 'indistinguishable';
      return { family: item.family, generic: item.generic, availability, rasterDistance };
    });
    const primary = candidates[0];
    const matches = candidates
      .filter(
        (item) => ['available', 'generic'].includes(item.availability) && item.rasterDistance === 0,
      )
      .map((item) => item.family);
    const fallbackMatches = matches.filter((family) => family !== primary?.family);
    const observation =
      !primary || primary.generic
        ? 'unknown:no-named-primary-family'
        : primary.availability === 'unavailable-or-fallback'
          ? 'fallback:primary-family-unavailable'
          : primary.availability !== 'available'
            ? 'unknown:primary-family-indistinguishable'
            : primary.rasterDistance === 0
              ? fallbackMatches.length
                ? 'unknown:font-families-indistinguishable'
                : 'primary-family'
              : fallbackMatches.length
                ? 'fallback'
                : 'unknown:raster-difference';
    return { observation, primary, matches, candidates };
  };
  const isolated = classify('isolated');
  return {
    observation: isolated.observation,
    isolatedChoice: isolated,
    documentChoice: classify('document'),
  };
}

export function genericFallbackFamily(family: string) {
  return (
    family
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .reverse()
      .find((item) =>
        [
          'serif',
          'sans-serif',
          'monospace',
          'cursive',
          'fantasy',
          'system-ui',
          'ui-serif',
          'ui-sans-serif',
          'ui-monospace',
        ].includes(item),
      ) ?? 'sans-serif'
  );
}

function signature(pixels: ImageData) {
  let hash = 2166136261;
  let left = pixels.width,
    right = -1,
    top = pixels.height,
    bottom = -1;
  for (let y = 0; y < pixels.height; y++)
    for (let x = 0; x < pixels.width; x++) {
      const alpha = pixels.data[(y * pixels.width + x) * 4 + 3]!;
      hash = Math.imul(hash ^ alpha, 16777619);
      if (alpha > 20) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  return { alphaHash: (hash >>> 0).toString(16), bounds: { left, right, top, bottom } };
}
function distance(a: ImageData, b: ImageData) {
  let total = 0;
  for (let index = 3; index < a.data.length; index += 4)
    total += Math.abs(a.data[index]! - b.data[index]!);
  return total;
}

/** Compares rasterized glyphs, never treats document.fonts.check as font evidence. */
export async function observePngFont(source: SVGSVGElement) {
  const text = source.querySelector('text');
  if (!text) return { observation: 'unknown', reason: 'no actual scene text' };
  await document.fonts.ready;
  const family = getComputedStyle(text).fontFamily;
  const specimen = 'R1 U1 ? 0123456789 MW';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '900');
  svg.setAttribute('height', '90');
  const label = document.createElementNS(svg.namespaceURI, 'text');
  label.setAttribute('x', '10');
  label.setAttribute('y', '65');
  label.setAttribute('font-size', '40');
  label.setAttribute('font-family', family);
  label.textContent = specimen;
  svg.append(label);
  const isolated = newCanvas(900, 90);
  isolated.context.drawImage(await svgImage(svg), 0, 0);
  const isolatedPixels = isolated.context.getImageData(0, 0, 900, 90);
  const render = (font: string) => {
    const target = newCanvas(900, 90);
    target.context.font = `40px ${font}`;
    target.context.fillText(specimen, 10, 65);
    return target.context.getImageData(0, 0, 900, 90);
  };
  const documentPixels = render(family);
  const fallbackFamily = genericFallbackFamily(family);
  const fallbackPixels = render(fallbackFamily);
  const monospacePixels = render('monospace');
  const serifPixels = render('serif');
  const renderIsolated = async (font: string) => {
    const specimenSvg = svg.cloneNode(true) as SVGSVGElement;
    specimenSvg.querySelector('text')!.setAttribute('font-family', font);
    const target = newCanvas(900, 90);
    target.context.drawImage(await svgImage(specimenSvg), 0, 0);
    return target.context.getImageData(0, 0, 900, 90);
  };
  const isolatedMonospace = await renderIsolated('monospace');
  const isolatedSerif = await renderIsolated('serif');
  const candidates = await Promise.all(
    family.split(',').map(async (part) => {
      const name = part.trim();
      const generic = genericFallbackFamily(name) === name.toLowerCase();
      const documentSerif = render(generic ? name : `${name}, serif`);
      const documentMono = render(generic ? name : `${name}, monospace`);
      const svgSerif = await renderIsolated(generic ? name : `${name}, serif`);
      const svgMono = await renderIsolated(generic ? name : `${name}, monospace`);
      return {
        family: name,
        generic,
        documentSentinelDistance: distance(documentSerif, documentMono),
        isolatedSentinelDistance: distance(svgSerif, svgMono),
        documentDistance: distance(documentPixels, documentSerif),
        isolatedDistance: distance(isolatedPixels, svgSerif),
        documentSerif: signature(documentSerif),
        documentMono: signature(documentMono),
        isolatedSerif: signature(svgSerif),
        isolatedMono: signature(svgMono),
      };
    }),
  );
  const documentDistance = distance(isolatedPixels, documentPixels);
  const fallbackDistance = distance(isolatedPixels, fallbackPixels);
  const classification = classifyFontEvidence({
    documentDistance,
    fallbackDistance,
    documentFallbackDistance: distance(documentPixels, fallbackPixels),
    candidates,
    documentGenericSentinelDistance: distance(serifPixels, monospacePixels),
    isolatedGenericSentinelDistance: distance(isolatedSerif, isolatedMonospace),
  });
  return {
    family,
    specimen,
    fontResourcesEmbedded: false,
    ...classification,
    documentDistance,
    fallbackDistance,
    fallbackFamily,
    monospaceDistance: distance(isolatedPixels, monospacePixels),
    isolated: signature(isolatedPixels),
    document: signature(documentPixels),
    fallback: signature(fallbackPixels),
    monospace: signature(monospacePixels),
    candidates,
  };
}
