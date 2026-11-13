'use client';

import { useEffect, useState } from 'react';

function getAuthHeaders() {
  try {
    const token = window.localStorage.getItem('attendance_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export default function EmployeeAvatar({ employee, className = '' }) {
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    if (employee.hasPhoto && employee._id) {
      fetch(`/api/employees/${encodeURIComponent(employee._id)}/photo`, {
        headers: getAuthHeaders(),
      })
        .then((response) => {
          if (!response.ok) throw new Error('Employee photo could not be loaded.');
          return response.blob();
        })
        .then((blob) => {
          const nextUrl = URL.createObjectURL(blob);
          if (active) {
            objectUrl = nextUrl;
            setPhotoUrl(nextUrl);
          } else {
            URL.revokeObjectURL(nextUrl);
          }
        })
        .catch((error) => console.error(error));
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPhotoUrl('');
    };
  }, [employee._id, employee.hasPhoto]);

  if (!photoUrl) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-400 ${className}`}>
        {(employee.fullName || employee.name || '?').slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={`${employee.fullName || employee.name || 'Employee'} portrait`}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
