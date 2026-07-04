import { X } from 'lucide-react';

function Modal({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4">
      <div role="dialog" aria-modal="true" aria-label={titulo} className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-modal)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{titulo}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
