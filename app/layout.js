import './globals.css';
import { I18nProvider } from '../components/I18nProvider';

export const metadata = {
  title: 'Calorfy Pro — Portal profesional',
  description: 'Seguimiento nutricional y conductual para profesionales.',
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#061914',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
