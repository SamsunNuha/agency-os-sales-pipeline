import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtUser } from '../../common/types/jwt-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    agencyId: string;
    roles: string[];
    iat: number;
    exp: number;
  }): Promise<JwtUser> {
    if (!payload.sub || !payload.agencyId) {
      throw new UnauthorizedException({ message: 'Invalid token payload', code: 'INVALID_TOKEN' });
    }
    return {
      sub: payload.sub,
      id: payload.sub,
      email: payload.email,
      agencyId: payload.agencyId,
      roles: payload.roles || [],
    };
  }
}
