import fetchMock from 'jest-fetch-mock';
import Mailchk, { 
  MailchkConfigBuilder,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NetworkError,
  TimeoutError,
  APIError
} from '../src/index';

describe('Mailchk Client', () => {
  let client: Mailchk;

  beforeEach(() => {
    client = new Mailchk({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com/v1',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100
    });
  });

  afterEach(() => {
    jest.runAllTimers();
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(client).toBeInstanceOf(Mailchk);
    });

    it('should throw error for missing API key', () => {
      expect(() => {
        new Mailchk({ apiKey: '' });
      }).toThrow(AuthenticationError);
    });

    it('should use default values', () => {
      const defaultClient = new Mailchk({ apiKey: 'test' });
      expect(defaultClient).toBeInstanceOf(Mailchk);
    });
  });

  describe('fromEnvironment', () => {
    it('should create client from environment', () => {
      process.env.MAILCHK_API_KEY = 'env-api-key';
      
      const envClient = Mailchk.fromEnvironment();
      expect(envClient).toBeInstanceOf(Mailchk);
    });
  });

  describe('build', () => {
    it('should create client using builder pattern', () => {
      const builtClient = Mailchk.build(builder => 
        builder
          .setApiKey('built-api-key')
          .setTimeout(10000)
      );
      
      expect(builtClient).toBeInstanceOf(Mailchk);
    });
  });

  describe('validate', () => {
    const mockValidationResult = {
      email: 'test@example.com',
      domain: 'example.com',
      valid: true,
      disposable: false,
      scam_domain: false,
      mx_exists: true,
      blacklisted_mx: false,
      free_email: false,
      did_you_mean: '',
      risk_score: 'low' as const,
      risk_factors: [],
      email_provider: 'Example Corp',
      deliverability_score: 95,
      spf: 'pass' as const,
      dmarc: 'pass' as const,
      normalized_email: 'test@example.com',
      is_aliased: false,
      alias_type: null
    };

    it('should validate email successfully', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockValidationResult));

      const result = await client.validate('test@example.com');

      expect(result).toEqual(mockValidationResult);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.test.com/v1/check',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
            'User-Agent': 'mailchk-node/1.2.0'
          }),
          body: JSON.stringify({ email: 'test@example.com' })
        })
      );
    });

    it('should throw ValidationError for invalid email', async () => {
      await expect(client.validate('')).rejects.toThrow(ValidationError);
      await expect(client.validate('invalid')).rejects.toThrow(ValidationError);
    });

    it('should handle API response wrapped in success envelope', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({
        success: true,
        data: mockValidationResult
      }));

      const result = await client.validate('test@example.com');
      expect(result).toEqual(mockValidationResult);
    });
  });

  describe('validateBulk', () => {
    const mockBulkResult = {
      total: 2,
      valid: 1,
      invalid: 1,
      results: [
        {
          email: 'valid@example.com',
          valid: true,
          disposable: false,
          risk_score: 'low' as const,
          deliverability_score: 95
        },
        {
          email: 'invalid@fake.com',
          valid: false,
          disposable: true,
          risk_score: 'high' as const,
          deliverability_score: 10
        }
      ]
    };

    it('should validate bulk emails successfully', async () => {
      fetchMock.mockResponseOnce(JSON.stringify(mockBulkResult));

      const emails = ['valid@example.com', 'invalid@fake.com'];
      const result = await client.validateBulk(emails);

      expect(result).toEqual(mockBulkResult);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.test.com/v1/check/bulk',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ emails })
        })
      );
    });

    it('should throw ValidationError for empty array', async () => {
      await expect(client.validateBulk([])).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for too many emails', async () => {
      const tooManyEmails = new Array(1001).fill('test@example.com');
      await expect(client.validateBulk(tooManyEmails)).rejects.toThrow(ValidationError);
    });
  });

  describe('helper methods', () => {
    const mockResult = {
      email: 'test@example.com',
      valid: true,
      disposable: false,
      risk_score: 'low' as const,
      deliverability_score: 85
    };

    beforeEach(() => {
      fetchMock.mockResponse(JSON.stringify(mockResult));
    });

    it('should check if email is disposable', async () => {
      const result = await client.isDisposable('test@example.com');
      expect(result).toBe(false);
    });

    it('should check if email is valid', async () => {
      const result = await client.isValid('test@example.com');
      expect(result).toBe(true);
    });

    it('should check if email is safe', async () => {
      const result = await client.isSafe('test@example.com');
      expect(result).toBe(true);
    });

    it('should check if email is deliverable', async () => {
      const result = await client.isDeliverable('test@example.com', 80);
      expect(result).toBe(true);
    });

    it('should get risk score', async () => {
      const result = await client.getRiskScore('test@example.com');
      expect(result).toBe('low');
    });

    it('should get deliverability score', async () => {
      const result = await client.getDeliverabilityScore('test@example.com');
      expect(result).toBe(85);
    });
  });

  describe('result helper methods', () => {
    const safeResult = {
      email: 'safe@example.com',
      valid: true,
      risk_score: 'low' as const,
      deliverability_score: 90,
      spf: 'pass' as const,
      dmarc: 'pass' as const
    };

    const riskyResult = {
      email: 'risky@example.com',
      valid: true,
      risk_score: 'high' as const,
      deliverability_score: 30,
      spf: 'fail' as const,
      dmarc: 'none' as const
    };

    it('should identify safe results', () => {
      expect(client.isResultSafe(safeResult as any)).toBe(true);
      expect(client.isResultSafe(riskyResult as any)).toBe(false);
    });

    it('should identify high risk results', () => {
      expect(client.isResultHighRisk(safeResult as any)).toBe(false);
      expect(client.isResultHighRisk(riskyResult as any)).toBe(true);
    });

    it('should check deliverability with threshold', () => {
      expect(client.isResultDeliverable(safeResult as any, 80)).toBe(true);
      expect(client.isResultDeliverable(riskyResult as any, 80)).toBe(false);
    });

    it('should check valid authentication', () => {
      expect(client.hasValidAuth(safeResult as any)).toBe(true);
      expect(client.hasValidAuth(riskyResult as any)).toBe(false);
    });
  });

  describe('getUsage', () => {
    it('should get usage information', async () => {
      const mockUsage = {
        plan: 'pro',
        used: 150,
        limit: 1000,
        remaining: 850,
        resetDate: '2024-01-31'
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockUsage));

      const result = await client.getUsage();
      
      expect(result).toEqual({
        ...mockUsage,
        percentage_used: 15
      });
    });

    it('should handle zero limit', async () => {
      const mockUsage = {
        plan: 'free',
        used: 0,
        limit: 0,
        remaining: 0,
        resetDate: '2024-01-31'
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockUsage));

      const result = await client.getUsage();
      expect(result.percentage_used).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle 401 authentication error', async () => {
      fetchMock.mockResponseOnce(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401 }
      );

      await expect(client.validate('test@example.com')).rejects.toThrow(AuthenticationError);
    });

    it('should handle 429 rate limit error', async () => {
      fetchMock.mockResponseOnce(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { 
          status: 429,
          headers: { 'Retry-After': '60' }
        }
      );

      await expect(client.validate('test@example.com')).rejects.toThrow(RateLimitError);
    });

    it('should handle 400 validation error', async () => {
      fetchMock.mockResponseOnce(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400 }
      );

      await expect(client.validate('test@example.com')).rejects.toThrow(ValidationError);
    });

    it('should handle 500 server error', async () => {
      fetchMock.mockResponseOnce(
        JSON.stringify({ error: 'Server error' }),
        { status: 500 }
      );

      await expect(client.validate('test@example.com')).rejects.toThrow(APIError);
    });

    it('should handle network error', async () => {
      fetchMock.mockRejectOnce(new TypeError('Network request failed'));

      await expect(client.validate('test@example.com')).rejects.toThrow(NetworkError);
    });

    it('should handle timeout error', async () => {
      fetchMock.mockAbortOnce();

      await expect(client.validate('test@example.com')).rejects.toThrow(TimeoutError);
    });

    it('should handle invalid JSON response', async () => {
      fetchMock.mockResponseOnce('invalid json');

      await expect(client.validate('test@example.com')).rejects.toThrow(APIError);
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      const client = new Mailchk({
        apiKey: 'test-api-key',
        retryAttempts: 2,
        retryDelay: 100
      });

      fetchMock
        .mockResponseOnce('', { status: 500 })
        .mockResponseOnce('', { status: 500 })
        .mockResponseOnce(JSON.stringify({ email: 'test@example.com', valid: true }));

      const result = await client.validate('test@example.com');
      
      expect(result.valid).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should respect retry delay from rate limit error', async () => {
      const client = new Mailchk({
        apiKey: 'test-api-key',
        retryAttempts: 1,
        retryDelay: 100
      });

      fetchMock
        .mockResponseOnce(
          JSON.stringify({ error: 'Rate limited' }),
          { 
            status: 429,
            headers: { 'Retry-After': '2' }
          }
        )
        .mockResponseOnce(JSON.stringify({ email: 'test@example.com', valid: true }));

      const startTime = Date.now();
      await client.validate('test@example.com');
      
      jest.advanceTimersByTime(2000);
      
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      fetchMock.mockResponseOnce('', { status: 401 });

      await expect(client.validate('test@example.com')).rejects.toThrow(AuthenticationError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retry attempts', async () => {
      const client = new Mailchk({
        apiKey: 'test-api-key',
        retryAttempts: 2,
        retryDelay: 100
      });

      fetchMock.mockResponse('', { status: 500 });

      await expect(client.validate('test@example.com')).rejects.toThrow(APIError);
      expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('request hooks', () => {
    it('should apply beforeRequest hook', async () => {
      const beforeRequestSpy = jest.fn((config) => ({
        ...config,
        headers: {
          ...config.headers,
          'Custom-Header': 'test-value'
        }
      }));

      client.addHook({ beforeRequest: beforeRequestSpy });

      fetchMock.mockResponseOnce(JSON.stringify({ email: 'test@example.com', valid: true }));

      await client.validate('test@example.com');

      expect(beforeRequestSpy).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'test-value'
          })
        })
      );
    });

    it('should apply afterResponse hook', async () => {
      const afterResponseSpy = jest.fn((response) => response);
      client.addHook({ afterResponse: afterResponseSpy });

      fetchMock.mockResponseOnce(JSON.stringify({ email: 'test@example.com', valid: true }));

      await client.validate('test@example.com');

      expect(afterResponseSpy).toHaveBeenCalled();
    });

    it('should apply onError hook', async () => {
      const onErrorSpy = jest.fn();
      client.addHook({ onError: onErrorSpy });

      fetchMock.mockRejectOnce(new Error('Network failure'));

      await expect(client.validate('test@example.com')).rejects.toThrow();
      expect(onErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});