import { X } from 'lucide-react';

import POS from '../pages/POS';

function POSDrawer({ mesaId, onClose }) {
  const abierto = Boolean(mesaId);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pedido de la mesa"
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#0f0f0f] shadow-2xl transition-transform duration-300 ease-out md:w-[85%] ${
          abierto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1a1a] text-[#a1a1aa] hover:text-white"
        >
          <X size={18} />
        </button>

        {mesaId && <POS mesaId={mesaId} onCerrar={onClose} />}
      </div>
    </>
  );
}

export default POSDrawer;
