function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

export function addPrintDpiMetadata(pngBuffer) {
  const source = new Uint8Array(pngBuffer);
  const chunks = [source.subarray(0, 8)];
  const pixelsPerMeter = Math.round(300 / 0.0254);
  const density = new Uint8Array(9);
  const densityView = new DataView(density.buffer);
  densityView.setUint32(0, pixelsPerMeter);
  densityView.setUint32(4, pixelsPerMeter);
  density[8] = 1;

  let offset = 8;
  let inserted = false;
  while (offset + 12 <= source.length) {
    const length = new DataView(source.buffer, source.byteOffset + offset, 4).getUint32(0);
    const end = offset + length + 12;
    if (end > source.length) throw new Error('Invalid PNG data while adding print resolution.');
    const type = new TextDecoder().decode(source.subarray(offset + 4, offset + 8));

    if (type !== 'pHYs') chunks.push(source.subarray(offset, end));
    if (type === 'IHDR') {
      chunks.push(createPngChunk('pHYs', density));
      inserted = true;
    }
    offset = end;
  }

  if (!inserted || offset !== source.length) {
    throw new Error('Could not add print resolution metadata to the ID card.');
  }
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return new Blob([result], { type: 'image/png' });
}
