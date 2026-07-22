// Genera el HTML de la factura electrónica de venta (formato DIAN) y de la
// precuenta, en formato de tirilla POS de 80mm con fuente monoespaciada
// para que las columnas queden alineadas tanto en pantalla como al imprimir.

const QRCode = require('qrcode');

// 72mm, no 80mm: es el área realmente imprimible de un rollo térmico de
// 80mm (el cabezal deja ~4mm de margen físico no imprimible a cada lado).
// Debe coincidir con el ancho que usa VisorFactura.jsx al posicionar
// #ticket-imprimible en @media print — si se cambia aquí, cambiar allá.
const ESTILO_TICKET =
  "font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: bold; " +
  'line-height: 1.35; width: 72mm; padding: 4px; box-sizing: border-box; white-space: pre-wrap; ' +
  'word-break: break-word; text-shadow: 0.3px 0 currentColor, -0.3px 0 currentColor;';

// A ~1.8x el tamaño de letra original (11px), la grilla de 40 caracteres ya
// no cabe en los 72mm imprimibles: un carácter monoespacio a este tamaño mide
// ~3.2mm, así que el máximo que entra con margen de seguridad es ~21
// caracteres. Por eso cada ítem pasa de "nombre + cant + vunit + total" en
// una sola línea a dos líneas (nombre arriba, cant/vunit/total abajo): así
// ninguna línea individual necesita más de ~20 caracteres. Si se vuelve a
// achicar la letra, ANCHO puede subir de nuevo y las filas volver a una línea.
const ANCHO = 20;
const COL_REG = 3;
const COL_CANT = 4;
const COL_VUNIT = 8;
const COL_TOTAL = 8;

// Columnas de la tabla de ítems de la factura DIAN (más angostas que las de
// la precuenta porque suman Código/VR/Imp.): Reg+Código van antes de la(s)
// línea(s) de nombre, Cant+Precio/U+Total en su propia línea debajo. VR e
// Imp. van en una línea de anotación aparte — así se ve una factura DIAN real
// impresa en una tirilla de 80mm (no como tabla rígida de 8 columnas).
const COLF_REG = 3;
const COLF_COD = 6;
const COLF_CANT = 4;
const COLF_VUNIT = 8;
const COLF_TOTAL = 8;

// Proveedor tecnológico real del software: fijo para todo el sistema (no
// varía por restaurante), a diferencia de los demás datos de la factura.
// ponytail: reemplazar con la razón social y NIT reales de la empresa antes
// de emitir facturas en producción.
const PROVEEDOR_TECNOLOGICO = {
  razon_social: 'Comandia SAS',
  nombre_software: 'Comandia POS',
  nit: 'PENDIENTE',
};

const ETIQUETAS_MEDIO_PAGO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr: 'QR',
  nequi: 'Nequi',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
};

function moneda(valor) {
  const entero = Math.round(Number(valor) || 0);
  const texto = Math.abs(entero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (entero < 0 ? '-$' : '$') + texto;
}

// Envuelve por palabras antes de centrar: a ANCHO=20 varios textos fijos del
// ticket (avisos legales, "Esta pre-cuenta no reemplaza...") ya no caben en
// una sola línea; cortarlos con slice() perdería texto en vez de mostrarlo
// en la línea siguiente.
function centrar(texto, ancho = ANCHO) {
  const palabras = String(texto).split(' ');
  const lineasEnvueltas = [];
  let actual = '';
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length > ancho && actual) {
      lineasEnvueltas.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) lineasEnvueltas.push(actual);
  if (lineasEnvueltas.length === 0) lineasEnvueltas.push('');

  return lineasEnvueltas
    .map((linea) => {
      if (linea.length >= ancho) return linea.slice(0, ancho);
      const espacio = ancho - linea.length;
      const izq = Math.floor(espacio / 2);
      return ' '.repeat(izq) + linea + ' '.repeat(espacio - izq);
    })
    .join('\n');
}

function fila(izquierda, derecha, ancho = ANCHO) {
  const izq = String(izquierda);
  const der = String(derecha);
  const espacio = Math.max(1, ancho - izq.length - der.length);
  return izq + ' '.repeat(espacio) + der;
}

function separador(char = '─', ancho = ANCHO) {
  return char.repeat(ancho);
}

function encabezadoItems() {
  return (
    'Reg'.padEnd(COL_REG) +
    'Descripción\n' +
    'Cant'.padStart(COL_CANT) +
    'V.Unit'.padStart(COL_VUNIT) +
    'Total'.padStart(COL_TOTAL)
  );
}

// Cada ítem se imprime con su número de línea (Reg) y nombre (envuelto en
// varias líneas si no cabe en el ancho disponible), y en una línea aparte
// debajo cantidad, precio unitario y subtotal alineados a la derecha — a
// este tamaño de letra ya no caben en la misma línea que el nombre.
function filaItem(item, numero) {
  const anchoDesc = ANCHO - COL_REG;
  const regTxt = String(numero).padEnd(COL_REG);
  const palabras = String(item.nombre_producto).split(' ');
  const lineasDesc = [];
  let actual = '';
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length > anchoDesc && actual) {
      lineasDesc.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) lineasDesc.push(actual);
  if (lineasDesc.length === 0) lineasDesc.push('');

  const lineas = lineasDesc.map((desc, idx) => (idx === 0 ? regTxt : ' '.repeat(COL_REG)) + desc);

  const cant = `${item.cantidad}x`.padStart(COL_CANT);
  const vunit = moneda(item.precio_unitario).padStart(COL_VUNIT);
  const total = moneda(item.subtotal).padStart(COL_TOTAL);
  lineas.push(cant + vunit + total);

  for (const mod of item.modificadores || []) {
    lineas.push(' '.repeat(COL_REG) + `+ ${mod.nombre_opcion}`.slice(0, ANCHO - COL_REG));
  }
  if (item.notas) {
    lineas.push(' '.repeat(COL_REG) + `"${item.notas}"`.slice(0, ANCHO - COL_REG));
  }

  return lineas.join('\n');
}

// Determina el texto de responsabilidad fiscal según el régimen y si la
// tarifa aplicada corresponde al Impuesto Nacional al Consumo (8%, el valor
// que usa esta app para restaurantes no franquicia) o al IVA.
function textoResponsabilidadFiscal(restaurante, impuestoPorcentaje) {
  if (Number(impuestoPorcentaje) === 8) {
    return 'RESPONSABLE DEL IMPUESTO NACIONAL AL CONSUMO';
  }
  return restaurante.regimen === 'comun' ? 'RESPONSABLE DE IVA' : 'NO RESPONSABLE DEL IVA';
}

function escaparHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatearFechaHora(fecha) {
  const d = new Date(fecha);
  const fechaTxt = d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaTxt = d.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${fechaTxt} ${horaTxt}`;
}

// fecha_resolucion_dian es una columna DATE (sin hora): se formatea leyendo
// los componentes UTC directamente para no correrse un día al convertir a
// America/Bogota, que es lo que pasaría con un new Date('2023-01-01') al
// interpretarlo como medianoche UTC y luego mostrarlo en UTC-5.
function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = d.getUTCFullYear();
  return `${dia}/${mes}/${anio}`;
}

const NIT_SIN_FORMATO = /^(\d+)-?(\d)?$/;

function formatearNit(nit) {
  if (!nit) return '';
  const match = String(nit).match(NIT_SIN_FORMATO);
  if (!match) return nit;
  const [, numero, verificacion] = match;
  const numeroFormateado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return verificacion ? `${numeroFormateado}-${verificacion}` : numeroFormateado;
}

// Logo circular en el encabezado del ticket (igual que factura y precuenta):
// si el restaurante no tiene logo cargado, no se imprime nada en su lugar.
function logoHTML(logoUrl) {
  if (!logoUrl) return '';
  return `<img src="${escaparHTML(logoUrl)}" alt="" style="display:block; width:60px; height:60px; margin:0 auto 4px; border-radius:50%; object-fit:cover;" />`;
}

function envolverHTML(texto, { titulo, logoUrl }) {
  return `<div style="${ESTILO_TICKET}" aria-label="${escaparHTML(titulo)}">${logoHTML(logoUrl)}<pre style="margin:0; font-family: inherit; font-size: inherit; white-space: pre-wrap;">${escaparHTML(texto)}</pre></div>`;
}

// Igual formato de fecha/hora que usa facturaModel.generarCUFE (para que el
// CUFE y lo impreso coincidan), pero como texto "YYYY-MM-DD HH:MM:SS".
function formatearFechaHoraISO(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(fecha))
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute}:${partes.second}`;
}

// La vigencia de la resolución DIAN son 24 meses desde fecha_resolucion_dian
// (misma lectura por componentes UTC que formatearFecha, para no correrse
// un día por la conversión a America/Bogota).
function sumarMesesUTC(fecha, meses) {
  const d = new Date(fecha);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, d.getUTCDate()));
}

// Etiquetas de responsabilidad tributaria del encabezado. La de IVA/INC es
// mutuamente excluyente según la tarifa aplicada (igual lógica que antes);
// agente retenedor y micronegocio son etiquetas adicionales independientes
// que se activan por configuración del restaurante.
function etiquetasResponsabilidad(restaurante, impuestoPorcentaje) {
  const etiquetas = [textoResponsabilidadFiscal(restaurante, impuestoPorcentaje)];
  if (restaurante.micronegocio_regimen_simple) etiquetas.push('MICRONEGOCIO DE IMP.');
  if (restaurante.agente_retenedor_iva) etiquetas.push('AGENTE RETENEDOR DE IVA');
  return etiquetas;
}

// ponytail: el catálogo de productos no tiene un campo de código/SKU propio
// (ver backend/src/config/schema.sql, tabla productos), así que se usa el
// UUID del producto como código interno. Si se agrega un SKU real más
// adelante, usarlo aquí en su lugar.
function codigoInterno(item) {
  const codigo = String(item.producto_id || '').slice(0, COLF_COD - 1).toUpperCase() || '-'.repeat(COLF_COD - 1);
  return codigo.padEnd(COLF_COD);
}

// Código DIAN del impuesto aplicado: INC (Impuesto Nacional al Consumo,
// tarifa del 8% que usa esta app) o IVA para cualquier otra tarifa.
function codigoImpuesto(impuestoPorcentaje) {
  return Number(impuestoPorcentaje) === 8 ? 'INC' : 'IVA';
}

function encabezadoItemsFactura() {
  return (
    '#'.padEnd(COLF_REG) +
    'Cód.'.padEnd(COLF_COD) +
    'Descrip.\n' +
    'Cant'.padStart(COLF_CANT) +
    'P.Unit'.padStart(COLF_VUNIT) +
    'Total'.padStart(COLF_TOTAL)
  );
}

// Tabla de ítems de la factura DIAN: Reg+Código antes de la(s) línea(s) de
// nombre, Cant+Precio/U+Total alineados en su propia línea debajo (a este
// tamaño de letra ya no caben junto al nombre). VR (tarifa) e Imp. (código
// de impuesto) van en una línea de anotación aparte — así se ve una factura
// DIAN real impresa en 80mm.
function filaItemFactura(item, numero, impuestoPorcentaje) {
  const colfDesc = ANCHO - COLF_REG - COLF_COD;
  const indent = ' '.repeat(COLF_REG + COLF_COD);
  const regTxt = String(numero).padEnd(COLF_REG);
  const codTxt = codigoInterno(item);
  const palabras = String(item.nombre_producto).split(' ');
  const lineasDesc = [];
  let actual = '';
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length > colfDesc && actual) {
      lineasDesc.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) lineasDesc.push(actual);
  if (lineasDesc.length === 0) lineasDesc.push('');

  const lineas = lineasDesc.map((desc, idx) => (idx === 0 ? regTxt + codTxt : indent) + desc);

  const cant = `${item.cantidad}x`.padStart(COLF_CANT);
  const vunit = moneda(item.precio_unitario).padStart(COLF_VUNIT);
  const total = moneda(item.subtotal).padStart(COLF_TOTAL);
  lineas.push(cant + vunit + total);

  const vr = `${Number(impuestoPorcentaje)}%`;
  lineas.push(`VR:${vr}  Imp:${codigoImpuesto(impuestoPorcentaje)}${Number(impuestoPorcentaje)}`);

  for (const mod of item.modificadores || []) {
    lineas.push(indent + `+ ${mod.nombre_opcion}`.slice(0, ANCHO - indent.length));
  }
  if (item.notas) {
    lineas.push(indent + `"${item.notas}"`.slice(0, ANCHO - indent.length));
  }

  return lineas.join('\n');
}

async function generarQR(payload) {
  try {
    return await QRCode.toDataURL(payload, { margin: 1, width: 132, errorCorrectionLevel: 'M' });
  } catch (err) {
    console.error('No se pudo generar el código QR de la factura:', err);
    return null;
  }
}

async function generarHTMLTicket(factura, restaurante, pedido) {
  const antes = [];

  antes.push(`ORD:# ${pedido.numero_jornada ?? pedido.numero_global ?? '-'}`);
  antes.push(centrar(restaurante.nombre || ''));
  if (restaurante.nit) antes.push(centrar(`NIT: ${formatearNit(restaurante.nit)}`));
  for (const etiqueta of etiquetasResponsabilidad(restaurante, factura.impuesto_porcentaje)) {
    antes.push(centrar(etiqueta));
  }
  if (restaurante.direccion || restaurante.ciudad) {
    antes.push([restaurante.direccion, restaurante.ciudad].filter(Boolean).join(' '));
  }
  if (restaurante.referencia_sede) antes.push(restaurante.referencia_sede);
  antes.push(separador('═'));

  antes.push(`Factura electrónica de Venta: ${factura.numero_factura}`);
  antes.push(`Fecha Generación Factura: ${formatearFechaHoraISO(factura.fecha_emision)}`);
  antes.push(
    `Fecha Validación DIAN: ${factura.fecha_validacion_dian ? formatearFechaHoraISO(factura.fecha_validacion_dian) : 'Pendiente'}`
  );
  antes.push(separador());

  antes.push('AUTORIZACIÓN DE CLIENTE');
  antes.push(`Nombre Cliente: ${factura.nombre_cliente}`);
  antes.push(`Número de identificación: ${factura.nit_cliente}`);
  antes.push(separador());

  antes.push(encabezadoItemsFactura());
  antes.push(separador());
  let numeroItem = 0;
  for (const item of (pedido.items || []).filter((i) => i.estado !== 'cancelado')) {
    numeroItem++;
    antes.push(filaItemFactura(item, numeroItem, factura.impuesto_porcentaje));
  }
  antes.push(separador());
  antes.push(`Total Línea Detalles: ${numeroItem}`);
  antes.push(separador());

  const etiquetaImpuesto = `${codigoImpuesto(factura.impuesto_porcentaje)} ${Number(factura.impuesto_porcentaje)}%`;
  antes.push(fila('SUBTOTAL:', moneda(factura.subtotal)));
  antes.push(fila(`${etiquetaImpuesto}:`, moneda(factura.impuesto_monto)));
  antes.push(separador('═'));
  antes.push(fila('TOTAL COP:', moneda(factura.total)));
  antes.push(separador('═'));

  // ponytail: no hay flujo de crédito/fiado en este sistema (ver
  // pedidos.pagado_con), así que la forma de pago siempre es de contado.
  antes.push('FORMA DE PAGO: Contado');
  antes.push(`MEDIO DE PAGO: ${ETIQUETAS_MEDIO_PAGO[factura.metodo_pago] || factura.metodo_pago || '-'}`);
  antes.push(separador());

  antes.push('Lugar de entrega del bien y/o prestación del servicio:');
  antes.push(restaurante.direccion_entrega || restaurante.direccion || '-');
  antes.push(separador());

  if (restaurante.numero_resolucion_dian) {
    const vigenciaDesde = formatearFecha(restaurante.fecha_resolucion_dian);
    const vigenciaHasta = restaurante.fecha_resolucion_dian
      ? formatearFecha(sumarMesesUTC(restaurante.fecha_resolucion_dian, 24))
      : '';
    antes.push(`FEV. Res. DIAN ${restaurante.numero_resolucion_dian}, del ${vigenciaDesde} hasta ${vigenciaHasta}`);
  }

  const qrPayload = [
    `NumFac:${factura.numero_factura}`,
    `NitFac:${formatearNit(restaurante.nit)}`,
    `FecFac:${formatearFechaHoraISO(factura.fecha_emision)}`,
    `ValFac:${factura.total}`,
    `CUFE:${factura.cufe}`,
  ].join('|');
  const qrDataUrl = await generarQR(qrPayload);

  const despues = [];
  despues.push(`FP: ${factura.numero_consecutivo}`);
  despues.push(`Prefijo ${restaurante.prefijo_factura || 'FE'} del No. ${restaurante.factura_desde ?? 1} al ${restaurante.factura_hasta ?? 99999}`);
  despues.push(`CUFE: ${factura.cufe}`);
  if (restaurante.res_grandes_contribuyentes) {
    despues.push(`SOMOS GRANDES CONTRIBUYENTES SEGÚN RES. ${restaurante.res_grandes_contribuyentes}`);
  }
  despues.push(separador());

  despues.push(`Proveedor Tecnológico: ${PROVEEDOR_TECNOLOGICO.razon_social}`);
  despues.push(`Nombre del SW: ${PROVEEDOR_TECNOLOGICO.nombre_software}`);
  despues.push(`NIT: ${PROVEEDOR_TECNOLOGICO.nit}`);
  despues.push('');

  despues.push(centrar('Representación Gráfica de Factura'));
  despues.push(centrar('electrónica de Venta'));

  if (restaurante.mensaje_ticket) {
    despues.push('');
    despues.push(centrar(restaurante.mensaje_ticket));
  }

  const qrHTML = qrDataUrl
    ? `<img src="${qrDataUrl}" width="96" height="96" alt="Código QR de la factura electrónica" style="display:block;margin:6px auto;" />`
    : `<div style="text-align:center;margin:6px 0;">[CÓDIGO QR]</div>`;
  const bloque = (texto) =>
    `<pre style="margin:0; font-family: inherit; font-size: inherit; white-space: pre-wrap;">${escaparHTML(texto)}</pre>`;

  return `<div style="${ESTILO_TICKET}" aria-label="${escaparHTML(`Factura ${factura.numero_factura}`)}">${logoHTML(restaurante.logo_url)}${bloque(antes.join('\n'))}${qrHTML}${bloque(despues.join('\n'))}</div>`;
}

function generarHTMLPrecuenta(pedido, restaurante) {
  const lineas = [];

  lineas.push(centrar(restaurante.nombre || ''));
  lineas.push(centrar('PRE-CUENTA'));
  lineas.push(centrar('(Documento sin validez fiscal)'));
  lineas.push(separador('═'));

  if (restaurante.direccion) lineas.push(`Dir: ${restaurante.direccion}`);
  if (restaurante.telefono) lineas.push(`Tel: ${restaurante.telefono}`);
  lineas.push(`Pedido: #${String(pedido.numero_jornada ?? pedido.numero_global ?? '').padStart(2, '0')}`);
  if (pedido.mesa_numero) lineas.push(`Mesa: ${pedido.mesa_numero}`);
  lineas.push(`Fecha: ${formatearFechaHora(pedido.created_at || new Date())}`);
  lineas.push(separador());

  lineas.push(encabezadoItems());
  lineas.push(separador());
  let numeroItemPrecuenta = 0;
  for (const item of (pedido.items || []).filter((i) => i.estado !== 'cancelado')) {
    numeroItemPrecuenta++;
    lineas.push(filaItem(item, numeroItemPrecuenta));
  }
  lineas.push(separador());

  const subtotal = Number(pedido.subtotal) || 0;
  const descuento = Number(pedido.descuento) || 0;
  const impuesto = Number(pedido.impuesto) || 0;
  const propina = Number(pedido.propina) || 0;
  const costoDomicilio = Number(pedido.costo_domicilio) || 0;
  const total =
    pedido.total !== undefined
      ? Number(pedido.total)
      : Math.max(0, subtotal - descuento + impuesto + propina + costoDomicilio);

  lineas.push(fila('SUBTOTAL:', moneda(subtotal)));
  if (descuento > 0) lineas.push(fila('DESCUENTO:', `-${moneda(descuento)}`));
  if (impuesto > 0) lineas.push(fila('IMPUESTO:', moneda(impuesto)));
  if (propina > 0) lineas.push(fila('PROPINA:', moneda(propina)));
  if (costoDomicilio > 0) lineas.push(fila('DOMICILIO:', moneda(costoDomicilio)));
  lineas.push(separador('═'));
  lineas.push(fila('TOTAL:', moneda(total)));
  lineas.push(separador('═'));
  lineas.push('');
  lineas.push(centrar('Esta pre-cuenta no reemplaza la'));
  lineas.push(centrar('factura electrónica de venta.'));

  return envolverHTML(lineas.join('\n'), { titulo: 'Pre-cuenta', logoUrl: restaurante.logo_url });
}

module.exports = { generarHTMLTicket, generarHTMLPrecuenta };
