export const metadata = { title: "Pose spike" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", margin: 16 }}>{children}</body>
    </html>
  );
}
