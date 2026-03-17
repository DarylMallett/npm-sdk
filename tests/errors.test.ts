import {
  MailchkError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NetworkError,
  TimeoutError,
  APIError,
  UnknownError
} from '../src/index';

describe('Error Classes', () => {
  describe('AuthenticationError', () => {
    it('should create error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(MailchkError);
      expect(error.message).toBe('Invalid or missing API key');
      expect(error.code).toBe('AUTHENTICATION_FAILED');
      expect(error.statusCode).toBe(401);
      expect(error.isRetryable).toBe(false);
      expect(error.shouldReport).toBe(false);
    });

    it('should create error with custom message', () => {
      const error = new AuthenticationError('Custom auth error');
      
      expect(error.message).toBe('Custom auth error');
      expect(error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('RateLimitError', () => {
    it('should create error with default message', () => {
      const error = new RateLimitError();
      
      expect(error).toBeInstanceOf(MailchkError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.isRetryable).toBe(true);
      expect(error.shouldReport).toBe(false);
      expect(error.retryAfter).toBeUndefined();
    });

    it('should create error with retry after', () => {
      const error = new RateLimitError('Custom rate limit', 60);
      
      expect(error.message).toBe('Custom rate limit');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('ValidationError', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Invalid email format');
      
      expect(error).toBeInstanceOf(MailchkError);
      expect(error.message).toBe('Invalid email format');
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.statusCode).toBe(400);
      expect(error.isRetryable).toBe(false);
      expect(error.shouldReport).toBe(false);
    });
  });

  describe('NetworkError', () => {
    it('should create error with message', () => {
      const cause = new Error('Network unreachable');
      const error = new NetworkError('Connection failed', cause);
      
      expect(error).toBeInstanceOf(MailchkError);
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.isRetryable).toBe(true);
      expect(error.shouldReport).toBe(true);
      expect(error.cause).toBe(cause);
    });
  });

  describe('TimeoutError', () => {
    it('should create error with default message', () => {
      const error = new TimeoutError();
      
      expect(error).toBeInstanceOf(MailchkError);
      expect(error.message).toBe('Request timeout');
      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBe(408);
      expect(error.isRetryable).toBe(true);
      expect(error.shouldReport).toBe(true);
    });
  });

  describe('APIError', () => {
    it('should create error with server status code', () => {
      const error = new APIError('Server error', 500);
      
      expect(error).toBeInstanceOf(MailchkError);
      expect(error.message).toBe('Server error');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isRetryable).toBe(true);
      expect(error.shouldReport).toBe(true);
    });

    it('should create error with client status code', () => {
      const error = new APIError('Client error', 404);
      
      expect(error.isRetryable).toBe(false);
      expect(error.shouldReport).toBe(false);
    });

    it('should create error without status code', () => {
      const error = new APIError('Unknown API error');
      
      expect(error.statusCode).toBeUndefined();
      expect(error.isRetryable).toBe(false);
      expect(error.shouldReport).toBe(true);
    });
  });

  describe('UnknownError', () => {
    it('should create error with default message', () => {
      const error = new UnknownError();
      
      expect(error).toBeInstanceOf(MailchkError);
      expect(error.message).toBe('Unknown error occurred');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.shouldReport).toBe(true);
    });

    it('should create error with cause', () => {
      const cause = { unexpected: 'error' };
      const error = new UnknownError('Something went wrong', cause);
      
      expect(error.message).toBe('Something went wrong');
      expect(error.cause).toBe(cause);
    });
  });
});