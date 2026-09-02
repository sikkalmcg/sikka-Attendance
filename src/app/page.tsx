import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = cookies();
  const session = cookieStore.get('sikka_session');

  // Skip login screen if a valid session exists
  if (session?.value) {
    try {
      const parsed = JSON.parse(session.value);
      const role = String(parsed?.role || '').toUpperCase();
      const isEmployee = role === 'EMPLOYEE' ||
        (Array.isArray(parsed?.role) && parsed.role.map((r: any) => String(r).toUpperCase()).includes('EMPLOYEE')) ||
        (!!parsed?.employeeId && !['SUPER_ADMIN', 'ADMIN', 'HR', 'USER'].includes(role));

      if (isEmployee) {
        redirect('/dashboard/attendance');
      }
      redirect('/dashboard');
    } catch {
      redirect('/dashboard');
    }
  }

  redirect('/login');
}