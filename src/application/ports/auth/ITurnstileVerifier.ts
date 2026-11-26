/**
 * Puerto: verificador de captcha Turnstile (Cloudflare), solo para el registro.
 *
 * Sin clave secreta configurada no hay captcha: `enabled()` es false y
 * `verify()` acepta cualquier token, para que el registro siga funcionando
 * en local/demo. Con clave, el token es obligatorio y se verifica contra
 * Cloudflare; si Cloudflare no responde, la verificación falla (fail closed).
 */
export interface ITurnstileVerifier {
  /** True cuando hay clave secreta configurada y el captcha está activo. */
  enabled(): boolean;

  /** Verifica un token del widget contra Cloudflare. */
  verify(token: string): Promise<boolean>;
}
