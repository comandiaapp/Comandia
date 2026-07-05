import { Link } from 'react-router-dom';
import { UtensilsCrossed, ChevronRight } from 'lucide-react';

const EMAIL_CONTACTO = 'comandiaapp@gmail.com';

function NavbarLegal() {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <UtensilsCrossed
            className="text-[#F97316] drop-shadow-[0_2px_10px_rgba(249,115,22,0.45)]"
            size={32}
          />
          <span className="text-2xl font-extrabold text-[#1A1A1A]">Comandia</span>
        </Link>

        <Link
          to="/registro"
          className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#EA6C0A]"
        >
          Empieza gratis
        </Link>
      </div>
    </header>
  );
}

function FooterLegal() {
  return (
    <footer className="bg-[#1A1A1A]">
      <div
        className="h-1 w-full"
        style={{ backgroundImage: 'linear-gradient(135deg, #FF6B00 0%, #F97316 55%, #FFAD60 100%)' }}
      />
      <div className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="text-white" size={24} />
              <span className="text-lg font-extrabold text-white">Comandia</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <a href={`mailto:${EMAIL_CONTACTO}`} className="transition-colors hover:text-[#F97316]">
                Contacto
              </a>
              <Link to="/terminos" className="transition-colors hover:text-[#F97316]">
                Términos
              </Link>
              <Link to="/privacidad" className="transition-colors hover:text-[#F97316]">
                Privacidad
              </Link>
            </nav>
          </div>

          <hr className="my-8 border-white/10" />

          <p className="text-center text-xs text-white/50">
            © 2026 Comandia. Hecho con ❤️ para restaurantes colombianos
          </p>
        </div>
      </div>
    </footer>
  );
}

function Breadcrumb({ actual }) {
  return (
    <nav className="mx-auto flex max-w-3xl items-center gap-1.5 px-4 pt-8 text-sm text-[#5A5A5A] sm:px-6">
      <Link to="/" className="transition-colors hover:text-[#F97316]">
        Inicio
      </Link>
      <ChevronRight size={14} />
      <span className="font-medium text-[#1A1A1A]">{actual}</span>
    </nav>
  );
}

function LegalLayout({ titulo, actualizado, children }) {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <NavbarLegal />
      <Breadcrumb actual={titulo} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold text-[#1A1A1A] sm:text-4xl">{titulo}</h1>
        {actualizado && <p className="mt-2 text-sm text-[#5A5A5A]">Última actualización: {actualizado}</p>}

        <div className="prose-legal mt-8 space-y-8 text-[#3A3A3A]">{children}</div>
      </main>

      <FooterLegal />
    </div>
  );
}

export default LegalLayout;
