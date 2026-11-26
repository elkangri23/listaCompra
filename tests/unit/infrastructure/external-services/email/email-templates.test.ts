/**
 * Tests de las plantillas de correo (item 12): estructura compatible con
 * Outlook/Gmail/Apple Mail y escape de los datos del usuario.
 */
import {
  escapeHtml,
  renderEmailLayout,
  renderEmailButton,
  renderEmailCallout,
  renderInvitationEmail,
  renderConfirmationEmail,
  renderNotificationEmail,
} from '../../../../../src/infrastructure/external-services/email/templates/email-templates';

describe('email-templates', () => {
  describe('escapeHtml', () => {
    it('escapa los cinco caracteres especiales de HTML', () => {
      expect(escapeHtml('<a href="x">&\'y\'</a>')).toBe(
        '&lt;a href=&quot;x&quot;&gt;&amp;&#39;y&#39;&lt;/a&gt;',
      );
    });

    it('deja intacto el texto normal con acentos', () => {
      expect(escapeHtml('María añadió Leche')).toBe('María añadió Leche');
    });
  });

  describe('renderEmailLayout', () => {
    const html = renderEmailLayout({
      preheader: 'Adelanto de prueba',
      title: 'Título de prueba',
      heading: 'Hola, Mundo',
      bodyHtml: '<p style="margin:0;">Cuerpo</p>',
    });

    it('es un documento completo con la marca y el pie', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('Lista de Compra');
      expect(html).toContain('Adelanto de prueba');
      expect(html).toContain('Hola, Mundo');
      expect(html).toContain(`© ${new Date().getFullYear()} Lista de Compra`);
      expect(html).toContain('listacompra.laurafernandezenfermeria.com');
    });

    it('usa tablas con estilos en línea y ningún bloque <style>', () => {
      expect(html).not.toContain('<style>');
      expect(html).toContain('<table role="presentation"');
      expect(html).toContain('width="600"');
      expect(html).toContain('#4387f4');
    });
  });

  describe('renderEmailButton', () => {
    it('genera un botón con la URL y la etiqueta', () => {
      const html = renderEmailButton('https://example.com/lists?a=1&b=2', 'Ver mis listas');
      expect(html).toContain('href="https://example.com/lists?a=1&amp;b=2"');
      expect(html).toContain('Ver mis listas');
      expect(html).toContain('bgcolor="#4387f4"');
    });
  });

  describe('renderEmailCallout', () => {
    it('genera la caja con la barra lateral de color', () => {
      const html = renderEmailCallout('Aviso importante', '#e8a838');
      expect(html).toContain('background-color:#e8a838');
      expect(html).toContain('Aviso importante');
    });
  });

  describe('renderInvitationEmail', () => {
    it('incluye nombres, lista, enlace y caducidad', () => {
      const html = renderInvitationEmail({
        recipientName: 'Lucía',
        inviterName: 'María',
        listName: 'Compra semanal',
        invitationUrl: 'https://listacompra.laurafernandezenfermeria.com/invitations/hash123',
        expiresAt: new Date('2026-12-03T10:00:00.000Z'),
      });
      expect(html).toContain('María');
      expect(html).toContain('Compra semanal');
      expect(html).toContain('/invitations/hash123');
      expect(html).toContain('Acceder a la lista');
      expect(html).toContain('expira el');
      expect(html).not.toContain('<style>');
    });

    it('escapa un nombre de lista con HTML en lugar de interpretarlo', () => {
      const html = renderInvitationEmail({
        recipientName: 'Lucía',
        inviterName: 'María',
        listName: '<script>alert(1)</script>',
        invitationUrl: 'https://example.com/invitations/x',
        expiresAt: new Date('2026-12-03T10:00:00.000Z'),
      });
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('renderConfirmationEmail', () => {
    it('incluye el enlace de confirmación y el botón', () => {
      const html = renderConfirmationEmail({
        recipientName: 'Nuevo Usuario',
        confirmationUrl: 'https://listacompra.laurafernandezenfermeria.com/confirm-email/tok-1',
      });
      expect(html).toContain('/confirm-email/tok-1');
      expect(html).toContain('Confirmar correo');
      expect(html).not.toContain('<style>');
    });
  });

  describe('renderNotificationEmail', () => {
    it.each([
      ['item_added', 'Se ha añadido un nuevo elemento', '#10b981'],
      ['item_removed', 'Se ha eliminado un elemento', '#ef4444'],
      ['item_updated', 'Se ha actualizado un elemento', '#e8a838'],
      ['list_updated', 'Se ha actualizado la lista', '#4387f4'],
    ] as const)(
      'el tipo %s muestra su etiqueta, su color y el detalle escapado',
      (changeType, label, color) => {
        const html = renderNotificationEmail({
          recipientName: 'Miembro',
          listName: 'Lista de Compras',
          changeType,
          changeDetails: 'Anthony añadió "Leche x2" a la lista',
          listsUrl: 'https://listacompra.laurafernandezenfermeria.com/lists',
        });
        expect(html).toContain(label);
        expect(html).toContain(color);
        expect(html).toContain('Leche x2');
        expect(html).toContain('Ver mis listas');
        expect(html).toContain('/lists');
        expect(html).not.toContain('<style>');
      },
    );

    it('escapa el detalle del cambio', () => {
      const html = renderNotificationEmail({
        recipientName: 'Miembro',
        listName: 'Lista',
        changeType: 'item_added',
        changeDetails: '<img src=x onerror=alert(1)>',
        listsUrl: 'https://example.com/lists',
      });
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x');
    });
  });
});
