import { API_CORS_METHODS } from './cors.config';

type PreflightResponse = {
  statusCode: number;
  getHeader: (name: string) => string | undefined;
  setHeader: (name: string, value: string | number) => void;
  end: () => void;
};

// Run the actual Express CORS middleware without booting the database-backed
// app. Browsers check the returned methods before sending a PUT request.
const cors =
  jest.requireActual<
    (options: {
      origin: boolean;
      credentials: boolean;
      methods: string[];
      allowedHeaders: string[];
    }) => (
      request: { method: string; headers: Record<string, string> },
      response: PreflightResponse,
      next: () => void,
    ) => void
  >('cors');

function preflight(methods = API_CORS_METHODS) {
  const headers = new Map<string, string>();
  const response: PreflightResponse = {
    statusCode: 200,
    getHeader: (name) => headers.get(name.toLowerCase()),
    setHeader: (name, value) => {
      headers.set(name.toLowerCase(), String(value));
    },
    end: jest.fn(),
  };
  cors({
    origin: true,
    credentials: true,
    methods,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })(
    {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type,x-csrf-token',
      },
    },
    response,
    jest.fn(),
  );
  return response;
}

describe('Onboarding CORS preflight', () => {
  it('reproduces the old policy blocking PUT and permits it with the app policy', () => {
    const previous = preflight(['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']);
    expect(
      previous.getHeader('Access-Control-Allow-Methods')?.split(','),
    ).not.toContain('PUT');
    const fixed = preflight();
    expect(fixed.statusCode).toBe(204);
    expect(
      fixed.getHeader('Access-Control-Allow-Methods')?.split(','),
    ).toContain('PUT');
  });

  it('keeps the origin, cookies, and CSRF header allowed for authenticated saves', () => {
    const response = preflight();
    expect(response.getHeader('Access-Control-Allow-Origin')).toBe(
      'http://localhost:3000',
    );
    expect(response.getHeader('Access-Control-Allow-Credentials')).toBe('true');
    expect(
      response.getHeader('Access-Control-Allow-Headers')?.split(','),
    ).toContain('X-CSRF-Token');
  });
});
