import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      agencyId: string;
      roles: string[];
    };
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        roles: { include: { role: true } },
        agency: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.agency.isActive) {
      throw new UnauthorizedException({
        message: 'Agency account is inactive',
        code: 'AGENCY_INACTIVE',
      });
    }

    const passwordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const roleNames = user.roles.map((ur) => ur.role.name);

    const payload = {
      sub: user.id,
      email: user.email,
      agencyId: user.agencyId,
      roles: roleNames,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        agencyId: user.agencyId,
        roles: roleNames,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        agency: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      agencyId: user.agencyId,
      agencyName: user.agency.name,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }
}
