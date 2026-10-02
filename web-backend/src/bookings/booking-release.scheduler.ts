import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { BookingsConfig, bookingsConfig } from '../config';
import { BookingsService } from './bookings.service';

/**
 * Periodically closes bookings whose scheduled end passed
 * unused: missed check-ins become no-shows and unreviewed requests expire.
 * Each run is idempotent UPDATEs, so several API processes running it at once
 * is harmless.
 */
@Injectable()
export class BookingReleaseScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BookingReleaseScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly bookingsService: BookingsService,
    @Inject(bookingsConfig.KEY) private readonly config: BookingsConfig,
  ) {}

  onApplicationBootstrap(): void {
    const seconds = this.config.releaseIntervalSeconds;
    if (seconds <= 0) return;
    this.timer = setInterval(() => void this.run(), seconds * 1000);
    this.timer.unref();
    void this.run();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async run(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const { released, expired } =
        await this.bookingsService.releaseMissedDeadlines();
      if (released > 0 || expired > 0) {
        this.logger.log(
          `Check-in deadline passed: released ${released} missed booking(s), expired ${expired} unreviewed request(s)`,
        );
      }
      return released + expired;
    } catch (error: unknown) {
      this.logger.error(
        'Closing bookings past their scheduled end failed',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
