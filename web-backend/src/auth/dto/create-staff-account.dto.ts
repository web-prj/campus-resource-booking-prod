import { RegisterDto } from './register.dto';

/**
 * Same rules as self-registration: an exact @usth.edu.vn address, an 8-72 byte
 * password, and a display name. The administrator hands the initial password
 * to the new staff member.
 */
export class CreateStaffAccountDto extends RegisterDto {}
