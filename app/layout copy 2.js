import './globals.css';
import Link from 'next/link';
import { CPSProvider } from '../context/CPSContext';

export const metadata = {
  title: 'ACSM',
  description: 'ACSM Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <CPSProvider>
          <header className="acsm-topbar">
            <div className="acsm-topbar-inner">
              <div className="acsm-brand">
                <span className="acsm-brand-badge">ACSM</span>
                <div className="acsm-brand-text">
                  <strong>Manufacturing Coordination Platform</strong>
                  <span>Cognitive orchestration for CPS-based systems</span>
                </div>
              </div>

              <nav className="acsm-nav">
                <Link href="/" className="acsm-nav-link">
                  Home
                </Link>
              </nav>
            </div>
          </header>

          <main className="acsm-main-content">{children}</main>
        </CPSProvider>
      </body>
    </html>
  );
}
