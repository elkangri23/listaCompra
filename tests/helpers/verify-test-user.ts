/**
 * Helper para tests E2E/integración (item 3): marca el correo de un usuario
 * de pruebas como verificado usando el método de dominio, igual que haría
 * el flujo real tras introducir el código. Los tests que ejercitan la
 * verificación en sí (user-registration-flow) usan el endpoint real.
 */

import type { Container } from '../../src/composition/container';
import { Email } from '../../src/domain/value-objects/Email';

export async function markTestUserEmailVerified(
  container: Container,
  email: string
): Promise<void> {
  const emailResult = Email.create(email);
  if (emailResult.isFailure) {
    throw new Error(`Email inválido para verificar: ${email}`);
  }
  const userResult = await container.usuarioRepository.findByEmail(emailResult.value);
  if (userResult.isFailure || !userResult.value) {
    throw new Error(`Usuario de pruebas no encontrado: ${email}`);
  }
  const usuario = userResult.value;
  if (usuario.emailVerificado) {
    return;
  }
  const verifyResult = usuario.verificarEmail();
  if (verifyResult.isFailure) {
    throw new Error(`No se pudo verificar el usuario ${email}: ${verifyResult.error.message}`);
  }
  const updateResult = await container.usuarioRepository.update(usuario);
  if (updateResult.isFailure) {
    throw new Error(`No se pudo guardar el usuario ${email}: ${updateResult.error.message}`);
  }
}
