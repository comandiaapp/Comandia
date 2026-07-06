import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  Menu,
  X,
  MonitorSmartphone,
  ChefHat,
  BarChart3,
  Package,
  CreditCard,
  Cloud,
  Check,
  Quote,
  Globe,
  Share2,
  AtSign,
  Download,
} from 'lucide-react';

const NARANJA_GRADIENTE = 'linear-gradient(135deg, #FF6B00 0%, #F97316 55%, #FFAD60 100%)';
const CREMA = '#FFFBF5';
const EMAIL_CONTACTO = 'comandiaapp@gmail.com';
const URL_DESCARGA_WINDOWS =
  'https://github.com/comandiaapp/Comandia/releases/latest/download/Comandia_1.1.1_x64-setup.exe';

const SECCIONES_NAV = [
  { id: 'funciones', label: 'Funciones' },
  { id: 'precios', label: 'Precios' },
];

const DOLORES = [
  {
    emoji: '😰',
    titulo: 'Cierras la caja y no cuadra',
    texto: 'Cada noche el mismo estrés contando billetes sin saber de dónde viene la diferencia.',
  },
  {
    emoji: '📝',
    titulo: 'Las comandas en papel se pierden',
    texto: 'Un pedido mal tomado, un cliente molesto, una propina que nunca llegó a cocina.',
  },
  {
    emoji: '📊',
    titulo: 'No sabes qué plato te deja más',
    texto: 'Vendes mucho pero ganas poco y no entiendes por qué.',
  },
];

const FEATURES = [
  {
    Icono: MonitorSmartphone,
    titulo: 'POS táctil intuitivo',
    texto: 'Toma pedidos por mesa, barra o domicilio en segundos. Tu equipo lo aprende en minutos.',
  },
  {
    Icono: ChefHat,
    titulo: 'Cocina conectada (KDS)',
    texto: 'Los pedidos llegan directo a la pantalla de cocina. Sin papel, sin gritos, sin errores.',
  },
  {
    Icono: BarChart3,
    titulo: 'Reportes en tiempo real',
    texto: 'Ventas, productos estrella y cierre de caja con un click. Sabe cuánto ganaste antes de cerrar.',
  },
  {
    Icono: Package,
    titulo: 'Control de inventario',
    texto: 'El sistema descuenta automáticamente lo que vendes. Nunca más quedarte sin ingredientes a media noche.',
  },
  {
    Icono: CreditCard,
    titulo: 'Cobra como quieras',
    texto: 'Efectivo, tarjeta, Nequi, transferencia o mixto. Con factura electrónica incluida.',
  },
  {
    Icono: Cloud,
    titulo: 'En la nube, siempre disponible',
    texto: 'Accede desde cualquier PC o tablet. Tus datos seguros aunque se vaya la luz.',
  },
];

const PASOS = [
  { numero: '1', titulo: 'Crea tu cuenta', texto: 'En 2 minutos, sin tarjeta' },
  { numero: '2', titulo: 'Configura tu menú', texto: 'Agrega tus platos y mesas' },
  { numero: '3', titulo: '¡A vender!', texto: 'Tu equipo listo desde el primer día' },
];

const PLANES = [
  {
    nombre: 'Básico',
    precio: '$89.000',
    destacado: false,
    beneficios: [
      '1 sucursal',
      'Hasta 3 usuarios',
      'POS + Cocina + Reportes básicos',
      'Soporte por email',
    ],
    boton: 'Empezar gratis',
  },
  {
    nombre: 'Profesional',
    precio: '$179.000',
    destacado: true,
    beneficios: [
      '1 sucursal',
      'Hasta 10 usuarios',
      'Todo lo del básico',
      'Inventario + Contaduría',
      'Facturación electrónica',
      'Soporte prioritario',
    ],
    boton: 'Empezar gratis',
  },
  {
    nombre: 'Empresarial',
    precio: '$299.000',
    destacado: false,
    beneficios: [
      'Hasta 3 sucursales',
      'Usuarios ilimitados',
      'Todo lo anterior',
      'Multi-sucursal',
      'Reportes avanzados',
      'Soporte dedicado',
    ],
    boton: 'Contactar ventas',
  },
];

const TESTIMONIOS = [
  {
    inicial: 'C',
    texto: 'Antes cuadraba la caja a las 2am. Ahora en 10 minutos.',
    nombre: 'Carlos M.',
    restaurante: 'Restaurante El Rincón',
  },
  {
    inicial: 'M',
    texto: 'Mi cocina funciona como reloj desde que instalamos Comandia.',
    nombre: 'María L.',
    restaurante: 'Pizzería La Italiana',
  },
  {
    inicial: 'A',
    texto: 'Por fin sé qué platos me dejan dinero y cuáles no.',
    nombre: 'Andrés R.',
    restaurante: 'Burger House',
  },
];

function useRevelado() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

const OCULTO_POR_DIRECCION = {
  up: 'translate-y-6 opacity-0',
  left: '-translate-x-10 opacity-0',
};

function Reveal({ children, className = '', delay = 0, direction = 'up' }) {
  const { ref, visible } = useRevelado();

  return (
    <div
      ref={ref}
      className={`transition-all duration-[600ms] ease-out ${
        visible ? 'translate-x-0 translate-y-0 opacity-100' : OCULTO_POR_DIRECCION[direction]
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function useNavbarConSombra() {
  const [conSombra, setConSombra] = useState(false);

  useEffect(() => {
    function alScrollear() {
      setConSombra(window.scrollY > 12);
    }
    alScrollear();
    window.addEventListener('scroll', alScrollear);
    return () => window.removeEventListener('scroll', alScrollear);
  }, []);

  return conSombra;
}

function irASeccion(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Navbar() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const conSombra = useNavbarConSombra();

  function alClickSeccion(id) {
    setMenuAbierto(false);
    irASeccion(id);
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        conSombra
          ? 'bg-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur-md'
          : 'bg-white'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <UtensilsCrossed
            className="text-[#F97316] drop-shadow-[0_2px_10px_rgba(249,115,22,0.45)]"
            size={32}
          />
          <span className="text-2xl font-extrabold text-[#1A1A1A]">Comandia</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {SECCIONES_NAV.map((seccion) => (
            <button
              key={seccion.id}
              onClick={() => alClickSeccion(seccion.id)}
              className="text-sm font-medium text-[#5A5A5A] transition-colors hover:text-[#F97316]"
            >
              {seccion.label}
            </button>
          ))}
          <a
            href={`mailto:${EMAIL_CONTACTO}`}
            className="text-sm font-medium text-[#5A5A5A] transition-colors hover:text-[#F97316]"
          >
            Contacto
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={URL_DESCARGA_WINDOWS}
            className="flex items-center gap-1.5 rounded-lg border border-[#FFD0A0] px-4 py-2 text-sm font-semibold text-[#F97316] transition-colors hover:bg-[#FFF3E0]"
          >
            <Download size={16} />
            Descargar
          </a>
          <Link
            to="/login"
            className="rounded-lg border border-[#FFD0A0] px-4 py-2 text-sm font-semibold text-[#F97316] transition-colors hover:bg-[#FFF3E0]"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(249,115,22,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#EA6C0A] hover:shadow-[0_12px_26px_rgba(249,115,22,0.45)]"
          >
            Empieza gratis
          </Link>
        </div>

        <button
          onClick={() => setMenuAbierto((v) => !v)}
          className="text-[#1A1A1A] md:hidden"
          aria-label="Abrir menú"
        >
          {menuAbierto ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {menuAbierto && (
        <div className="border-t border-[#FFE0C0] bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {SECCIONES_NAV.map((seccion) => (
              <button
                key={seccion.id}
                onClick={() => alClickSeccion(seccion.id)}
                className="py-1 text-left text-sm font-medium text-[#5A5A5A] hover:text-[#F97316]"
              >
                {seccion.label}
              </button>
            ))}
            <a
              href={`mailto:${EMAIL_CONTACTO}`}
              className="py-1 text-left text-sm font-medium text-[#5A5A5A] hover:text-[#F97316]"
            >
              Contacto
            </a>
            <hr className="border-[#FFE0C0]" />
            <a
              href={URL_DESCARGA_WINDOWS}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#FFD0A0] px-4 py-2 text-center text-sm font-semibold text-[#F97316]"
            >
              <Download size={16} />
              Descargar
            </a>
            <Link
              to="/login"
              className="rounded-lg border border-[#FFD0A0] px-4 py-2 text-center text-sm font-semibold text-[#F97316]"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="rounded-lg bg-[#F97316] px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Empieza gratis
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function MockupDashboard() {
  const itemsSidebar = ['w-8', 'w-5', 'w-6', 'w-4', 'w-7'];

  return (
    <div className="relative mx-auto mt-12 w-full max-w-3xl px-2 sm:mt-16">
      <div className="rounded-2xl bg-[#26262A] p-2.5 shadow-2xl sm:p-3">
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
          <span className="h-2 w-2 rounded-full bg-[#FEBC2E]" />
          <span className="h-2 w-2 rounded-full bg-[#28C840]" />
        </div>

        <div className="flex overflow-hidden rounded-lg bg-[#FFE8D1]">
          <div className="hidden w-14 flex-shrink-0 flex-col items-center gap-4 bg-[#F97316] py-4 sm:flex">
            {itemsSidebar.map((ancho, i) => (
              <span key={i} className={`h-1.5 ${ancho} rounded-full bg-white/70`} />
            ))}
          </div>

          <div className="flex-1 p-3 sm:p-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {[
                { label: 'Ventas hoy', valor: '$1.284.000' },
                { label: 'Pedidos', valor: '47' },
                { label: 'Mesas activas', valor: '9 / 12' },
                { label: 'Ticket promedio', valor: '$27.300' },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg bg-white p-2.5 shadow-sm sm:p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A] sm:text-[11px]">
                    {tile.label}
                  </p>
                  <p className="mt-1 text-base font-bold text-[#1A1A1A] sm:text-xl">{tile.valor}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-end gap-1.5 rounded-lg bg-white p-3 sm:mt-4 sm:gap-2 sm:p-4">
              {[40, 65, 50, 80, 55, 90, 70].map((alto, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-[#F97316] to-[#FFAD60]"
                  style={{ height: `${alto * 0.6}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto h-3 w-[94%] rounded-b-2xl bg-[#3A3A40]" />
      <div className="mx-auto h-1.5 w-[55%] rounded-b-xl bg-[#26262A]" />
    </div>
  );
}

function FormasDecorativas() {
  return (
    <>
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-white/10 sm:-right-16 sm:-top-24 sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/10 sm:h-64 sm:w-64" />
    </>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20"
      style={{ backgroundImage: NARANJA_GRADIENTE }}
    >
      <FormasDecorativas />

      <div className="relative">
        <Reveal className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
            ✨ Nuevo — Versión 1.0 disponible
          </span>

          <h1
            className="mt-6 text-4xl font-black leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl md:text-6xl lg:text-[5rem]"
            style={{ textShadow: '0 8px 30px rgba(0,0,0,0.18)' }}
          >
            Tu restaurante,
            <br />
            finalmente bajo control
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-white/85 sm:text-lg">
            Comandia es el sistema POS que los dueños de restaurante necesitaban: simple, rápido y que te dice
            exactamente cuánto ganas cada día.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/registro"
              className="w-full rounded-lg bg-white px-7 py-3 text-base font-bold text-[#F97316] shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[0_16px_36px_rgba(0,0,0,0.25)] sm:w-auto"
            >
              Empieza gratis — 14 días
            </Link>
            <button
              onClick={() => irASeccion('funciones')}
              className="w-full rounded-lg border-2 border-white/80 px-7 py-3 text-base font-semibold text-white transition-all hover:-translate-y-1 hover:bg-white/10 sm:w-auto"
            >
              Ver demo
            </button>
            <a
              href={URL_DESCARGA_WINDOWS}
              className="w-full rounded-lg border-2 border-white/80 px-7 py-3 text-base font-semibold text-white transition-all hover:-translate-y-1 hover:bg-white/10 sm:w-auto"
            >
              ⬇️ Descargar para Windows
            </a>
          </div>
          <p className="mt-3 text-xs font-medium text-white/70">Windows 10+ • 64 bits • Gratis</p>
          <p className="mt-1 text-xs text-white/60">
            ⚠️ Si Windows muestra una advertencia de seguridad, haz click en "Más información" → "Ejecutar de todas
            formas". Es completamente seguro.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm font-medium text-white/90">
            <span className="rounded-full border border-white/30 bg-white/20 px-4 py-1.5">⚡ Listo en 5 minutos</span>
            <span className="rounded-full border border-white/30 bg-white/20 px-4 py-1.5">🔒 Sin tarjeta de crédito</span>
            <span className="rounded-full border border-white/30 bg-white/20 px-4 py-1.5">
              📱 Funciona en cualquier dispositivo
            </span>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <MockupDashboard />
        </Reveal>
      </div>
    </section>
  );
}

function Problema() {
  return (
    <section
      className="bg-white px-4 py-20 sm:px-6"
      style={{
        backgroundImage: 'radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold text-[#1A1A1A] sm:text-4xl">¿Te suena familiar?</h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {DOLORES.map((dolor, i) => (
            <Reveal key={dolor.titulo} delay={i * 120} direction="left">
              <div className="h-full rounded-2xl border-l-4 border-l-[#F97316] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_16px_36px_rgba(0,0,0,0.12)]">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFE8D1] text-3xl">
                  {dolor.emoji}
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#1A1A1A]">{dolor.titulo}</h3>
                <p className="mt-2 text-sm text-[#5A5A5A]">{dolor.texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Funciones() {
  return (
    <section
      id="funciones"
      className="px-4 py-20 sm:px-6"
      style={{ backgroundImage: `linear-gradient(180deg, #FFFFFF 0%, ${CREMA} 100%)` }}
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold text-[#1A1A1A] sm:text-4xl">
            Todo lo que necesitas, nada de lo que no
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icono, titulo, texto }, i) => (
            <Reveal key={titulo} delay={(i % 3) * 100}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-transparent bg-white p-6 shadow-[0_4px_20px_rgba(249,115,22,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#F97316] hover:shadow-[0_16px_36px_rgba(249,115,22,0.2)]">
                <span className="pointer-events-none absolute right-4 top-3 text-4xl font-black text-black/5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F97316]/10 text-[#F97316]">
                  <Icono size={22} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#1A1A1A]">{titulo}</h3>
                <p className="mt-2 text-sm text-[#5A5A5A]">{texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComoFunciona() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold text-[#1A1A1A] sm:text-4xl">Empieza en 3 pasos</h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
          {PASOS.map((paso, i) => (
            <Reveal key={paso.numero} delay={i * 120} className="relative text-center">
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#F97316] opacity-30" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#F97316] text-xl font-extrabold text-white">
                  {paso.numero}
                </div>
              </div>
              {i < PASOS.length - 1 && (
                <div className="absolute left-1/2 top-7 hidden w-full border-t-2 border-dashed border-[#F97316]/40 sm:block" />
              )}
              <h3 className="mt-4 text-lg font-bold text-[#1A1A1A]">{paso.titulo}</h3>
              <p className="mt-1 text-sm text-[#5A5A5A]">{paso.texto}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TarjetaPrecio({ plan }) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl p-7 transition-transform duration-300 ${
        plan.destacado
          ? 'border-2 border-[#F97316] bg-[#1A1A1A] text-white shadow-[0_24px_50px_rgba(249,115,22,0.35)] sm:-translate-y-3 sm:scale-105'
          : 'bg-white text-[#1A1A1A] shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(0,0,0,0.1)]'
      }`}
    >
      {plan.destacado && (
        <span
          className="absolute -top-3.5 left-1/2 w-fit -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md"
          style={{ backgroundImage: NARANJA_GRADIENTE }}
        >
          Más popular
        </span>
      )}
      <h3 className="text-lg font-bold">{plan.nombre}</h3>
      <p className="mt-2">
        <span className="text-3xl font-extrabold">{plan.precio}</span>
        <span className={`text-sm ${plan.destacado ? 'text-white/70' : 'text-[#5A5A5A]'}`}>/mes</span>
      </p>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.beneficios.map((beneficio) => (
          <li key={beneficio} className="flex items-start gap-2 text-sm">
            <Check size={17} className="mt-0.5 flex-shrink-0 text-[#F97316]" />
            <span className={plan.destacado ? 'text-white/90' : 'text-[#5A5A5A]'}>{beneficio}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/registro"
        className={`mt-7 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
          plan.destacado
            ? 'bg-[#F97316] text-white hover:bg-[#EA6C0A]'
            : 'border border-[#FFD0A0] text-[#F97316] hover:bg-[#FFF3E0]'
        }`}
      >
        {plan.boton}
      </Link>
    </div>
  );
}

function TogglePeriodo({ anual, onChange }) {
  return (
    <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-[#FFD0A0] bg-white p-1">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          !anual ? 'bg-[#F97316] text-white' : 'text-[#5A5A5A]'
        }`}
      >
        Mensual
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          anual ? 'bg-[#F97316] text-white' : 'text-[#5A5A5A]'
        }`}
      >
        Anual
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            anual ? 'bg-white/20 text-white' : 'bg-[#16A34A]/10 text-[#16A34A]'
          }`}
        >
          Ahorra 20%
        </span>
      </button>
    </div>
  );
}

function Precios() {
  const [anual, setAnual] = useState(false);

  return (
    <section id="precios" className="px-4 py-20 sm:px-6" style={{ backgroundColor: CREMA }}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="text-3xl font-extrabold text-[#1A1A1A] sm:text-4xl">Precios claros, sin sorpresas</h2>
          <p className="mt-3 text-[#5A5A5A]">14 días gratis en todos los planes</p>
          <TogglePeriodo anual={anual} onChange={setAnual} />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-center">
          {PLANES.map((plan, i) => (
            <Reveal key={plan.nombre} delay={i * 100} className="h-full">
              <TarjetaPrecio plan={plan} />
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-10 text-center text-sm text-[#5A5A5A]">
            ¿Tienes un código especial? Ingrésalo al registrarte
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Testimonios() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold text-[#1A1A1A] sm:text-4xl">
            Lo que dicen nuestros restaurantes
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIOS.map((testimonio, i) => (
            <Reveal key={testimonio.nombre} delay={i * 100}>
              <div className="relative h-full overflow-hidden rounded-2xl border border-[#FFE0C0] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(0,0,0,0.1)]">
                <Quote className="absolute right-4 top-4 text-[#FFE0C0]" size={40} />
                <p className="relative text-sm italic text-[#1A1A1A]">"{testimonio.texto}"</p>
                <div className="relative mt-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#FFAD60] text-sm font-bold text-white">
                    {testimonio.inicial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{testimonio.nombre}</p>
                    <p className="text-xs text-[#5A5A5A]">{testimonio.restaurante}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaFinal() {
  return (
    <section
      className="relative overflow-hidden px-4 py-20 text-center sm:px-6"
      style={{ backgroundImage: NARANJA_GRADIENTE }}
    >
      <FormasDecorativas />

      <Reveal className="relative mx-auto max-w-2xl">
        <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
          ¿Listo para tomar el control de tu restaurante?
        </h2>
        <p className="mt-4 text-white/85">Únete a los restaurantes que ya usan Comandia</p>
        <Link
          to="/registro"
          className="group relative mt-8 inline-block overflow-hidden rounded-lg bg-white px-8 py-3 text-base font-bold text-[#F97316] shadow-lg transition-transform hover:scale-[1.03]"
        >
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#F97316]/20 to-transparent group-hover:animate-shimmer" />
          <span className="relative">Crear cuenta gratis</span>
        </Link>
        <p className="mt-5 text-sm text-white/80">Cancela cuando quieras • Soporte en español</p>
        <a
          href={URL_DESCARGA_WINDOWS}
          className="mt-3 inline-block text-sm font-semibold text-white underline decoration-white/50 underline-offset-4 transition-colors hover:text-white/90"
        >
          O descarga la app para Windows →
        </a>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contacto" className="bg-[#1A1A1A]">
      <div className="h-1 w-full" style={{ backgroundImage: NARANJA_GRADIENTE }} />

      <div className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="text-white" size={26} />
              <span className="text-lg font-extrabold text-white">Comandia</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/70">
              <button onClick={() => irASeccion('funciones')} className="transition-colors hover:text-[#F97316]">
                Funciones
              </button>
              <button onClick={() => irASeccion('precios')} className="transition-colors hover:text-[#F97316]">
                Precios
              </button>
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

            <div className="flex items-center gap-4 text-white/70">
              <Globe size={20} className="transition-colors hover:text-[#F97316]" />
              <Share2 size={20} className="transition-colors hover:text-[#F97316]" />
              <a href={`mailto:${EMAIL_CONTACTO}`} aria-label="Enviar email" className="transition-colors hover:text-[#F97316]">
                <AtSign size={20} />
              </a>
            </div>
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

function Landing() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <Hero />
      <Problema />
      <Funciones />
      <ComoFunciona />
      <Precios />
      <Testimonios />
      <CtaFinal />
      <Footer />
    </div>
  );
}

export default Landing;
