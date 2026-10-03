import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.users.save(user);
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
