function BotonesFormulario({ onCancelar, guardando, textoGuardar = 'Guardar' }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-lg border border-[#333] px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={guardando}
        className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d] disabled:opacity-60"
      >
        {guardando ? 'Guardando...' : textoGuardar}
      </button>
    </div>
  );
}

export default BotonesFormulario;
