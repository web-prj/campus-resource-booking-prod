import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Node's built-in scrypt, wrapped so we can use it with async/await.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number,
) => Promise<Buffer>;

/**
 * Turn a plain password into "salt:hash" for saving in the database.
 * We never store the real password, only this one-way hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

/** Check a typed password against a saved "salt:hash". */
export async function verifyPassword(
  password: string,
  saved: string,
): Promise<boolean> {
  const [salt, savedHash] = saved.split(':');
  if (!salt || !savedHash) return false;

  const expected = Buffer.from(savedHash, 'hex');
  const actual = await scryptAsync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
