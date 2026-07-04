import { Check, X } from 'lucide-react';

const REQUISITOS = [
  { clave: 'longitud', label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { clave: 'mayuscula', label: 'Al menos una mayúscula', test: (p) => /[A-Z]/.test(p) },
  { clave: 'numero', label: 'Al menos un número', test: (p) => /[0-9]/.test(p) },
  { clave: 'especial', label: 'Al menos un carácter especial (!@#$%^&*)', test: (p) => /[!@#$%^&*]/.test(p) },
];

const NIVELES = [
  { min: 0, label: 'Muy débil', color: '#DC2626' },
  { min: 1, label: 'Débil', color: '#F97316' },
  { min: 2, label: 'Media', color: '#EAB308' },
  { min: 3, label: 'Fuerte', color: '#84CC16' },
  { min: 4, label: 'Muy fuerte', color: '#16A34A' },
];

export function evaluarRequisitos(password = '') {
  return REQUISITOS.map((r) => ({ ...r, cumple: r.test(password) }));
}

export function passwordEsValida(password = '') {
  return evaluarRequisitos(password).every((r) => r.cumple);
}

function FortalezaPassword({ password = '' }) {
  const requisitos = evaluarRequisitos(password);
  const puntaje = requisitos.filter((r) => r.cumple).length;
  const nivel = [...NIVELES].reverse().find((n) => puntaje >= n.min) || NIVELES[0];

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i < puntaje ? nivel.color : 'var(--border)' }}
          />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: nivel.color }}>
        {nivel.label}
      </p>
      <ul className="space-y-1">
        {requisitos.map((r) => (
          <li
            key={r.clave}
            className={`flex items-center gap-1.5 text-xs ${
              r.cumple ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {r.cumple ? <Check size={13} /> : <X size={13} />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FortalezaPassword;
