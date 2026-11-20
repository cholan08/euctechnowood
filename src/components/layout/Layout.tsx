import { Link, Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo';

export function Layout() {
  return (
    <div className="shell">
      <header className="site-header">
        <nav className="nav-pill" aria-label="Main">
          <Link to="/" aria-label="Room Studio home" className="nav-home">
            <Logo />
          </Link>
          <div className="nav-links">
            <a href="https://www.euctechnowood.com/" target="_blank" rel="noreferrer">
              euctechnowood.com
            </a>
          </div>
          <a className="btn btn-sm nav-cta" href="https://www.euctechnowood.com/" target="_blank" rel="noreferrer">
            Book a demo
          </a>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <img src="/brand/logo.png" alt="EUC Technowood" width={130} height={39} className="footer-logo" />
          <p>
            AI designs are concept images for inspiration. They are not to scale and not a buildable drawing.
          </p>
          <p>
            © {new Date().getFullYear()} EUC Technowood · Authorized Hexagon reseller in India
          </p>
        </div>
      </footer>
    </div>
  );
}
