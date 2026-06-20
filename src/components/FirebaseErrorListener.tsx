'use client';

import { useEffect, useState } from 'react';

/**
 * FirebaseErrorListener removed/disabled (Firebase/Firestore removed from this project).
 * Kept as a no-op for compatibility with existing imports.
 */
export function FirebaseErrorListener() {
  useEffect(() => {}, []);
  const [error] = useState<Error | null>(null);
  if (error) throw error;
  return null;
}

