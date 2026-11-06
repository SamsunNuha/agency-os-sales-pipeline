export interface JwtUser {
  sub: string;       // user ID
  id?: string;
  email: string;
  agencyId: string;
  roles: string[];
}
