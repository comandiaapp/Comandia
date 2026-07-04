function BotonesFormulario({ onCancelar, guardando, textoGuardar = 'Guardar' }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={guardando}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        {guardando ? 'Guardando...' : textoGuardar}
      </button>
    </div>
  );
}

export default BotonesFormulario;
