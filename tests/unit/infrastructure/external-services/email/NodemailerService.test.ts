/**
 * Tests unitarios para NodemailerService (Fase 8 - emails con Resend)
 * Mockea el SDK de Resend: éxito, reintentos con backoff y stats.
 */

import { NodemailerService, EmailConfig } from '../../../../../src/infrastructure/external-services/email/NodemailerService';
import { Resend } from 'resend';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn()
}));

const CONFIG: EmailConfig = {
  apiKey: 're_test_key',
  from: { name: 'Lista Compra', email: 'noreply@test.local' },
  maxRetries: 3,
  retryDelay: 1
};

describe('NodemailerService', () => {
  let service: NodemailerService;

  beforeEach(() => {
    sendMock.mockReset();
    // resetMocks:true borra la implementación del mock del constructor
    (Resend as unknown as jest.Mock).mockImplementation(() => ({ emails: { send: sendMock } }));
    service = new NodemailerService(CONFIG);
  });

  describe('verifyConnection', () => {
    it('true con apiKey presente', async () => {
      expect(await service.verifyConnection()).toBe(true);
    });

    it('false sin apiKey', async () => {
      const empty = new NodemailerService({ apiKey: '', from: CONFIG.from });
      expect(await empty.verifyConnection()).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('envía y devuelve messageId', async () => {
      sendMock.mockResolvedValue({ data: { id: 'msg-1' }, error: null });

      const result = await service.sendEmail({ to: 'a@test.local', subject: 'hola', text: 'mundo' });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-1');
      const payload = sendMock.mock.calls[0]?.[0];
      expect(payload.to).toEqual(['a@test.local']);
      expect(payload.from).toContain('noreply@test.local');
    });

    it('normaliza cc/bcc a arrays', async () => {
      sendMock.mockResolvedValue({ data: { id: 'msg-2' }, error: null });

      await service.sendEmail({ to: 'a@test.local', subject: 's', cc: 'b@test.local', bcc: 'c@test.local' });

      const payload = sendMock.mock.calls[0]?.[0];
      expect(payload.cc).toEqual(['b@test.local']);
      expect(payload.bcc).toEqual(['c@test.local']);
    });

    it('devuelve error con reintentos agotados', async () => {
      sendMock.mockResolvedValue({ data: null, error: { message: 'quota' } });

      const result = await service.sendEmail({ to: 'a@test.local', subject: 's' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('quota');
      expect(sendMock).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('reintenta con backoff y termina bien en el 2º intento', async () => {
      sendMock
        .mockResolvedValueOnce({ data: null, error: { message: 'temporal' } })
        .mockResolvedValue({ data: { id: 'ok' }, error: null });

      const result = await service.sendEmail({ to: 'a@test.local', subject: 's' });

      expect(result.success).toBe(true);
      expect(sendMock).toHaveBeenCalledTimes(2);
    });

    it('captura excepciones del SDK', async () => {
      sendMock.mockRejectedValue(new Error('network down'));

      const result = await service.sendEmail({ to: 'a@test.local', subject: 's' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('network down');
    });
  });

  describe('emails de negocio', () => {
    it('sendInvitationEmail genera asunto y html de invitación', async () => {
      sendMock.mockResolvedValue({ data: { id: 'inv-1' }, error: null });

      const result = await service.sendInvitationEmail(
        'inv@test.local', 'Invitado', 'María', 'Mi Lista', 'hash123', new Date('2026-12-01')
      );

      expect(result.success).toBe(true);
      const payload = sendMock.mock.calls[0]?.[0];
      expect(payload.subject).toContain('María');
      expect(payload.subject).toContain('Mi Lista');
      expect(payload.html).toContain('/invitations/hash123');
    });

    it('sendListChangeNotification mapea el tipo de cambio', async () => {
      sendMock.mockResolvedValue({ data: { id: 'chg-1' }, error: null });

      await service.sendListChangeNotification('a@test.local', 'User', 'Lista', 'item_added', 'Leche x2');

      const payload = sendMock.mock.calls[0]?.[0];
      expect(payload.subject).toContain('nuevo elemento');
      expect(payload.html).toContain('Leche x2');
    });

    it('sendRegistrationConfirmation genera enlace de confirmación', async () => {
      sendMock.mockResolvedValue({ data: { id: 'conf-1' }, error: null });

      await service.sendRegistrationConfirmation('n@test.local', 'Nuevo', 'tok-1');

      const payload = sendMock.mock.calls[0]?.[0];
      expect(payload.subject).toContain('Confirma');
      expect(payload.html).toContain('/confirm-email/tok-1');
    });

    it('sendVerificationCodeEmail genera asunto y html con el código', async () => {
      sendMock.mockResolvedValue({ data: { id: 'ver-1' }, error: null });

      const result = await service.sendVerificationCodeEmail('v@test.local', 'Lucía', '482913');

      expect(result.success).toBe(true);
      const payload = sendMock.mock.calls[0]?.[0];
      expect(payload.to).toEqual(['v@test.local']);
      expect(payload.subject).toContain('código de verificación');
      expect(payload.html).toContain('482913');
      expect(payload.html).toContain('15 minutos');
      expect(payload.text).toContain('482913');
    });

    it('sendPasswordResetCodeEmail genera asunto y html con el código', async () => {
      sendMock.mockResolvedValue({ data: { id: 'rst-1' }, error: null });

      const result = await service.sendPasswordResetCodeEmail('v@test.local', 'Lucía', '482913');

      expect(result.success).toBe(true);
      const payload = sendMock.mock.calls[0]?.[0];
      expect(payload.to).toEqual(['v@test.local']);
      expect(payload.subject).toContain('restablecer la contraseña');
      expect(payload.html).toContain('482913');
      expect(payload.html).toContain('15 minutos');
      expect(payload.text).toContain('482913');
    });
  });

  describe('getStats', () => {
    it('acumula sent y failed', async () => {
      sendMock
        .mockResolvedValueOnce({ data: { id: '1' }, error: null })
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ data: { id: '2' }, error: null });

      await service.sendEmail({ to: 'a@test.local', subject: '1' });
      await service.sendEmail({ to: 'a@test.local', subject: '2' });
      await service.sendEmail({ to: 'a@test.local', subject: '3' });

      const stats = await service.getStats();
      expect(stats.sent).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });
  });
});
