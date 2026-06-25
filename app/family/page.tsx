import { redirect } from 'next/navigation';

// Family management moved into the consolidated /settings page. Keep this route as a redirect
// so existing links, bookmarks, and the home-screen accept-invite flow still land somewhere.
export default function FamilyPage() {
  redirect('/settings');
}
