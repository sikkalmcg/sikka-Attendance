import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = cookies();
  const session = cookieStore.get('sikka_session');

  // Skip login screen if a valid session exists
  if (session?.value) {
    try {
      const parsed = JSON.parse(session.value);
      if (String(parsed?.role).toUpperCase() === 'EMPLOYEE') {
        redirect('/dashboard/attendance');
      }
      redirect('/dashboard');
    } catch {
      redirect('/dashboard');
    }
  }

  redirect('/login');
}