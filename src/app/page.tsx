import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get('sikka_session');

  // Skip login screen if a valid session exists
  if (session) {
    redirect('/dashboard');
  }

  redirect('/login');
}
