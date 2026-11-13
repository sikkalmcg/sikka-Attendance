import assert from 'node:assert/strict';
import test from 'node:test';
import { formatEmployeeId, getHighestEmployeeIdSerial } from '../lib/employeeIds.js';
import { parseEmployeePhoto } from '../lib/employeePhoto.js';
import { buildEmployeeQrContent } from '../lib/employeeIdCard.js';
import { addPrintDpiMetadata } from '../lib/pngPrintDpi.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

test('employee ID serial formatting pads the sequence but supports larger values', () => {
  assert.equal(formatEmployeeId(1), 'EMP-S0001');
  assert.equal(formatEmployeeId(58), 'EMP-S0058');
  assert.equal(formatEmployeeId(10000), 'EMP-S10000');
  assert.throws(() => formatEmployeeId(0), /positive safe integer/);
});

test('highest serial is derived from existing formatted IDs, not employee count', () => {
  assert.equal(getHighestEmployeeIdSerial(['EMP-S0003', 'EMP050', 'EMP-S0098']), 98);
  assert.equal(getHighestEmployeeIdSerial(['EMP-S10000', 'EMP-S9999']), 10000);
});

test('employee photo validation accepts supported signatures and rejects mismatched data', () => {
  assert.equal(
    parseEmployeePhoto('data:image/jpeg;base64,/9j/2Q==').mimeType,
    'image/jpeg'
  );
  assert.throws(
    () => parseEmployeePhoto('data:image/png;base64,/9j/2Q=='),
    /contents do not match/
  );
  assert.throws(
    () => parseEmployeePhoto('data:image/gif;base64,R0lGODlh'),
    /JPG, PNG, or WEBP/
  );
});

test('ID card QR content is readable and excludes sensitive login data', () => {
  const content = buildEmployeeQrContent({
    employeeId: 'EMP-S0001',
    fullName: 'Ajay Kumar',
    designation: 'Supervisor',
    mobileNumber: '9876543210',
    aadhaarNumber: '123456789012',
    passwordHash: 'secret',
    dateOfBirth: '1990-01-01',
  });
  assert.match(content, /Employee ID: EMP-S0001/);
  assert.match(content, /Mobile: 9876543210/);
  assert.doesNotMatch(content, /123456789012|secret|1990-01-01/);
});

test('print PNG metadata records 300 DPI without corrupting the PNG', async () => {
  const content = buildEmployeeQrContent({
    employeeId: 'EMP-S0001',
    fullName: 'Ajay Kumar',
    designation: 'Supervisor',
    plantName: 'Salt Plant',
    mobileNumber: '9876543210',
  });
  const source = await QRCode.toBuffer(content, { width: 380, margin: 4, errorCorrectionLevel: 'M' });
  const output = new Uint8Array(await addPrintDpiMetadata(source).arrayBuffer());
  const data = new DataView(output.buffer);
  let offset = 8;
  let density;
  while (offset + 12 <= output.length) {
    const length = data.getUint32(offset);
    const type = new TextDecoder().decode(output.subarray(offset + 4, offset + 8));
    if (type === 'pHYs') {
      density = [data.getUint32(offset + 8), data.getUint32(offset + 12), output[offset + 16]];
    }
    offset += length + 12;
  }
  assert.deepEqual(density, [11811, 11811, 1]);
  assert.equal(offset, output.length);

  const decodedPng = PNG.sync.read(Buffer.from(output));
  assert.equal(decodedPng.width, 380);
  const scaledPixels = new Uint8ClampedArray(190 * 190 * 4);
  for (let y = 0; y < 190; y += 1) {
    for (let x = 0; x < 190; x += 1) {
      const sourceIndex = ((y * 2) * decodedPng.width + x * 2) * 4;
      const targetIndex = (y * 190 + x) * 4;
      scaledPixels.set(decodedPng.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
    }
  }
  const decodedQr = jsQR(scaledPixels, 190, 190);
  assert.equal(decodedQr?.data, content);
});
