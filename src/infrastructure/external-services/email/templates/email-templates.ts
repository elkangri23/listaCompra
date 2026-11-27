/**
 * Plantillas de correo de ListaCompra (item 12 del backlog).
 *
 * HTML compatible con Outlook (motor Word), Gmail y Apple Mail:
 * - todo con tablas y estilos EN LÍNEA, sin bloque <style> (Gmail lo
 *   recorta y Outlook lo ignora casi todo)
 * - ancho fijo 600px; la única imagen externa es el logo de la marca
 *   (con alt como respaldo si el cliente la bloquea)
 * - aspecto de la web: banda de marca #2563eb, botones #4387f4, texto
 *   #111418, secundario #60708a, fondo #f0f2f5, éxito #10b981
 * - todos los datos que vienen del usuario (nombres, listas, detalles)
 *   se escapan con escapeHtml: antes se interpolaban tal cual y un
 *   nombre de lista con HTML podía romper el correo o inyectar marcado
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT = 'Inter, \'Noto Sans\', Arial, sans-serif';
const PRIMARY = '#4387f4';
const BRAND_BAND = '#2563eb';
const TEXT = '#111418';
const MUTED = '#60708a';
const PAGE_BG = '#f0f2f5';
const BORDER = '#dbdfe6';
const SITE_URL = 'https://listacompra.laurafernandezenfermeria.com';

export interface EmailLayoutOptions {
  /** Texto que se ve en la bandeja de entrada como adelanto (oculto en el cuerpo) */
  preheader: string;
  /** <title> del documento */
  title: string;
  /** Titular del contenido (texto plano, se escapa) */
  heading: string;
  /** Cuerpo del correo (HTML generado por cada plantilla, con datos ya escapados) */
  bodyHtml: string;
}

/**
 * Estructura común: cabecera de marca, contenido y pie.
 */
export function renderEmailLayout(options: EmailLayoutOptions): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(options.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG};">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;">
<tr>
<td style="background-color:${BRAND_BAND};padding:28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:12px;"><img src="${SITE_URL}/logo.svg" width="40" height="40" alt="ListaCompra" style="display:block;"></td>
<td style="vertical-align:middle;color:#ffffff;font-family:${FONT};font-size:22px;font-weight:800;line-height:1.2;">ListaCompra</td>
</tr></table>
</td>
</tr>
<tr>
<td style="padding:32px;font-family:${FONT};font-size:16px;line-height:1.6;color:${TEXT};">
<h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:${TEXT};font-weight:800;">${escapeHtml(options.heading)}</h1>
${options.bodyHtml}
</td>
</tr>
<tr>
<td style="padding:24px 32px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">
<p style="margin:0 0 8px 0;">Si no esperabas este correo, puedes ignorarlo.</p>
<p style="margin:0;">© ${year} ListaCompra &middot; <a href="${SITE_URL}" style="color:${MUTED};text-decoration:underline;">listacompra.laurafernandezenfermeria.com</a></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`.trim();
}

/**
 * Botón centrado compatible con Outlook: el relleno va en la celda
 * (Outlook ignora el padding del enlace) y el radio solo lo aplican
 * los clientes modernos.
 */
export function renderEmailButton(url: string, label: string, color: string = PRIMARY): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
<tr>
<td align="center" bgcolor="${color}" style="border-radius:8px;padding:14px 32px;">
<a href="${escapeHtml(url)}" style="font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td>
</tr>
</table>`;
}

/**
 * Caja de aviso con barra lateral de color (una celda de 4px: funciona
 * en Outlook, donde border-left no es fiable).
 */
export function renderEmailCallout(innerHtml: string, accentColor: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:${PAGE_BG};">
<tr>
<td width="4" style="width:4px;background-color:${accentColor};font-size:0;line-height:0;">&nbsp;</td>
<td style="padding:12px 16px;font-family:${FONT};font-size:14px;line-height:1.5;color:${TEXT};">${innerHtml}</td>
</tr>
</table>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px 0;">${text}</p>`;
}

export interface InvitationEmailData {
  recipientName: string;
  inviterName: string;
  listName: string;
  invitationUrl: string;
  expiresAt: Date;
}

export function renderInvitationEmail(data: InvitationEmailData): string {
  const expires = data.expiresAt.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return renderEmailLayout({
    preheader: `${data.inviterName} te ha invitado a colaborar en "${data.listName}"`,
    title: 'Invitación a Lista Colaborativa',
    heading: `¡Hola ${data.recipientName}!`,
    bodyHtml: [
      paragraph(
        `<strong>${escapeHtml(data.inviterName)}</strong> te ha invitado a colaborar en la lista <strong>&quot;${escapeHtml(data.listName)}&quot;</strong>.`,
      ),
      paragraph('Con esta invitación podrás:'),
      `<ul style="margin:0 0 16px 0;padding-left:20px;">
<li>Ver y editar elementos de la lista</li>
<li>Marcar productos como comprados</li>
<li>Colaborar en tiempo real</li>
</ul>`,
      renderEmailButton(data.invitationUrl, 'Acceder a la lista', '#10b981'),
      renderEmailCallout(
        `<strong>&#9200; Importante:</strong> Esta invitación expira el ${escapeHtml(expires)}.`,
        '#e8a838',
      ),
    ].join('\n'),
  });
}

export interface ConfirmationEmailData {
  recipientName: string;
  confirmationUrl: string;
}

export function renderConfirmationEmail(data: ConfirmationEmailData): string {
  return renderEmailLayout({
    preheader: 'Confirma tu correo para empezar a usar Lista de Compra',
    title: 'Confirma tu cuenta',
    heading: `¡Hola ${data.recipientName}!`,
    bodyHtml: [
      paragraph(
        '¡Bienvenido a Lista de Compra! Estás a solo un paso de comenzar a colaborar en listas de compra.',
      ),
      paragraph('Para activar tu cuenta y comenzar a usar la plataforma, confirma tu correo:'),
      renderEmailButton(data.confirmationUrl, 'Confirmar correo'),
      paragraph('Una vez confirmado tu correo, podrás:'),
      `<ul style="margin:0 0 16px 0;padding-left:20px;">
<li>Crear y gestionar listas de compra</li>
<li>Compartir listas con familia y amigos</li>
<li>Colaborar en tiempo real</li>
<li>Recibir notificaciones de cambios</li>
</ul>`,
    ].join('\n'),
  });
}

export interface VerificationCodeEmailData {
  recipientName: string;
  codigo: string;
}

export function renderVerificationCodeEmail(data: VerificationCodeEmailData): string {
  return renderEmailLayout({
    preheader: `Tu código de verificación es ${data.codigo}`,
    title: 'Verifica tu correo',
    heading: `¡Hola ${data.recipientName}!`,
    bodyHtml: [
      paragraph(
        'Para activar tu cuenta en Lista de Compra, introduce este código de verificación:',
      ),
      `<p style="margin:0 0 16px 0;text-align:center;"><span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#111418;background-color:#f0f2f5;border:1px solid #dbdfe6;border-radius:8px;padding:12px 20px;">${escapeHtml(data.codigo)}</span></p>`,
      paragraph('El código caduca en 15 minutos y solo sirve una vez.'),
      renderEmailCallout(
        '<strong>&#128274; Seguridad:</strong> Si no creaste esta cuenta, puedes ignorar este correo.',
        '#4387f4',
      ),
    ].join('\n'),
  });
}

export interface PasswordResetCodeEmailData {
  recipientName: string;
  codigo: string;
}

export function renderPasswordResetCodeEmail(data: PasswordResetCodeEmailData): string {
  return renderEmailLayout({
    preheader: `Tu código para restablecer la contraseña es ${data.codigo}`,
    title: 'Restablecer tu contraseña',
    heading: `¡Hola ${data.recipientName}!`,
    bodyHtml: [
      paragraph(
        'Has pedido restablecer tu contraseña en Lista de Compra. Introduce este código para poner una nueva:',
      ),
      `<p style="margin:0 0 16px 0;text-align:center;"><span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#111418;background-color:#f0f2f5;border:1px solid #dbdfe6;border-radius:8px;padding:12px 20px;">${escapeHtml(data.codigo)}</span></p>`,
      paragraph('El código caduca en 15 minutos y solo sirve una vez.'),
      renderEmailCallout(
        '<strong>&#128274; Seguridad:</strong> Si no pediste restablecer tu contraseña, puedes ignorar este correo: tu contraseña no cambia.',
        '#4387f4',
      ),
    ].join('\n'),
  });
}

export type ListChangeType = 'item_added' | 'item_removed' | 'item_updated' | 'list_updated';

const CHANGE_META: Record<ListChangeType, { icon: string; label: string; color: string }> = {
  item_added: { icon: '&#10133;', label: 'Se ha añadido un nuevo elemento', color: '#10b981' },
  item_removed: { icon: '&#10134;', label: 'Se ha eliminado un elemento', color: '#ef4444' },
  item_updated: { icon: '&#9998;', label: 'Se ha actualizado un elemento', color: '#e8a838' },
  list_updated: { icon: '&#128221;', label: 'Se ha actualizado la lista', color: PRIMARY },
};

export interface NotificationEmailData {
  recipientName: string;
  listName: string;
  changeType: ListChangeType;
  changeDetails: string;
  listsUrl: string;
}

export function renderNotificationEmail(data: NotificationEmailData): string {
  const meta = CHANGE_META[data.changeType];
  return renderEmailLayout({
    preheader: `${meta.label} en "${data.listName}"`,
    title: 'Cambios en tu lista',
    heading: `Cambios en "${data.listName}"`,
    bodyHtml: [
      paragraph(`¡Hola ${escapeHtml(data.recipientName)}!`),
      paragraph(
        `Ha habido cambios en la lista <strong>&quot;${escapeHtml(data.listName)}&quot;</strong>.`,
      ),
      renderEmailCallout(
        `<strong>${meta.icon} ${escapeHtml(meta.label)}:</strong><br>${escapeHtml(data.changeDetails)}`,
        meta.color,
      ),
      renderEmailButton(data.listsUrl, 'Ver mis listas'),
    ].join('\n'),
  });
}
