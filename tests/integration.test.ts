import fetchMock from 'jest-fetch-mock';
import Mailchk, { createMailchk } from '../src/index';

describe('Integration Tests', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  describe('Real-world usage patterns', () => {
    it('should handle complete email validation workflow', async () => {
      const client = new Mailchk({ apiKey: 'test-key' });
      
      // Mock a complete validation response
      const mockResult = {
        email: 'user@company.com',
        domain: 'company.com',
        valid: true,
        disposable: false,
        scam_domain: false,
        mx_exists: true,
        mx_records: [
          { exchange: 'mail.company.com', priority: 10 }
        ],
        blacklisted_mx: false,
        free_email: false,
        did_you_mean: '',
        risk_score: 'low' as const,
        risk_factors: [],
        reason: null,
        email_provider: 'Company Corp',
        deliverability_score: 95,
        spf: 'pass' as const,
        dmarc: 'pass' as const,
        normalized_email: 'user@company.com',
        is_aliased: false,
        alias_type: null
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResult));

      const result = await client.validate('user@company.com');

      // Validate all fields are present
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('disposable');
      expect(result).toHaveProperty('deliverability_score');
      expect(result).toHaveProperty('risk_score');
      expect(result).toHaveProperty('mx_records');

      // Test helper methods
      expect(client.isResultSafe(result)).toBe(true);
      expect(client.isResultDeliverable(result, 90)).toBe(true);
      expect(client.hasValidAuth(result)).toBe(true);
    });

    it('should handle signup validation flow', async () => {
      const client = createMailchk({ apiKey: 'test-key' });

      const signupEmails = [
        'user@gmail.com',      // Valid personal email
        'temp@10minutemail.com', // Disposable email
        'user@company.com'     // Valid business email
      ];

      const mockBulkResult = {
        total: 3,
        valid: 2,
        invalid: 1,
        results: [
          {
            email: 'user@gmail.com',
            valid: true,
            disposable: false,
            free_email: true,
            risk_score: 'low' as const,
            deliverability_score: 90
          },
          {
            email: 'temp@10minutemail.com',
            valid: true,
            disposable: true,
            free_email: false,
            risk_score: 'high' as const,
            deliverability_score: 60
          },
          {
            email: 'user@company.com',
            valid: true,
            disposable: false,
            free_email: false,
            risk_score: 'low' as const,
            deliverability_score: 95
          }
        ]
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockBulkResult));

      const results = await client.validateBulk(signupEmails);

      // Validate business logic
      const safeEmails = results.results.filter(r => client.isResultSafe(r));
      const disposableEmails = results.results.filter(r => r.disposable);
      const businessEmails = results.results.filter(r => !r.free_email && !r.disposable);

      expect(safeEmails).toHaveLength(2);
      expect(disposableEmails).toHaveLength(1);
      expect(businessEmails).toHaveLength(1);
    });

    it('should handle typo correction workflow', async () => {
      const client = new Mailchk({ apiKey: 'test-key' });

      const mockResult = {
        email: 'user@gmial.com',
        valid: false,
        did_you_mean: 'user@gmail.com',
        reason: 'Domain not found',
        deliverability_score: 0
      };

      fetchMock.mockResponseOnce(JSON.stringify(mockResult));

      const result = await client.validate('user@gmial.com');

      expect(result.valid).toBe(false);
      expect(result.did_you_mean).toBe('user@gmail.com');
      expect(result.reason).toBe('Domain not found');
    });

    it('should handle enterprise business rules', async () => {
      const client = new Mailchk({ apiKey: 'test-key' });

      const testCases = [
        {
          email: 'user@company.com',
          result: {
            valid: true,
            disposable: false,
            free_email: false,
            deliverability_score: 95,
            risk_score: 'low' as const,
            spf: 'pass' as const,
            dmarc: 'pass' as const
          },
          shouldAccept: true,
          reason: 'Valid business email'
        },
        {
          email: 'user@gmail.com',
          result: {
            valid: true,
            disposable: false,
            free_email: true,
            deliverability_score: 85,
            risk_score: 'medium' as const
          },
          shouldAccept: false,
          reason: 'Free email provider'
        },
        {
          email: 'temp@tempmail.com',
          result: {
            valid: true,
            disposable: true,
            free_email: false,
            deliverability_score: 70,
            risk_score: 'high' as const
          },
          shouldAccept: false,
          reason: 'Disposable email'
        }
      ];

      for (const testCase of testCases) {
        fetchMock.mockResponseOnce(JSON.stringify(testCase.result));

        const result = await client.validate(testCase.email);

        // Enterprise business rules
        const isAcceptable = result.valid &&
          !result.disposable &&
          !result.free_email &&
          result.deliverability_score >= 80 &&
          !client.isResultHighRisk(result);

        expect(isAcceptable).toBe(testCase.shouldAccept);
      }
    });
  });

  describe('Error recovery patterns', () => {
    it('should handle temporary network issues with retry', async () => {
      const client = new Mailchk({
        apiKey: 'test-key',
        retryAttempts: 2,
        retryDelay: 10
      });

      // Simulate temporary network failure followed by success
      fetchMock
        .mockRejectOnce(new TypeError('Network request failed'))
        .mockResponseOnce(JSON.stringify({
          email: 'user@example.com',
          valid: true,
          deliverability_score: 90
        }));

      const result = await client.validate('user@example.com');
      
      expect(result.valid).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiting gracefully', async () => {
      const client = new Mailchk({
        apiKey: 'test-key',
        retryAttempts: 1,
        retryDelay: 10
      });

      // Simulate rate limit followed by success
      fetchMock
        .mockResponseOnce(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { 
            status: 429,
            headers: { 'Retry-After': '1' }
          }
        )
        .mockResponseOnce(JSON.stringify({
          email: 'user@example.com',
          valid: true
        }));

      const result = await client.validate('user@example.com');
      
      expect(result.valid).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration patterns', () => {
    it('should work with environment configuration', () => {
      process.env.MAILCHK_API_KEY = 'env-test-key';
      process.env.MAILCHK_BASE_URL = 'https://custom-api.com/v1';

      const client = Mailchk.fromEnvironment();
      expect(client).toBeInstanceOf(Mailchk);
    });

    it('should work with builder pattern', () => {
      const client = Mailchk.build(builder => 
        builder
          .setApiKey('builder-test-key')
          .setTimeout(10000)
          .setRetryAttempts(5)
      );

      expect(client).toBeInstanceOf(Mailchk);
    });

    it('should allow custom request hooks', async () => {
      const client = new Mailchk({ apiKey: 'test-key' });
      
      const requestLog: string[] = [];
      
      client.addHook({
        beforeRequest: (config) => {
          requestLog.push('before-request');
          return config;
        },
        afterResponse: (response) => {
          requestLog.push('after-response');
          return response;
        },
        onError: (error) => {
          requestLog.push('on-error');
        }
      });

      fetchMock.mockResponseOnce(JSON.stringify({
        email: 'test@example.com',
        valid: true
      }));

      await client.validate('test@example.com');

      expect(requestLog).toEqual(['before-request', 'after-response']);
    });
  });
});