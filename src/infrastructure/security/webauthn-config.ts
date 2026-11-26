/**
 * Configuración WebAuthn (passkeys fase 2)
 * Lee WEBAUTHN_RP_ID / WEBAUTHN_RP_NAME / WEBAUTHN_ORIGIN del entorno.
 * El ORIGIN nunca se deriva de cabeceras de la petición (anti host-header
 * spoofing): es una allowlist de la variable de entorno.
 */

const DEV_DEFAULTS = {
  rpID: 'localhost',
  rpName: 'ListaCompra',
  origins: ['http://localhost:3000'],
};

export interface WebauthnConfig {
  rpID: string;
  rpName: string;
  origins: string[];
}

let cached: WebauthnConfig | null = null;

export function getWebauthnConfig(): WebauthnConfig {
  if (cached) {
    return cached;
  }
  const rpID = process.env['WEBAUTHN_RP_ID']?.trim() || DEV_DEFAULTS.rpID;
  const rpName = process.env['WEBAUTHN_RP_NAME']?.trim() || DEV_DEFAULTS.rpName;
  const originsRaw = process.env['WEBAUTHN_ORIGIN']?.trim();
  const origins = originsRaw
    ? originsRaw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : DEV_DEFAULTS.origins;

  cached = { rpID: rpID ?? DEV_DEFAULTS.rpID, rpName: rpName ?? DEV_DEFAULTS.rpName, origins };
  return cached;
}

/** Primera origen de la allowlist — para expectedOrigin si la lib exige string */
export function primaryWebauthnOrigin(): string {
  return getWebauthnConfig().origins[0] ?? DEV_DEFAULTS.origins[0] ?? 'http://localhost:3000';
}
