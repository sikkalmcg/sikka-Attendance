'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, LoaderCircle } from 'lucide-react';
import Modal from '@/components/common/Modal';
import sikkaLogo from '../../public/images/sikka-logo.jpg';
import {
  buildEmployeeQrContent,
  EMPLOYEE_ID_CARD_ADDRESS,
  EMPLOYEE_ID_CARD_HEIGHT,
  EMPLOYEE_ID_CARD_WEBSITE,
  EMPLOYEE_ID_CARD_WIDTH,
} from '@/lib/employeeIdCard';
import { addPrintDpiMetadata } from '@/lib/pngPrintDpi';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawContain(context, image, x, y, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

function drawCard(canvas, employee, qrImage, photoImage, logoImage) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not render the ID card.');

  context.clearRect(0, 0, EMPLOYEE_ID_CARD_WIDTH, EMPLOYEE_ID_CARD_HEIGHT);
  context.fillStyle = '#f1f5f9';
  context.fillRect(0, 0, EMPLOYEE_ID_CARD_WIDTH, EMPLOYEE_ID_CARD_HEIGHT);
  context.fillStyle = '#ffffff';
  context.fillRect(14, 14, EMPLOYEE_ID_CARD_WIDTH - 28, EMPLOYEE_ID_CARD_HEIGHT - 28);

  context.fillStyle = '#102c50';
  context.fillRect(14, 14, EMPLOYEE_ID_CARD_WIDTH - 28, 144);
  context.fillStyle = '#ffffff';
  context.fillRect(42, 33, 105, 105);
  drawContain(context, logoImage, 45, 36, 99, 99);

  context.textAlign = 'left';
  context.fillStyle = '#ffffff';
  context.font = 'bold 30px Arial, sans-serif';
  context.fillText('SIKKA INDUSTRIES & LOGISTICS', 164, 64);
  context.fillStyle = '#d9e7f5';
  context.font = 'bold 22px Arial, sans-serif';
  context.fillText('EMPLOYEE IDENTITY CARD', 164, 105);
  context.textAlign = 'right';
  context.fillStyle = '#ffffff';
  context.font = 'bold 25px Arial, sans-serif';
  context.fillText(employee.employeeId || 'EMP-S----', 963, 131);

  const photoX = 54;
  const photoY = 194;
  const photoWidth = 188;
  const photoHeight = 244;
  context.fillStyle = '#e2e8f0';
  context.fillRect(photoX - 4, photoY - 4, photoWidth + 8, photoHeight + 8);
  if (photoImage) {
    drawCover(context, photoImage, photoX, photoY, photoWidth, photoHeight);
  } else {
    context.fillStyle = '#cbd5e1';
    context.fillRect(photoX, photoY, photoWidth, photoHeight);
    context.fillStyle = '#475569';
    context.font = 'bold 52px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText((employee.fullName || '?').slice(0, 1).toUpperCase(), photoX + photoWidth / 2, photoY + 139);
  }

  context.textAlign = 'left';
  context.fillStyle = '#64748b';
  context.font = 'bold 15px Arial, sans-serif';
  context.fillText('EMPLOYEE NAME', 278, 221);
  context.fillStyle = '#0f172a';
  context.font = 'bold 27px Arial, sans-serif';
  context.fillText(String(employee.fullName || '—').slice(0, 30), 278, 255);
  context.fillStyle = '#64748b';
  context.font = 'bold 15px Arial, sans-serif';
  context.fillText('DESIGNATION', 278, 300);
  context.fillStyle = '#334155';
  context.font = '22px Arial, sans-serif';
  context.fillText(String(employee.designation || 'Staff').slice(0, 33), 278, 331);
  context.fillStyle = '#64748b';
  context.font = 'bold 15px Arial, sans-serif';
  context.fillText('EMPLOYEE ID', 278, 374);
  context.fillStyle = '#102c50';
  context.font = 'bold 22px Arial, sans-serif';
  context.fillText(employee.employeeId || '—', 278, 406);
  context.fillStyle = '#64748b';
  context.font = 'bold 15px Arial, sans-serif';
  context.fillText('MOBILE NUMBER', 278, 449);
  context.fillStyle = '#334155';
  context.font = '22px Arial, sans-serif';
  context.fillText(employee.mobileNumber || employee.mobile || '—', 278, 480);

  context.fillStyle = '#e2e8f0';
  context.fillRect(750, 192, 2, 282);
  if (qrImage) {
    context.imageSmoothingEnabled = false;
    context.drawImage(qrImage, 773, 225, 190, 190);
    context.imageSmoothingEnabled = true;
  }
  context.fillStyle = '#475569';
  context.textAlign = 'center';
  context.font = 'bold 15px Arial, sans-serif';
  context.fillText('SCAN TO VERIFY DETAILS', 868, 444);

  context.fillStyle = '#102c50';
  context.fillRect(14, 522, EMPLOYEE_ID_CARD_WIDTH - 28, 102);
  context.textAlign = 'left';
  context.fillStyle = '#ffffff';
  context.font = 'bold 17px Arial, sans-serif';
  context.fillText('SIKKA INDUSTRIES & LOGISTICS', 52, 555);
  context.font = '15px Arial, sans-serif';
  context.fillText(`Corporate Office: ${EMPLOYEE_ID_CARD_ADDRESS}`, 52, 584);
  context.fillStyle = '#d9e7f5';
  context.fillText(EMPLOYEE_ID_CARD_WEBSITE, 52, 608);
  context.textAlign = 'right';
  context.fillStyle = '#d9e7f5';
  context.font = 'bold 13px Arial, sans-serif';
  context.fillText('AUTHORIZED SIGNATURE', 958, 592);
}

function getAuthHeaders() {
  try {
    const token = window.localStorage.getItem('attendance_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export default function EmployeeIdCard({ employeeId, onClose, onError }) {
  const canvasRef = useRef(null);
  const [employee, setEmployee] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cardReady, setCardReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const qrText = useMemo(() => (employee ? buildEmployeeQrContent(employee) : ''), [employee]);

  useEffect(() => {
    let active = true;
    let imageUrl = '';

    async function loadEmployeeCard() {
      setLoading(true);
      setError('');
      setCardReady(false);
      try {
        const headers = getAuthHeaders();
        const response = await fetch(`/api/employees/${encodeURIComponent(employeeId)}`, { headers });
        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText);
        } catch {
          throw new Error(
            `Unable to load employee details (HTTP ${response.status}). The server returned an invalid response.`
          );
        }
        if (!response.ok) {
          throw new Error(result.error || `Unable to load employee details (HTTP ${response.status}).`);
        }
        if (!result.employee || typeof result.employee !== 'object') {
          throw new Error('The server response did not include employee details.');
        }

        if (result.employee.hasPhoto) {
          const photoResponse = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/photo`, { headers });
          if (!photoResponse.ok) throw new Error('Unable to load the employee photo.');
          const nextUrl = URL.createObjectURL(await photoResponse.blob());
          if (active) imageUrl = nextUrl;
          else URL.revokeObjectURL(nextUrl);
        }
        if (active) {
          setEmployee(result.employee);
          setPhotoUrl(imageUrl);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load the ID card.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEmployeeCard();
    return () => {
      active = false;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [employeeId]);

  useEffect(() => {
    let active = true;
    async function renderCard() {
      if (!employee || !canvasRef.current) return;
      try {
        const qrUrl = await QRCode.toDataURL(qrText, {
          errorCorrectionLevel: 'M',
          margin: 4,
          width: 380,
          color: { dark: '#102c50', light: '#ffffff' },
        });
        const [qrImage, photoImage, logoImage] = await Promise.all([
          loadImage(qrUrl),
          photoUrl ? loadImage(photoUrl) : Promise.resolve(null),
          loadImage(sikkaLogo.src),
        ]);
        if (active && canvasRef.current) {
          drawCard(canvasRef.current, employee, qrImage, photoImage, logoImage);
          setCardReady(true);
        }
      } catch (renderError) {
        if (active) setError(renderError.message || 'Unable to generate the ID card.');
      }
    }
    renderCard();
    return () => { active = false; };
  }, [employee, photoUrl, qrText]);

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      const png = await new Promise((resolve, reject) => {
        canvasRef.current.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not export the ID card as PNG.'));
        }, 'image/png');
      });
      const printPng = addPrintDpiMetadata(await png.arrayBuffer());
      const url = URL.createObjectURL(printPng);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${employee.employeeId || 'employee-id-card'}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download the ID card.');
      onError?.(downloadError.message || 'Failed to download the ID card.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Employee ID Card" maxWidth="max-w-4xl">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Loading employee ID card...
        </div>
      ) : error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
      ) : employee ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Print-size landscape card · 85.6 × 54 mm · 1011 × 638 px · 300 DPI
          </p>
          <canvas
            ref={canvasRef}
            width={EMPLOYEE_ID_CARD_WIDTH}
            height={EMPLOYEE_ID_CARD_HEIGHT}
            aria-label={`ID card for ${employee.fullName}`}
            className="block h-auto w-full rounded-lg border border-slate-200 shadow-sm"
          />
          {!employee.hasPhoto && (
            <p className="text-xs text-amber-700">No photo uploaded. This card uses a name initial; add a photo by editing the employee.</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || !cardReady}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {downloading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download ID Card PNG
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
