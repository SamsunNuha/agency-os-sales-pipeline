import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'Admin or admin@agency-os.local' })
  @IsString({ message: 'Must be a valid email or username' })
  email: string;

  @ApiProperty({ example: 'Admin@1234' })
  @IsString()
  @MinLength(4, { message: 'Password must be at least 4 characters' })
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'sales@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ example: 'Sales@1234' })
  @IsString()
  @MinLength(4, { message: 'Password must be at least 4 characters' })
  password: string;
}
