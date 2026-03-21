import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";
import TopBar from "./components/TopBar";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Syne:wght@400..800&family=Russo+One&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen text-white">
        <div className="bg-blobs" aria-hidden="true"><span /></div>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <TopBar />
      <Outlet />
    </>
  );
}
