import { redirect } from 'next/navigation';

export default function RoomsRedirectPage() {
  // Permanently remove this page by redirecting to Home
  redirect('/');
}
