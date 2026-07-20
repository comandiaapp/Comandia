// Input de dinero: muestra separador de miles con punto mientras se escribe
// (formato colombiano, ej. 3.000) pero el valor que emite onChange es un
// número plano sin puntos (ej. "3000") — mismo valor que ya esperan los
// estados/inputs numéricos que reemplaza. Solo enteros: los pesos en esta
// app no usan centavos.
function InputDinero({ value, onChange, className = 'input', ...props }) {
  const digitos = String(value ?? '').replace(/\D/g, '');
  const formateado = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formateado}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      className={className}
      {...props}
    />
  );
}

export default InputDinero;
