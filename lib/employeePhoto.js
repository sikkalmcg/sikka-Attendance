const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i;

export function parseEmployeePhoto(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw new Error('Employee photo must be an encoded JPG, PNG, or WEBP image.');
  }

  const match = PHOTO_DATA_URL.exec(dataUrl);
  if (!match) {
    throw new Error('Employee photo must be a JPG, PNG, or WEBP image.');
  }
  if (match[2].length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) {
    throw new Error('Employee photo must be no larger than 2 MB.');
  }

  const mimeType = `image/${match[1].toLowerCase()}`;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES || bytes.toString('base64') !== match[2]) {
    throw new Error('Employee photo must be no larger than 2 MB.');
  }

  const isJpeg =
    mimeType === 'image/jpeg' &&
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9;
  const isPng =
    mimeType === 'image/png' &&
    bytes.length >= 33 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
    bytes.readUInt32BE(8) === 13 &&
    bytes.toString('ascii', 12, 16) === 'IHDR' &&
    bytes.readUInt32BE(16) > 0 &&
    bytes.readUInt32BE(20) > 0;
  const isWebp =
    mimeType === 'image/webp' &&
    bytes.length >= 20 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.readUInt32LE(4) === bytes.length - 8 &&
    bytes.toString('ascii', 8, 12) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16));

  if (!isJpeg && !isPng && !isWebp) {
    throw new Error('Employee photo contents do not match the selected image format.');
  }

  return { dataUrl, mimeType };
}
