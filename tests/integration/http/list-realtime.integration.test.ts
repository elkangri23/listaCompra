import http from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import type { Application } from 'express';
import { Container } from '../../../src/composition/container';
import { createServer } from '../../../src/infrastructure/http/server';

describe('List realtime streaming (SSE)', () => {
  let app: Application;
  let container: Container;
  let server: http.Server;
  let baseUrl: string;
  let authToken: string;
  let listaId: string;

  const credentials = {
    email: `realtime-user-${Date.now()}@test.com`,
    password: 'Password123!'
  };

  beforeAll(async () => {
    container = Container.getInstance();
    await container.connect();

    app = await createServer({
      authController: container.authController,
      invitationController: container.invitationController,
      adminController: container.adminController,
      aiController: container.aiController,
      authMiddleware: container.authMiddleware,
      listController: container.listController,
      productController: container.productController,
      categoryController: container.categoryController,
      auditController: container.auditController
    });

    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: credentials.email,
        password: credentials.password,
        nombre: 'Realtime User'
      })
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(200);

    authToken = loginResponse.body.data.tokens.accessToken;

    const createListResponse = await request(app)
      .post('/api/v1/lists')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        nombre: 'Lista para realtime',
        descripcion: 'Lista de prueba para SSE'
      })
      .expect(201);

    listaId = createListResponse.body.data.id;
  });

  afterAll(async () => {
    container.realTimeGateway.shutdown();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await container.disconnect();
  });

  it('emite eventos de actualización después de conectar al stream', async () => {
    const events: string[] = [];
    let updateTriggered = false;

    await new Promise<void>((resolve, reject) => {
      let closedManually = false;
      let clientRequest: http.ClientRequest;
      const timeout = setTimeout(() => {
        if (!closedManually) {
          closedManually = true;
          clientRequest.destroy();
          reject(new Error('Timeout esperando eventos SSE'));
        }
      }, 8000);

      clientRequest = http.request(
        `${baseUrl}/api/v1/lists/${listaId}/stream`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'text/event-stream',
          },
        },
        (res) => {
          res.setEncoding('utf8');

          res.on('data', (chunk: string) => {
            events.push(chunk);

            if (!updateTriggered && chunk.includes('LIST_STREAM_CONNECTED')) {
              updateTriggered = true;
              void request(app)
                .put(`/api/v1/lists/${listaId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ nombre: `Lista actualizada ${Date.now()}` })
                .expect(200)
                .catch((error) => {
                  if (!closedManually) {
                    closedManually = true;
                    clearTimeout(timeout);
                    clientRequest.destroy();
                    reject(error);
                  }
                });
            }

            if (chunk.includes('LIST_UPDATED')) {
              if (!closedManually) {
                closedManually = true;
                clearTimeout(timeout);
                clientRequest.destroy();
                resolve();
              }
            }
          });

          res.on('error', (error) => {
            if (!closedManually) {
              closedManually = true;
              clearTimeout(timeout);
              clientRequest.destroy();
              reject(error);
            }
          });
        }
      );

      clientRequest.on('error', (error) => {
        if (!closedManually) {
          closedManually = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      clientRequest.end();
    });

    expect(events.some((chunk) => chunk.includes('LIST_STREAM_CONNECTED'))).toBe(true);
    expect(events.some((chunk) => chunk.includes('LIST_UPDATED'))).toBe(true);
  });

  it('rechaza la conexión sin autenticación', async () => {
    await request(app)
      .get(`/api/v1/lists/${listaId}/stream`)
      .expect(401);
  });
});
