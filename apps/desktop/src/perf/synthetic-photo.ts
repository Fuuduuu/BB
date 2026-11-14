export async function createSyntheticPhoto(width = 4000, height = 3000) {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('OffscreenCanvas 2D context unavailable');
  const pixels = context.createImageData(width, height);
  let noise = 0x31415926;
  for (let index = 0; index < pixels.data.length; index += 4) {
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const variation = (noise >>> 27) - 16;
    pixels.data[index] = 21 + variation;
    pixels.data[index + 1] = 91 + variation;
    pixels.data[index + 2] = 56 + variation;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  context.strokeStyle = '#7c9b60';
  context.lineWidth = 5;
  for (let x = 30; x < width; x += 67) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height * 0.35);
    context.lineTo(x + 29, height * 0.35 + 29);
    context.lineTo(x + 29, height);
    context.stroke();
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return { bytes: await blob.arrayBuffer(), name: 'synthetic-board-4000x3000.jpg' };
}
