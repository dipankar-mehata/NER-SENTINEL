import "@/styles/globals.css";
import type { AppProps } from "next/app";
import '../lib/i18n'; // Initialize i18n globally

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
