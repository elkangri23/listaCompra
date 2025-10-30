jest.mock('node-cron', () => ({
  schedule: jest.fn((expression: string, callback: () => Promise<void>) => {
    const job: any = {
      expression,
      callback,
      running: false,
      start: jest.fn(() => {
        job.running = true;
      }),
      stop: jest.fn(() => {
        job.running = false;
      }),
      getStatus: jest.fn(() => (job.running ? 'scheduled' : 'stopped'))
    };

    return job;
  })
}));

import { SecurityScheduler } from '@infrastructure/scheduling/SecurityScheduler';

describe('SecurityScheduler', () => {
  const prismaMock: any = {
    invitacion: {
      count: jest.fn().mockResolvedValue(2),
      updateMany: jest.fn().mockResolvedValue({ count: 2 })
    },
    outboxEvent: {
      count: jest.fn().mockResolvedValue(5)
    }
  };

  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  } as any;

  const cron = require('node-cron') as { schedule: jest.Mock };

  beforeEach(() => {
    cron.schedule.mockClear();
    Object.values(prismaMock.invitacion).forEach(fn => (fn as jest.Mock).mockClear());
    Object.values(prismaMock.outboxEvent).forEach(fn => (fn as jest.Mock).mockClear());
    loggerMock.info.mockClear();
    loggerMock.error.mockClear();
    loggerMock.debug.mockClear();
  });

  it('inicializa los jobs de seguridad con los cron expresions correctos', () => {
    const scheduler = new SecurityScheduler(prismaMock, loggerMock);

    scheduler.initializeSecurityJobs();

    expect(cron.schedule).toHaveBeenCalledTimes(2);
    const expressions = cron.schedule.mock.calls.map((call: any[]) => call[0]);
    expect(expressions).toEqual(expect.arrayContaining(['0 * * * *', '0 2 * * *']));
  });

  it('arranca y detiene todos los jobs correctamente', () => {
    const scheduler = new SecurityScheduler(prismaMock, loggerMock);
    scheduler.initializeSecurityJobs();

    scheduler.startAllJobs();
    const jobs = cron.schedule.mock.calls
      .map((_call: any[], index: number) => cron.schedule.mock.results[index]?.value)
      .filter(Boolean) as any[];
    jobs.forEach((job: any) => {
      expect(job.start).toHaveBeenCalled();
      expect(job.getStatus()).toBe('scheduled');
    });

    scheduler.stopAllJobs();
    jobs.forEach((job: any) => {
      expect(job.stop).toHaveBeenCalled();
      expect(job.getStatus()).toBe('stopped');
    });
  });

  it('ejecuta el cleanup de invitaciones expiradas', async () => {
    const scheduler = new SecurityScheduler(prismaMock, loggerMock);
    scheduler.initializeSecurityJobs();

    const invitationCall = cron.schedule.mock.calls.find((call: any[]) => call[0] === '0 * * * *');
    expect(invitationCall).toBeDefined();

    const invitationCallback = invitationCall?.[1];
    expect(typeof invitationCallback).toBe('function');

    if (typeof invitationCallback === 'function') {
      await invitationCallback();
      expect(prismaMock.invitacion.count).toHaveBeenCalled();
      expect(prismaMock.invitacion.updateMany).toHaveBeenCalled();
    }
  });

  it('ejecuta el cleanup de eventos de outbox', async () => {
    const scheduler = new SecurityScheduler(prismaMock, loggerMock);
    scheduler.initializeSecurityJobs();

    const outboxCall = cron.schedule.mock.calls.find((call: any[]) => call[0] === '0 2 * * *');
    expect(outboxCall).toBeDefined();

    const outboxCallback = outboxCall?.[1];
    expect(typeof outboxCallback).toBe('function');

    if (typeof outboxCallback === 'function') {
      await outboxCallback();
      expect(prismaMock.outboxEvent.count).toHaveBeenCalled();
    }
  });
});
