import type { Metadata, Viewport } from 'next';
import { Roboto_Flex } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '@/components/I18nProvider';
import { version } from '../package.json';

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
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) inject attributes
          onto <body> before React hydrates, which would otherwise log a mismatch. */}
      <body suppressHydrationWarning>
        <I18nProvider>{children}</I18nProvider>
        {/* Faint, site-wide build marker — low element opacity so it reads as a watermark
            (the opacity modifier can't inject alpha into the CSS-var colour). */}
        <footer className="pb-4 pt-2 text-center text-[11px] tracking-wide text-on-surface-variant opacity-40">
          v{version}
        </footer>
      </body>
    </html>
  );
}
