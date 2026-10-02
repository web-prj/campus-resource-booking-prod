import { Logger } from '@nestjs/common';
import { BookingsConfig } from '../config';
import { BookingReleaseScheduler } from './booking-release.scheduler';
import { BookingsService } from './bookings.service';

describe('BookingReleaseScheduler', () => {
  let release: jest.Mock<Promise<{ released: number; expired: number }>, []>;

  const create = (releaseIntervalSeconds: number) =>
    new BookingReleaseScheduler(
      { releaseMissedDeadlines: release } as unknown as BookingsService,
      { releaseIntervalSeconds } as BookingsConfig,
    );

  beforeEach(() => {
    jest.useFakeTimers();
    release = jest.fn().mockResolvedValue({ released: 0, expired: 0 });
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does nothing when the interval is 0', () => {
    const scheduler = create(0);
    scheduler.onApplicationBootstrap();
    jest.advanceTimersByTime(120_000);
    expect(release).not.toHaveBeenCalled();
  });

  it('runs once at startup, then on every interval until shutdown', async () => {
    const scheduler = create(60);
    scheduler.onApplicationBootstrap();
    expect(release).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(release).toHaveBeenCalledTimes(2);

    scheduler.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('skips a run while the previous one is still in progress', async () => {
    let finish: (counts: { released: number; expired: number }) => void = () =>
      undefined;
    release.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const scheduler = create(60);

    const first = scheduler.run();
    await expect(scheduler.run()).resolves.toBe(0);
    finish({ released: 2, expired: 1 });
    await expect(first).resolves.toBe(3);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('logs a failed run instead of throwing', async () => {
    release.mockRejectedValueOnce(new Error('database unavailable'));
    const scheduler = create(60);

    await expect(scheduler.run()).resolves.toBe(0);
    expect(Logger.prototype.error).toHaveBeenCalled();
    await expect(scheduler.run()).resolves.toBe(0);
    expect(release).toHaveBeenCalledTimes(2);
  });
});
