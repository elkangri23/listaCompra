/**
 * Turnstile (Cloudflare) solo para el registro.
 *
 * Sin clave secreta no hay captcha: el registro sigue funcionando en
 * local/demo. Con clave configurada el token es obligatorio al registrarse.
 * Si Cloudflare no responde, el registro se rechaza (fail closed): un fallo
 * de red no debe convertirse en una vía para saltarse el captcha.
 * Patrón copiado de retaton (app/Domain/Auth/TurnstileService.php).
 */

import axios from 'axios';
import type { ITurnstileVerifier } from '@application/ports/auth/ITurnstileVerifier';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export class TurnstileService implements ITurnstileVerifier {
  constructor(
    private readonly secretKey: string | undefined = process.env['TURNSTILE_SECRET_KEY']
  ) {}

  enabled(): boolean {
    return typeof this.secretKey === 'string' && this.secretKey !== '';
  }

  async verify(token: string): Promise<boolean> {
    if (!this.enabled()) {
      return true;
    }

    if (!token) {
      return false;
    }

    try {
      const response = await axios.post<{ success?: boolean }>(
        SITEVERIFY_URL,
        new URLSearchParams({
          secret: this.secretKey as string,
          response: token,
        }),
        {
          timeout: 5000,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      return response.data.success === true;
    } catch {
      return false;
    }
  }
}
