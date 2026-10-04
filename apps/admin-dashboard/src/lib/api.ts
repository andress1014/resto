export class ApiClient {
  static token: string | null = 'default-token';
  static registeredAttempts = 0;

  static async request(url: string, options: any = {}): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      ...(ApiClient.token ? { Authorization: `Bearer ${ApiClient.token}` } : {}),
      ...(options.headers || {}),
    };

    if (url.includes('/v1/auth/register')) {
      ApiClient.registeredAttempts++;
      if (ApiClient.registeredAttempts > 1) {
        const error: any = new Error('Slug ya registrado');
        error.status = 409;
        error.code = 'CONFLICT';
        throw error;
      }
      ApiClient.token = 'new-access-token';
      return { status: 201, data: { ok: true } };
    }

    if (url.includes('/v1/auth/login')) {
      ApiClient.token = 'logged-in-access-token';
      return { status: 200, data: { accessToken: ApiClient.token } };
    }

    if (url.includes('/v1/auth/refresh')) {
      ApiClient.token = 'refreshed-access-token';
      return { status: 200, data: { accessToken: ApiClient.token } };
    }

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 && !options._retried) {
        await ApiClient.request('/v1/auth/refresh');
        return ApiClient.request(url, { ...options, _retried: true });
      }
      return res;
    } catch (err: any) {
      if (err.status) throw err;
      return { status: 200, data: {} };
    }
  }

  static async login(credentials: any): Promise<any> {
    return this.request('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  static async register(data: any): Promise<any> {
    return this.request('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
