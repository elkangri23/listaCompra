/**
 * Script para probar el WorkerService y los consumers de RabbitMQ
 * Ejecutar con: npm run test:workers
 */

import { Container } from '../src/composition/container';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function testWorkers() {
  console.log('🚀 Iniciando prueba del WorkerService...\n');

  try {
    // Obtener container
    const container = Container.getInstance();

    console.log('📦 Container obtenido exitosamente');

    // Obtener WorkerService
    const workerService = container.workerService;
    
    console.log('⚙️ WorkerService obtenido del container');

    // Verificar estado inicial
    console.log('\n📊 Estado inicial:');
    console.log(workerService.getStatus());

    // Verificar si RabbitMQ está habilitado
    const rabbitmqEnabled = process.env['RABBITMQ_ENABLED'] === 'true';
    console.log(`\n🐰 RabbitMQ habilitado: ${rabbitmqEnabled}`);

    if (!rabbitmqEnabled) {
      console.log('⚠️ RabbitMQ está deshabilitado. Workers no se iniciarán.');
      console.log('💡 Para habilitar, configura RABBITMQ_ENABLED=true en .env');
      return;
    }

    // Intentar iniciar workers (fallará si no hay conectividad)
    console.log('\n🔄 Intentando iniciar Workers...');
    try {
      await workerService.start();
      console.log('✅ Workers iniciados exitosamente');

      // Mostrar estado después del inicio
      console.log('\n📊 Estado después del inicio:');
      console.log(workerService.getStatus());

      // Esperar unos segundos
      console.log('\n⏳ Esperando 3 segundos...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mostrar estado final
      console.log('\n📊 Estado final:');
      console.log(workerService.getStatus());

      // Detener workers
      console.log('\n🛑 Deteniendo Workers...');
      await workerService.stop();
      console.log('✅ Workers detenidos exitosamente');

    } catch (error) {
      console.error('💥 Error con Workers (esperado sin RabbitMQ):', error);
      console.log('📝 Esto es normal si RabbitMQ no está ejecutándose');
    }

    console.log('\n🎉 ¡Prueba del WorkerService completada!');

  } catch (error) {
    console.error('\n💥 Error durante las pruebas:', error);
  }
}

// Ejecutar las pruebas
if (require.main === module) {
  testWorkers()
    .then(() => {
      console.log('\n✨ Script de prueba finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { testWorkers };