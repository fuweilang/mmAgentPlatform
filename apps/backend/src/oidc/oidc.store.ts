export type AuthCode = {
  sub: string;
  nonce: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  exp: number;
};

const codes = new Map<string, AuthCode>();

export function saveCode(code: string, data: AuthCode) {
  codes.set(code, data);
}

export function takeCode(code: string): AuthCode | undefined {
  const row = codes.get(code);
  if (!row) return undefined;
  codes.delete(code);
  if (row.exp < Date.now()) return undefined;
  return row;
}
