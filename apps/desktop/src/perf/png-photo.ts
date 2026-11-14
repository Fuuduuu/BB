import { withExifOrientation } from './png-exif';

export type PngFixture = {
  kind: 'landscape' | 'portrait-exif6';
  bytes: ArrayBuffer;
  name: string;
  visible: { width: number; height: number };
  centers: { resistor: { x: number; y: number }; soic: { x: number; y: number } };
  exif: 1 | 6;
};

export async function createPngFixture(
  portrait: boolean,
  rawSize = { width: 4000, height: 3000 },
): Promise<PngFixture> {
  const width = portrait ? rawSize.height : rawSize.width;
  const height = portrait ? rawSize.width : rawSize.height;
  const visible = new OffscreenCanvas(width, height);
  const context = visible.getContext('2d');
  if (!context) throw new Error('Fixture canvas unavailable');
  context.fillStyle = '#205b38';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#55945c';
  context.lineWidth = 4;
  for (let x = 300; x < width - 300; x += 137) {
    context.beginPath();
    context.moveTo(x, 240);
    context.lineTo(x, height * 0.43);
    context.lineTo(x + 57, height * 0.43 + 57);
    context.lineTo(x + 57, height - 240);
    context.stroke();
  }
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, 200, 200);
  context.fillStyle = '#0000ff';
  context.fillRect(width - 200, height - 200, 200, 200);
  const raw = new OffscreenCanvas(rawSize.width, rawSize.height);
  const rawContext = raw.getContext('2d');
  if (!rawContext) throw new Error('Raw fixture canvas unavailable');
  // Visible portrait -> raw JPEG: inverse of EXIF 6, before encoding exactly once.
  if (portrait) rawContext.setTransform(0, -1, 1, 0, 0, rawSize.height);
  rawContext.drawImage(visible, 0, 0);
  const jpeg = await raw.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const bytes = await jpeg.arrayBuffer();
  return {
    kind: portrait ? 'portrait-exif6' : 'landscape',
    bytes: portrait ? withExifOrientation(bytes, 6) : bytes,
    name: portrait ? 'png-probe-portrait-exif6.jpg' : 'png-probe-landscape.jpg',
    visible: { width, height },
    // Continuous SVG centers corresponding to raw JPEG pixel indices + 0.5.
    centers: portrait
      ? {
          resistor: { x: 100, y: rawSize.height - 100 },
          soic: { x: rawSize.width - 100, y: 100 },
        }
      : {
          resistor: { x: 100, y: 100 },
          soic: { x: rawSize.width - 100, y: rawSize.height - 100 },
        },
    exif: portrait ? 6 : 1,
  };
}

/** Fixture formula, deliberately independent of sceneMatrix/exportMatrix. */
export function expectedPngPoints(fixture: PngFixture, scale: number) {
  const red = { x: 100 * scale - 0.5, y: 100 * scale - 0.5 };
  const blue = {
    x: (fixture.visible.width - 100) * scale - 0.5,
    y: (fixture.visible.height - 100) * scale - 0.5,
  };
  return { red, blue, components: { resistor: red, soic: blue } };
}
