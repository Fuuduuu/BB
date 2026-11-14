import type { PhotoRef } from '@pcbk/domain';
import { checkMarkers, type MarkerChecks } from './png-markers';
import { exportMatrix } from './png-geometry';
import { expectedPngPoints, type PngFixture } from './png-photo';
import { photoRasterGeometry } from './png-raster';
import {
  cloneExportSvg,
  decodePngPixels,
  exportFailureStatus,
  loadImage,
  newCanvas,
  pngBlob,
  svgImage,
} from './png-svg';

export type PngPreview = { label: string; url: string };
export function p1PhotoEvidence(markers: Pick<MarkerChecks, 'red' | 'blue'>) {
  const redPresent = markers.red.measured !== null;
  const bluePresent = markers.blue.measured !== null;
  const photoPresent = redPresent && bluePresent;
  return {
    status: photoPresent
      ? 'ok'
      : redPresent || bluePresent
        ? 'error:photo_presence_inconclusive'
        : 'photo_missing',
    photoPresent,
    photoPresence: { red: redPresent, blue: bluePresent },
    pixelChecksOk: markers.red.ok && markers.blue.ok,
  };
}
export type PngRow = {
  route: string;
  photo: string;
  variant: string;
  status: string;
  totalMs: number;
  pngBytes: number;
  toBlobMs: number | null;
  [key: string]: unknown;
};

type ExportPhoto = Pick<PhotoRef, 'id' | 'widthPx' | 'heightPx' | 'transform'>;
function geometry(photo: ExportPhoto, image: HTMLImageElement) {
  // Area scale remains meaningful when browser natural dimensions already reflect EXIF.
  const scale = Math.sqrt(
    (image.naturalWidth * image.naturalHeight) / (photo.widthPx * photo.heightPx),
  );
  const swap = ['rot90', 'rot270', 'mirror_rot90', 'mirror_rot270'].includes(photo.transform);
  const width = Math.round((swap ? photo.heightPx : photo.widthPx) * scale);
  const height = Math.round((swap ? photo.widthPx : photo.heightPx) * scale);
  return {
    scale,
    width,
    height,
    matrix: exportMatrix(photo.transform, { width: photo.widthPx, height: photo.heightPx }, scale),
    natural: { width: image.naturalWidth, height: image.naturalHeight },
    rawAxisRatios: {
      x: image.naturalWidth / photo.widthPx,
      y: image.naturalHeight / photo.heightPx,
    },
  };
}

export async function exportPngRoute(input: {
  route: 'P1' | 'P2-normal' | 'P2-anonymous' | 'P3';
  variant: 'display' | 'original';
  url: string;
  source: SVGSVGElement;
  photo: ExportPhoto;
  fixture: PngFixture;
  previews: PngPreview[];
}): Promise<PngRow> {
  const { route, variant, source, photo, fixture } = input;
  const started = performance.now();
  const row: PngRow = {
    route,
    photo: fixture.kind,
    variant,
    status: 'skipped',
    totalMs: 0,
    pngBytes: 0,
    toBlobMs: null,
    photoRef: photo,
    exifExpected: fixture.exif,
    expectedVisible: fixture.visible,
    width: null,
    height: null,
    natural: null,
  };
  try {
    const anonymous = route === 'P2-anonymous' || route === 'P3';
    const url =
      route === 'P3'
        ? `${input.url}&png_probe_origin=${encodeURIComponent(location.origin)}`
        : input.url;
    row.photoUrl = url;
    const image = await loadImage(url, anonymous);
    const geo = geometry(photo, image);
    Object.assign(row, {
      ...geo,
      photoRef: photo,
      exifExpected: fixture.exif,
      expectedVisible: fixture.visible,
      imageOrientation: image.style.imageOrientation,
      decodeMethod: 'HTMLImageElement + drawImage',
    });
    const { canvas, context } = newCanvas(geo.width, geo.height);
    const expected = expectedPngPoints(fixture, geo.scale);
    if (route === 'P1') {
      const clone = cloneExportSvg(source, geo.matrix, geo.width, geo.height, true);
      const embedded = clone.querySelector('image');
      if (embedded) embedded.setAttribute('href', input.url);
      context.drawImage(await svgImage(clone), 0, 0);
      const encoded = await pngBlob(canvas);
      const pixels = context.getImageData(0, 0, geo.width, geo.height);
      const markers = checkMarkers(pixels, { ...expected, photoOnly: pixels });
      Object.assign(row, {
        toBlobMs: encoded.toBlobMs,
        pngBytes: encoded.pngBytes,
        markers: { red: markers.red, blue: markers.blue },
      });
      Object.assign(row, p1PhotoEvidence(markers));
    } else {
      const raster = photoRasterGeometry(
        { width: photo.widthPx, height: photo.heightPx },
        geo.natural,
        fixture.exif,
      );
      Object.assign(row, raster, { layerExportMatrix: geo.matrix });
      const photoOnly = newCanvas(geo.width, geo.height);
      photoOnly.context.setTransform(...geo.matrix);
      photoOnly.context.transform(...raster.bitmapToRaw);
      photoOnly.context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
      context.drawImage(photoOnly.canvas, 0, 0);
      context.drawImage(
        await svgImage(cloneExportSvg(source, geo.matrix, geo.width, geo.height, false)),
        0,
        0,
      );
      const encoded = await pngBlob(canvas);
      Object.assign(row, { toBlobMs: encoded.toBlobMs, pngBytes: encoded.pngBytes });
      row.status = 'ok';
      if (route === 'P3') {
        const encodedPhotoOnly = await pngBlob(photoOnly.canvas);
        const pixels = await decodePngPixels(encoded.blob);
        const photoPixels = await decodePngPixels(encodedPhotoOnly.blob);
        const checks = checkMarkers(pixels, { ...expected, photoOnly: photoPixels });
        const portrait = fixture.exif !== 6 || pixels.width < pixels.height;
        row.decodedPng = { width: pixels.width, height: pixels.height };
        row.photoOnlyPng = {
          width: photoPixels.width,
          height: photoPixels.height,
          toBlobMs: encodedPhotoOnly.toBlobMs,
          pngBytes: encodedPhotoOnly.pngBytes,
        };
        row.pixelCheckSource = 'decoded composed PNG and decoded photo-only PNG';
        row.markers = checks;
        row.portraitOk = portrait;
        row.pixelChecksOk =
          portrait &&
          checks.red.ok &&
          checks.blue.ok &&
          Object.values(checks.components).every((check) => check.ok);
        input.previews.push({
          label: `${fixture.kind} / ${variant}`,
          url: URL.createObjectURL(encoded.blob),
        });
      }
    }
  } catch (error) {
    row.status = exportFailureStatus(error);
  }
  row.totalMs = performance.now() - started;
  return row;
}
