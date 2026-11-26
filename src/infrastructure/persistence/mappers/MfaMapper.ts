/**
 * Mapper para las estructuras MFA (MfaChallenge, MfaBackupCode)
 */

import type { MfaChallenge, MfaBackupCode } from '@prisma/client';
import type {
  MfaChallengeData,
  MfaBackupCodeData,
} from '@application/ports/repositories/IMfaRepository';

export class MfaMapper {
  static challengeToData(raw: MfaChallenge): MfaChallengeData {
    return {
      id: raw.id,
      usuarioId: raw.usuarioId,
      tipo: raw.tipo as MfaChallengeData['tipo'],
      challenge: raw.challenge,
      intentos: raw.intentos,
      expiraAt: raw.expiraAt,
    };
  }

  static backupCodeToData(raw: MfaBackupCode): MfaBackupCodeData {
    return {
      id: raw.id,
      usuarioId: raw.usuarioId,
      codeHash: raw.codeHash,
      usado: raw.usado,
      usadoAt: raw.usadoAt,
    };
  }
}
