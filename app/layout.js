import './globals.css';

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
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
