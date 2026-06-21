import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coat Check — what should I wear?',
  description: 'Turns the weather into what to wear, tuned to how you feel the cold.',
};

export const viewport: Viewport = {
  themeColor: '#3aa0e8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
