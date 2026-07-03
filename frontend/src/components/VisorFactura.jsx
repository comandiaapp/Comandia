import { Printer, X } from 'lucide-react';

function VisorFactura({ titulo = 'Factura', html, onClose, textoCerrar = 'Cerrar', guardadoAutomaticamente = false }) {
  if (!html) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 print:block print:bg-transparent print:px-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-imprimible, #ticket-imprimible * { visibility: visible; }
          #ticket-imprimible { position: absolute; left: 0; top: 0; }
          @page { margin: 0; }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl print:max-h-none print:w-auto print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:shadow-none"
      >
        <div className="flex items-center justify-between border-b border-[#2a2a2a] p-4 print:hidden">
          <h2 className="text-lg font-semibold text-white">{titulo}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-[#a1a1aa] hover:text-white">
            <X size={20} />
          </button>
        </div>

        {guardadoAutomaticamente && (
          <div className="border-b border-[#2a2a2a] bg-[#141414] p-4 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f97316] px-4 py-3 text-base font-bold text-white hover:bg-[#ea6a0d]"
            >
              <Printer size={20} />
              Imprimir factura
            </button>
            <p className="mt-2 text-center text-xs text-[#a1a1aa]">La factura se guardó automáticamente</p>
          </div>
        )}

        <div className="overflow-y-auto p-4 print:overflow-visible print:p-0">
          <div id="ticket-imprimible" className="mx-auto bg-white text-black" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div className="flex gap-2 border-t border-[#2a2a2a] p-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#333] px-4 py-2.5 text-sm font-medium text-[#a1a1aa] hover:text-white"
          >
            {textoCerrar}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
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
