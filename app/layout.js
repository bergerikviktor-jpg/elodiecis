import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";

export const metadata = {
  title: "ElodieCIS — Produktionssvit",
  description:
    "CRM- och projekthanteringsplattform för mediebyråer och produktionsbolag.",
};

export default function RootLayout({ children }) {
  return (
    // `suppressHydrationWarning` silences a specific class of hydration
    // mismatches caused by browser extensions that inject attributes on
    // <html>/<body> *before* React hydrates (e.g. password managers,
    // Trustpilot-style "bis_register", Grammarly's `data-new-gr-c-s-*`,
    // dark-reader, etc.). It only affects the html/body element pair —
    // hydration mismatches in our own components still surface normally.
    <html lang="sv" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
