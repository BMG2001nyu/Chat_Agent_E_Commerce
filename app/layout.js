import './globals.css';

export const metadata = {
  title: 'PartSelect Chat Agent',
  description: 'Find refrigerator and dishwasher parts with AI-powered assistance',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
