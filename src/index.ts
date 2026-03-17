/**
 * Mailchk - Email Validation SDK
 * Official Node.js/TypeScript SDK for the Mailchk API
 * https://mailchk.io
 */

export interface MailchkConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface RequestHook {
  beforeRequest?: (config: RequestInit) => RequestInit | Promise<RequestInit>;
  afterResponse?: (response: Response) => Response | Promise<Response>;
  onError?: (error: Error) => void;
}

export interface ValidationResult {
  email: string;
  domain: string;
  valid: boolean;
  disposable: boolean;
  scam_domain: boolean;
  mx_exists: boolean;
  mx_records?: MxRecord[];
  blacklisted_mx: boolean;
  free_email: boolean;
  did_you_mean: string;
  risk_score: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
  reason?: string;
  email_provider: string | null;
  deliverability_score: number;
  spf: 'pass' | 'fail' | 'none';
  dmarc: 'pass' | 'fail' | 'none';
  normalized_email: string;
  is_aliased: boolean;
  alias_type: 'plus_addressing' | 'dot_variation' | 'subdomain_addressing' | 'provider_alias' | null;
}

export interface UsageInfo {
  plan: string;
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  percentage_used: number;
}

export interface MxRecord {
  exchange: string;
  priority: number;
}

export interface BulkValidationResult {
  total: number;
  valid: number;
  invalid: number;
  results: ValidationResult[];
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

type ApiResult<T> = ApiResponse<T> | ApiError;

export abstract class MailchkError extends Error {
  public code?: string;
  public statusCode?: number;
  public isRetryable: boolean = false;
  public retryAfter?: number;

  constructor(message: string, code?: string, statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }

  abstract get shouldReport(): boolean;
}

export class AuthenticationError extends MailchkError {
  constructor(message: string = 'Invalid or missing API key') {
    super(message, 'AUTHENTICATION_FAILED', 401);
  }

  get shouldReport(): boolean {
    return false;
  }
}

export class RateLimitError extends MailchkError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.isRetryable = true;
    this.retryAfter = retryAfter;
  }

  get shouldReport(): boolean {
    return false;
  }
}

export class ValidationError extends MailchkError {
  constructor(message: string) {
    super(message, 'VALIDATION_FAILED', 400);
  }

  get shouldReport(): boolean {
    return false;
  }
}

export class NetworkError extends MailchkError {
  constructor(message: string, public cause?: Error) {
    super(message, 'NETWORK_ERROR');
    this.isRetryable = true;
  }

  get shouldReport(): boolean {
    return true;
  }
}

export class TimeoutError extends MailchkError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT', 408);
    this.isRetryable = true;
  }

  get shouldReport(): boolean {
    return true;
  }
}

export class APIError extends MailchkError {
  constructor(message: string, statusCode?: number) {
    super(message, 'API_ERROR', statusCode);
    this.isRetryable = statusCode ? statusCode >= 500 : false;
  }

  get shouldReport(): boolean {
    return this.statusCode ? this.statusCode >= 500 : true;
  }
}

export class UnknownError extends MailchkError {
  constructor(message: string = 'Unknown error occurred', public cause?: unknown) {
    super(message, 'UNKNOWN_ERROR');
  }

  get shouldReport(): boolean {
    return true;
  }
}

export class MailchkConfigBuilder {
  private config: Partial<MailchkConfig> = {};

  static create(): MailchkConfigBuilder {
    return new MailchkConfigBuilder();
  }

  static fromEnvironment(): MailchkConfig {
    const apiKey = process.env.MAILCHK_API_KEY;
    if (!apiKey) {
      throw new AuthenticationError('MAILCHK_API_KEY environment variable is required');
    }

    return {
      apiKey,
      baseUrl: process.env.MAILCHK_BASE_URL,
      timeout: process.env.MAILCHK_TIMEOUT ? parseInt(process.env.MAILCHK_TIMEOUT) : undefined,
      retryAttempts: process.env.MAILCHK_RETRY_ATTEMPTS ? parseInt(process.env.MAILCHK_RETRY_ATTEMPTS) : undefined,
      retryDelay: process.env.MAILCHK_RETRY_DELAY ? parseInt(process.env.MAILCHK_RETRY_DELAY) : undefined,
    };
  }

  setApiKey(apiKey: string): this {
    this.config.apiKey = apiKey;
    return this;
  }

  setBaseUrl(baseUrl: string): this {
    this.config.baseUrl = baseUrl;
    return this;
  }

  setTimeout(timeout: number): this {
    this.config.timeout = timeout;
    return this;
  }

  setRetryAttempts(attempts: number): this {
    this.config.retryAttempts = attempts;
    return this;
  }

  setRetryDelay(delay: number): this {
    this.config.retryDelay = delay;
    return this;
  }

  build(): MailchkConfig {
    if (!this.config.apiKey) {
      throw new AuthenticationError('API key is required');
    }

    return {
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl || 'https://api.mailchk.io/v1',
      timeout: this.config.timeout || 30000,
      retryAttempts: this.config.retryAttempts || 3,
      retryDelay: this.config.retryDelay || 1000,
    };
  }
}

class Mailchk {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private hooks: RequestHook = {};

  constructor(config: MailchkConfig) {
    if (!config.apiKey) {
      throw new AuthenticationError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.mailchk.io/v1';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  static fromEnvironment(): Mailchk {
    return new Mailchk(MailchkConfigBuilder.fromEnvironment());
  }

  static build(builderFn: (builder: MailchkConfigBuilder) => MailchkConfigBuilder): Mailchk {
    const builder = MailchkConfigBuilder.create();
    const config = builderFn(builder).build();
    return new Mailchk(config);
  }

  addHook(hook: RequestHook): void {
    this.hooks = { ...this.hooks, ...hook };
  }

  /**
   * Validate a single email address
   * @param email - Email address to validate
   * @returns Validation result
   */
  async validate(email: string): Promise<ValidationResult> {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email address is required');
    }

    const response = await this.request<ValidationResult>('/check', {
      email: email.trim().toLowerCase()
    });

    return response;
  }

  /**
   * Validate multiple email addresses in bulk
   * @param emails - Array of email addresses to validate
   * @returns Bulk validation results
   */
  async validateBulk(emails: string[]): Promise<BulkValidationResult> {
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new ValidationError('At least one email address is required');
    }

    if (emails.length > 1000) {
      throw new ValidationError('Maximum 1000 emails per bulk request');
    }

    const cleanedEmails = emails.map(e => e.trim().toLowerCase());

    const response = await this.request<BulkValidationResult>('/check/bulk', {
      emails: cleanedEmails
    });

    return response;
  }

  /**
   * Check if an email is disposable/temporary
   * @param email - Email address to check
   * @returns True if disposable, false otherwise
   */
  async isDisposable(email: string): Promise<boolean> {
    const result = await this.validate(email);
    return result.disposable;
  }

  /**
   * Check if an email is valid
   * @param email - Email address to check
   * @returns True if valid, false otherwise
   */
  async isValid(email: string): Promise<boolean> {
    const result = await this.validate(email);
    return result.valid;
  }

  /**
   * Get the risk score for an email address
   * @param email - Email address to check
   * @returns Risk score: 'low', 'medium', 'high', or 'critical'
   */
  async getRiskScore(email: string): Promise<string> {
    const result = await this.validate(email);
    return result.risk_score;
  }

  /**
   * Get the deliverability score for an email address
   * @param email - Email address to check
   * @returns Deliverability score (0-100)
   */
  async getDeliverabilityScore(email: string): Promise<number> {
    const result = await this.validate(email);
    return result.deliverability_score;
  }

  /**
   * Get account usage and quota information
   * @returns Account usage stats
   */
  async getUsage(): Promise<UsageInfo> {
    const data = await this.request<UsageInfo>('/usage');
    return {
      ...data,
      percentage_used: data.limit > 0 ? (data.used / data.limit) * 100 : 0
    };
  }

  /**
   * Check if an email is safe to use (valid and low/medium risk)
   * @param email - Email address to check
   * @returns True if safe, false otherwise
   */
  async isSafe(email: string): Promise<boolean> {
    const result = await this.validate(email);
    return this.isResultSafe(result);
  }

  /**
   * Check if an email meets deliverability threshold
   * @param email - Email address to check
   * @param threshold - Minimum deliverability score (default: 50)
   * @returns True if deliverable, false otherwise
   */
  async isDeliverable(email: string, threshold: number = 50): Promise<boolean> {
    const result = await this.validate(email);
    return result.deliverability_score >= threshold;
  }

  /**
   * Check if validation result is safe to use
   * @param result - Validation result
   * @returns True if safe, false otherwise
   */
  isResultSafe(result: ValidationResult): boolean {
    return result.valid && !this.isResultHighRisk(result);
  }

  /**
   * Check if validation result has high risk
   * @param result - Validation result
   * @returns True if high risk, false otherwise
   */
  isResultHighRisk(result: ValidationResult): boolean {
    return result.risk_score === 'high' || result.risk_score === 'critical';
  }

  /**
   * Check if validation result is deliverable
   * @param result - Validation result
   * @param threshold - Minimum deliverability score (default: 50)
   * @returns True if deliverable, false otherwise
   */
  isResultDeliverable(result: ValidationResult, threshold: number = 50): boolean {
    return result.deliverability_score >= threshold;
  }

  /**
   * Check if validation result has valid authentication (SPF and DMARC)
   * @param result - Validation result
   * @returns True if has valid auth, false otherwise
   */
  hasValidAuth(result: ValidationResult): boolean {
    return result.spf === 'pass' && result.dmarc === 'pass';
  }

  private async request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    return this.requestWithRetry(endpoint, params, this.retryAttempts);
  }

  private async requestWithRetry<T>(endpoint: string, params: Record<string, unknown> | undefined, attemptsLeft: number): Promise<T> {
    try {
      return await this.makeRequest<T>(endpoint, params);
    } catch (error) {
      if (attemptsLeft > 0 && error instanceof MailchkError && error.isRetryable) {
        const delay = error instanceof RateLimitError && error.retryAfter 
          ? error.retryAfter * 1000 
          : this.retryDelay * (this.retryAttempts - attemptsLeft + 1);
        
        await this.sleep(delay);
        return this.requestWithRetry(endpoint, params, attemptsLeft - 1);
      }
      throw error;
    }
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let requestConfig: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'User-Agent': 'mailchk-node/1.2.0'
      },
      body: params ? JSON.stringify(params) : undefined,
      signal: controller.signal
    };

    try {
      if (this.hooks.beforeRequest) {
        requestConfig = await this.hooks.beforeRequest(requestConfig);
      }

      let response = await fetch(url, requestConfig);
      
      if (this.hooks.afterResponse) {
        response = await this.hooks.afterResponse(response);
      }

      clearTimeout(timeoutId);
      return await this.handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (this.hooks.onError) {
        this.hooks.onError(error as Error);
      }

      if (error instanceof MailchkError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError('Request timeout');
        }
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new NetworkError('Network connection failed', error);
        }
        throw new UnknownError(error.message, error);
      }

      throw new UnknownError('Unknown error occurred', error);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    let data: any;
    
    try {
      data = await response.json();
    } catch (error) {
      throw new APIError('Invalid JSON response', response.status);
    }

    if (response.status === 401) {
      throw new AuthenticationError(data?.error || 'Invalid API key');
    }
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(
        data?.error || 'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter) : undefined
      );
    }
    
    if (response.status === 400) {
      throw new ValidationError(data?.error || 'Invalid request');
    }
    
    if (response.status >= 500) {
      throw new APIError(
        data?.error || `Server error: ${response.status}`,
        response.status
      );
    }
    
    if (!response.ok) {
      throw new APIError(
        data?.error || `HTTP error: ${response.status}`,
        response.status
      );
    }

    if (data && typeof data === 'object' && 'success' in data) {
      if (!data.success) {
        throw new APIError(data.error || 'Request failed');
      }
      return data.data;
    }

    return data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for creating instances
export function createMailchk(config: MailchkConfig): Mailchk {
  return new Mailchk(config);
}

// Default export
export default Mailchk;

// Named export for Mailchk (not exported at declaration)
export { Mailchk };
