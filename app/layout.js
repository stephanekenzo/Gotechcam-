import "./globals.css";
export const metadata = { title: "GOTECHCAM Gestion", description: "Gestion commerciale et stock" };
export const viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }) {
  return <html lang="fr"><body>{children}</body></html>;
}
