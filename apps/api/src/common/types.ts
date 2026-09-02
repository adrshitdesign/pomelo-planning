export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  sessionId: string;
  roles: string[];
  permissions: string[];
  teamIds: string[];
}

export interface JwtAccessPayload {
  sub: string;
  sid: string;
  email: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}
