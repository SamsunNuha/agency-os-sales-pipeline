export interface JwtUser {
  sub: string;       // user ID
  email: string;
  agencyId: string;
  roles: string[];
}
