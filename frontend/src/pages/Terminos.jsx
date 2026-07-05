import LegalLayout from '../components/LegalLayout';

function Seccion({ numero, titulo, children }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-[#1A1A1A]">
        {numero}. {titulo}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed sm:text-base">{children}</div>
    </section>
  );
}

function Terminos() {
  return (
    <LegalLayout titulo="Términos y Condiciones" actualizado="5 de julio de 2026">
      <p className="text-sm leading-relaxed sm:text-base">
        Estos Términos y Condiciones regulan el uso de Comandia, un software de gestión para restaurantes ofrecido
        bajo la modalidad de Software como Servicio (SaaS).
      </p>

      <Seccion numero={1} titulo="Identificación del servicio">
        <p>
          Comandia es un software de punto de venta (POS) para restaurantes, ofrecido como servicio en la nube
          (SaaS). Es desarrollado y operado por Comandia.
        </p>
        <p>
          Para cualquier consulta relacionada con estos términos, puedes escribirnos a{' '}
          <a href="mailto:comandiaapp@gmail.com" className="font-medium text-[#F97316] hover:underline">
            comandiaapp@gmail.com
          </a>
          .
        </p>
      </Seccion>

      <Seccion numero={2} titulo="Aceptación de los términos">
        <p>
          Al registrarte y crear una cuenta en Comandia, aceptas quedar vinculado por estos Términos y Condiciones.
          Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar el servicio.
        </p>
      </Seccion>

      <Seccion numero={3} titulo="Descripción del servicio">
        <ul className="list-disc space-y-1 pl-5">
          <li>Software de gestión para restaurantes: punto de venta, cocina, inventario, reportes y facturación.</li>
          <li>Acceso disponible a través de la web y de una aplicación de escritorio para Windows.</li>
          <li>Almacenamiento de la información en la nube, con respaldo y disponibilidad continua.</li>
        </ul>
      </Seccion>

      <Seccion numero={4} titulo="Planes y pagos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Todos los planes incluyen un periodo de prueba (trial) gratuito de 14 días.</li>
          <li>
            Planes disponibles: Básico ($89.000 COP/mes), Profesional ($179.000 COP/mes) y Empresarial ($299.000
            COP/mes).
          </li>
          <li>Los pagos son procesados de forma segura por Mercado Pago.</li>
          <li>La suscripción se renueva automáticamente cada mes, salvo cancelación previa.</li>
          <li>Puedes cancelar tu suscripción en cualquier momento desde tu cuenta.</li>
        </ul>
      </Seccion>

      <Seccion numero={5} titulo="Uso aceptable">
        <ul className="list-disc space-y-1 pl-5">
          <li>El servicio debe usarse únicamente para fines comerciales legítimos relacionados con tu negocio.</li>
          <li>No debes compartir tus credenciales de acceso con terceros no autorizados.</li>
          <li>Está prohibido usar Comandia para actividades ilegales o fraudulentas.</li>
        </ul>
      </Seccion>

      <Seccion numero={6} titulo="Propiedad intelectual">
        <p>
          El software Comandia, su código, marca y diseño son propiedad de Comandia. Los datos que ingreses sobre tu
          restaurante (menú, ventas, clientes, inventario, etc.) son de tu propiedad.
        </p>
      </Seccion>

      <Seccion numero={7} titulo="Privacidad y datos">
        <p>
          El tratamiento de tus datos personales y los de tu negocio se rige por nuestra{' '}
          <a href="/privacidad" className="font-medium text-[#F97316] hover:underline">
            Política de Privacidad
          </a>
          . Tus datos se almacenan en servidores seguros.
        </p>
      </Seccion>

      <Seccion numero={8} titulo="Limitación de responsabilidad">
        <p>
          El servicio se provee "tal como está" ("as is"). Comandia no garantiza que el servicio sea ininterrumpido o
          esté libre de errores, y no será responsable por pérdidas de negocio, de ingresos o de datos derivadas del
          uso o la imposibilidad de uso del servicio, salvo lo dispuesto por la ley aplicable.
        </p>
      </Seccion>

      <Seccion numero={9} titulo="Modificaciones">
        <p>
          Podemos modificar estos términos en cualquier momento. Cualquier cambio relevante será notificado con al
          menos 30 días de aviso previo a través del correo electrónico registrado o dentro de la plataforma.
        </p>
      </Seccion>

      <Seccion numero={10} titulo="Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia relacionada con
          estos términos estará sujeta a la jurisdicción de los tribunales colombianos.
        </p>
      </Seccion>
    </LegalLayout>
  );
}

export default Terminos;
