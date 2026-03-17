import { MailchkConfigBuilder, AuthenticationError } from '../src/index';

describe('MailchkConfigBuilder', () => {
  describe('create', () => {
    it('should create new builder instance', () => {
      const builder = MailchkConfigBuilder.create();
      expect(builder).toBeInstanceOf(MailchkConfigBuilder);
    });
  });

  describe('fromEnvironment', () => {
    it('should create config from environment variables', () => {
      process.env.MAILCHK_API_KEY = 'test-api-key';
      process.env.MAILCHK_BASE_URL = 'https://custom.api.com';
      process.env.MAILCHK_TIMEOUT = '5000';
      process.env.MAILCHK_RETRY_ATTEMPTS = '5';
      process.env.MAILCHK_RETRY_DELAY = '2000';

      const config = MailchkConfigBuilder.fromEnvironment();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.api.com',
        timeout: 5000,
        retryAttempts: 5,
        retryDelay: 2000
      });
    });

    it('should create config with minimal environment variables', () => {
      process.env.MAILCHK_API_KEY = 'test-api-key';

      const config = MailchkConfigBuilder.fromEnvironment();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        baseUrl: undefined,
        timeout: undefined,
        retryAttempts: undefined,
        retryDelay: undefined
      });
    });

    it('should throw error when API key is missing', () => {
      expect(() => {
        MailchkConfigBuilder.fromEnvironment();
      }).toThrow(AuthenticationError);

      expect(() => {
        MailchkConfigBuilder.fromEnvironment();
      }).toThrow('MAILCHK_API_KEY environment variable is required');
    });

    it('should handle invalid numeric environment variables', () => {
      process.env.MAILCHK_API_KEY = 'test-api-key';
      process.env.MAILCHK_TIMEOUT = 'invalid';
      process.env.MAILCHK_RETRY_ATTEMPTS = 'not-a-number';

      const config = MailchkConfigBuilder.fromEnvironment();

      expect(config.timeout).toBeNaN();
      expect(config.retryAttempts).toBeNaN();
    });
  });

  describe('builder pattern', () => {
    it('should build config with all options', () => {
      const config = MailchkConfigBuilder.create()
        .setApiKey('test-api-key')
        .setBaseUrl('https://custom.api.com')
        .setTimeout(5000)
        .setRetryAttempts(5)
        .setRetryDelay(2000)
        .build();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.api.com',
        timeout: 5000,
        retryAttempts: 5,
        retryDelay: 2000
      });
    });

    it('should build config with defaults', () => {
      const config = MailchkConfigBuilder.create()
        .setApiKey('test-api-key')
        .build();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.mailchk.io/v1',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      });
    });

    it('should throw error when building without API key', () => {
      expect(() => {
        MailchkConfigBuilder.create().build();
      }).toThrow(AuthenticationError);

      expect(() => {
        MailchkConfigBuilder.create().build();
      }).toThrow('API key is required');
    });

    it('should allow method chaining', () => {
      const builder = MailchkConfigBuilder.create();
      const result = builder
        .setApiKey('test')
        .setBaseUrl('https://test.com')
        .setTimeout(1000);

      expect(result).toBe(builder);
    });
  });
});