import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LogInDto } from './dto/log-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { hashPassword, verifyPassword } from './password';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Create a new account and save it to the database. */
  async signUp(dto: SignUpDto): Promise<User> {
    const existing = await this.users.findOneBy({ email: dto.email });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const user = this.users.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash: await hashPassword(dto.password),
    });
    try {
      return await this.users.save(user);
    } catch (error) {
      // Two sign ups with the same email at the same moment can both pass the
      // check above; the database's unique email rule (code 23505) stops one.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw error;
    }
  }

  /** Check the email and password, and return the user if they match. */
  async logIn(dto: LogInDto): Promise<User> {
    // passwordHash is hidden by default (select: false), so ask for it here.
    const user = await this.users.findOne({
      where: { email: dto.email },
      select: { id: true, email: true, fullName: true, passwordHash: true },
    });

    const passwordOk =
      user?.passwordHash != null &&
      (await verifyPassword(dto.password, user.passwordHash));

    // Same message for "no such email" and "wrong password", so the form
    // does not reveal which emails have accounts.
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return user;
  }
}
