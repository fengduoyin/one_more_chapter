/** Sample a cover image's dominant RGB for letterbox side fills. */

export function sampleCoverDominantColor(image) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, size, size);
  let data;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }

  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i] >> 4;
    const g = data[i + 1] >> 4;
    const b = data[i + 2] >> 4;
    const key = (r << 8) | (g << 4) | b;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let bestKey = -1;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  if (bestKey < 0) return null;

  const r = (bestKey >> 8) << 4;
  const g = ((bestKey >> 4) & 0xf) << 4;
  const b = (bestKey & 0xf) << 4;
  return `rgb(${r}, ${g}, ${b})`;
}
