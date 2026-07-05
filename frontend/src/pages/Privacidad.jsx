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

function Privacidad() {
  return (
    <LegalLayout titulo="Política de Privacidad" actualizado="5 de julio de 2026">
      <p className="text-sm leading-relaxed sm:text-base">
        En Comandia respetamos tu privacidad y la de tus clientes. Esta política explica qué datos recopilamos, para
        qué los usamos y qué derechos tienes sobre ellos, conforme a la Ley 1581 de 2012 de Colombia.
      </p>

      <Seccion numero={1} titulo="Responsable del tratamiento">
        <p>
          El responsable del tratamiento de los datos personales es Comandia. Puedes contactarnos en{' '}
          <a href="mailto:comandiaapp@gmail.com" className="font-medium text-[#F97316] hover:underline">
            comandiaapp@gmail.com
          </a>
          .
        </p>
      </Seccion>

      <Seccion numero={2} titulo="Datos que recopilamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Nombre, correo electrónico y teléfono del administrador de la cuenta.</li>
          <li>Datos del restaurante: nombre, dirección y NIT.</li>
          <li>Datos de ventas y operación del restaurante generados por el uso del software.</li>
          <li>Datos de pago, procesados directamente por Mercado Pago. No almacenamos números de tarjeta.</li>
        </ul>
      </Seccion>

      <Seccion numero={3} titulo="Finalidad del tratamiento">
        <ul className="list-disc space-y-1 pl-5">
          <li>Proveer y operar el servicio de software.</li>
          <li>Procesar los pagos de tu suscripción.</li>
          <li>Enviar comunicaciones relacionadas con el servicio.</li>
          <li>Mejorar y desarrollar nuevas funciones del producto.</li>
        </ul>
      </Seccion>

      <Seccion numero={4} titulo="Base legal">
        <p>
          El tratamiento de tus datos se basa en el consentimiento del titular y en la ejecución del contrato de
          servicio, conforme a la Ley 1581 de 2012 de Colombia sobre protección de datos personales.
        </p>
      </Seccion>

      <Seccion numero={5} titulo="Compartición de datos">
        <p>Para operar el servicio, compartimos datos con los siguientes proveedores:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Mercado Pago, para el procesamiento de pagos.</li>
          <li>Railway, como proveedor de infraestructura en la nube.</li>
          <li>Brevo, para el envío de correos electrónicos del servicio.</li>
        </ul>
        <p>No vendemos ni cedemos tus datos a terceros con fines comerciales.</p>
      </Seccion>

      <Seccion numero={6} titulo="Derechos del titular">
        <p>Como titular de tus datos, tienes derecho a conocer, actualizar, rectificar y solicitar la eliminación de tus datos personales.</p>
        <p>
          Para ejercer estos derechos, escríbenos a{' '}
          <a href="mailto:comandiaapp@gmail.com" className="font-medium text-[#F97316] hover:underline">
            comandiaapp@gmail.com
          </a>
          .
        </p>
      </Seccion>

      <Seccion numero={7} titulo="Seguridad">
        <ul className="list-disc space-y-1 pl-5">
          <li>Toda la información viaja encriptada en tránsito mediante HTTPS.</li>
          <li>Las contraseñas se almacenan con hash, nunca en texto plano.</li>
          <li>El acceso a la información está restringido según el rol de cada usuario.</li>
        </ul>
      </Seccion>

      <Seccion numero={8} titulo="Retención de datos">
        <p>
          Conservamos tus datos mientras dure la relación comercial con Comandia, y hasta 5 años adicionales después
          de finalizada la relación, para dar cumplimiento a obligaciones contables y legales.
        </p>
      </Seccion>

      <Seccion numero={9} titulo="Contacto">
        <p>
          Si tienes preguntas sobre esta política de privacidad, escríbenos a{' '}
          <a href="mailto:comandiaapp@gmail.com" className="font-medium text-[#F97316] hover:underline">
            comandiaapp@gmail.com
          </a>
          .
        </p>
      </Seccion>
    </LegalLayout>
  );
}

export default Privacidad;
