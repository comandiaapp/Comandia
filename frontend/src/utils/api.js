const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`Error en la petición: ${res.status}`);
  return res.json();
}
