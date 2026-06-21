import type { Metadata, Viewport } from 'next';
import { Roboto_Flex } from 'next/font/google';
import './globals.css';

// Roboto Flex — the design system's typeface. Exposed as --font-roboto-flex,
// which globals.css feeds into --cc-font.
const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  variable: '--font-roboto-flex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Coat Check — what should I wear?',
  description: 'Turns the weather into what to wear, tuned to how you feel the cold.',
};

export const viewport: Viewport = {
  themeColor: '#8e4b2c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={robotoFlex.variable}>
      <body>{children}</body>
    </html>
  );
}
