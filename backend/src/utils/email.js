const nodemailer = require('nodemailer');

const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: env.brevoEmail,
    pass: env.brevoSmtpKey,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

const FROM = '"Comandia" <b1018a001@smtp-brevo.com>';

async function enviarCorreo(opciones) {
  try {
    const info = await transporter.sendMail(opciones);
    console.log('Email enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error enviando email:', error);
    throw error;
  }
}

function layout({ titulo, contenido }) {
  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${titulo}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#FFF3E0; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF3E0; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow: 0 10px 30px rgba(249, 115, 22, 0.15);">
              <tr>
                <td style="background: linear-gradient(to bottom right, #FF6B00, #F97316); padding: 28px 32px; text-align:center;">
                  <span style="font-size:24px; font-weight:800; color:#FFFFFF; letter-spacing: -0.5px;">🍽️ Comandia</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  ${contenido}
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 32px; background-color:#FFFBF5; border-top: 1px solid #FFE0C0;">
                  <p style="margin:0; font-size:12px; color:#8A8A8A; text-align:center;">
                    Comandia — el sistema que tu restaurante necesita.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function boton(texto, url) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
      <tr>
        <td style="border-radius: 10px; background-color:#F97316;">
          <a href="${url}" target="_blank" style="display:inline-block; padding: 14px 32px; font-size:16px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:10px;">
            ${texto}
          </a>
        </td>
      </tr>
    </table>`;
}

async function enviarVerificacionEmail(email, nombre, token) {
  const url = `${env.appUrl}/verificar-email?token=${token}`;

  const html = layout({
    titulo: 'Verifica tu cuenta en Comandia',
    contenido: `
      <h1 style="margin:0 0 16px; font-size:20px; color:#1A1A1A;">Hola ${nombre},</h1>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Gracias por registrarte en Comandia. Para activar todas las funciones de tu cuenta, confirma tu correo electrónico.
      </p>
      ${boton('Verificar mi cuenta', url)}
      <p style="margin:16px 0 0; font-size:13px; line-height:1.6; color:#8A8A8A; text-align:center;">
        Este link expira en 24 horas.
      </p>
      <p style="margin:24px 0 0; font-size:12px; line-height:1.6; color:#8A8A8A;">
        Si no creaste una cuenta en Comandia, puedes ignorar este email.
      </p>
    `,
  });

  return enviarCorreo({
    from: FROM,
    to: email,
    subject: 'Verifica tu cuenta en Comandia',
    html,
  });
}

async function enviarResetPassword(email, nombre, token) {
  const url = `${env.appUrl}/reset-password?token=${token}`;

  const html = layout({
    titulo: 'Recupera tu contraseña de Comandia',
    contenido: `
      <h1 style="margin:0 0 16px; font-size:20px; color:#1A1A1A;">Hola ${nombre},</h1>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en Comandia.
      </p>
      ${boton('Restablecer contraseña', url)}
      <p style="margin:16px 0 0; font-size:13px; line-height:1.6; color:#8A8A8A; text-align:center;">
        Este link expira en 1 hora.
      </p>
      <p style="margin:24px 0 0; font-size:12px; line-height:1.6; color:#8A8A8A;">
        Si no solicitaste este cambio, puedes ignorar este email: tu contraseña seguirá siendo la misma.
      </p>
    `,
  });

  return enviarCorreo({
    from: FROM,
    to: email,
    subject: 'Recupera tu contraseña de Comandia',
    html,
  });
}

async function enviarBienvenida(email, nombre, restaurante, trialExpira) {
  const url = `${env.appUrl}/dashboard`;
  const fecha = new Date(trialExpira).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = layout({
    titulo: '¡Bienvenido a Comandia!',
    contenido: `
      <h1 style="margin:0 0 16px; font-size:20px; color:#1A1A1A;">¡Bienvenido ${nombre}!</h1>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Tu restaurante <strong>${restaurante}</strong> ya está listo en Comandia.
      </p>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Tienes <strong>14 días gratis</strong> para explorar todas las funciones, hasta el <strong>${fecha}</strong>.
      </p>
      ${boton('Ir a mi cuenta', url)}
      <ul style="margin:24px 0 0; padding-left: 20px; font-size:14px; line-height:1.9; color:#5A5A5A;">
        <li>Punto de venta y gestión de mesas en tiempo real</li>
        <li>Cocina conectada con impresión de comandas</li>
        <li>Inventario, compras y contaduría en un solo lugar</li>
        <li>Reportes y facturación electrónica DIAN</li>
      </ul>
    `,
  });

  return enviarCorreo({
    from: FROM,
    to: email,
    subject: '¡Bienvenido a Comandia! Tu trial de 14 días ha comenzado',
    html,
  });
}

const PLAN_LABELS = {
  basico: 'Básico',
  profesional: 'Profesional',
  empresarial: 'Empresarial',
};

async function enviarConfirmacionPago(email, nombre, plan, fechaVencimiento) {
  const url = `${env.appUrl}/dashboard`;
  const planLabel = PLAN_LABELS[plan] || plan;

  const opcionesFecha = { day: 'numeric', month: 'long', year: 'numeric' };
  const fecha = new Date(fechaVencimiento).toLocaleDateString('es-CO', opcionesFecha);
  const proximoCobroMs = new Date(fechaVencimiento).getTime() + 30 * 24 * 60 * 60 * 1000;
  const proximoCobro = new Date(proximoCobroMs).toLocaleDateString('es-CO', opcionesFecha);

  const html = layout({
    titulo: `Pago confirmado — Plan ${planLabel} activado`,
    contenido: `
      <h1 style="margin:0 0 16px; font-size:20px; color:#1A1A1A;">¡Gracias por tu pago, ${nombre}!</h1>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Tu plan <strong>${planLabel}</strong> está activo en Comandia.
      </p>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Válido hasta: <strong>${fecha}</strong>
      </p>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Próximo cobro: <strong>${proximoCobro}</strong>
      </p>
      ${boton('Ir a Comandia', url)}
    `,
  });

  return enviarCorreo({
    from: FROM,
    to: email,
    subject: `✅ Pago confirmado — Plan ${planLabel} activado`,
    html,
  });
}

async function enviarAvisoSuscripcionInactiva(email, nombre, motivo) {
  const url = `${env.appUrl}/planes`;
  const textoMotivo = motivo === 'paused' ? 'pausada' : 'cancelada';

  const html = layout({
    titulo: 'Tu suscripción en Comandia cambió de estado',
    contenido: `
      <h1 style="margin:0 0 16px; font-size:20px; color:#1A1A1A;">Hola ${nombre},</h1>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Tu suscripción a Comandia fue <strong>${textoMotivo}</strong> en Mercado Pago.
      </p>
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#5A5A5A;">
        Mientras tanto, tu cuenta quedó sin un plan activo. Si fue un error o quieres reactivarla, puedes hacerlo desde la página de planes.
      </p>
      ${boton('Ver planes', url)}
    `,
  });

  return enviarCorreo({
    from: FROM,
    to: email,
    subject: `Tu suscripción en Comandia fue ${textoMotivo}`,
    html,
  });
}

module.exports = {
  enviarVerificacionEmail,
  enviarResetPassword,
  enviarBienvenida,
  enviarConfirmacionPago,
  enviarAvisoSuscripcionInactiva,
};
