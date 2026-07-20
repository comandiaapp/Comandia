import { Printer, X } from 'lucide-react';

function VisorFactura({ titulo = 'Factura', html, onClose, textoCerrar = 'Cerrar', guardadoAutomaticamente = false }) {
  if (!html) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 print:block print:bg-transparent print:px-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-imprimible, #ticket-imprimible * { visibility: visible; }
          /* El área realmente imprimible de un rollo térmico de 80mm es
             ~72mm (el cabezal deja ~4mm de margen físico no imprimible a
             cada lado) — el ticket generado en generarTicket.js ya mide
             72mm, así que 4mm de left lo deja exactamente dentro de esa
             zona (4mm + 72mm = 76mm, dentro de los 80mm de @page) sin que
             el navegador tenga que reescalar para que quepa. Si se cambia
             el ancho en generarTicket.js, cambiar este valor también. */
          #ticket-imprimible { position: absolute; left: 4mm; top: 0; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-modal)] shadow-xl print:max-h-none print:w-auto print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:shadow-none"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4 print:hidden">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{titulo}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        {guardadoAutomaticamente && (
          <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)] p-4 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-3 text-base font-bold text-white hover:bg-[var(--accent-hover)]"
            >
              <Printer size={20} />
              Imprimir factura
            </button>
            <p className="mt-2 text-center text-xs text-[var(--text-secondary)]">La factura se guardó automáticamente</p>
          </div>
        )}

        <div className="overflow-y-auto p-4 print:overflow-visible print:p-0">
          <div id="ticket-imprimible" className="mx-auto bg-white text-black" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div className="flex gap-2 border-t border-[var(--border)] p-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {textoCerrar}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisorFactura;
