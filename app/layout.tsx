import './globals.css';

export const metadata = {
  title: 'World Cup 2026 Planner',
  description: 'Plan your watch parties and hosting schedule.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}