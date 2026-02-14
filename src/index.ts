/**
 * Mailchk - Email Validation SDK
 * Official Node.js/TypeScript SDK for the Mailchk API
 * https://mailchk.io
 */

export interface MailchkConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
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

class MailchkError extends Error {
  public code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'MailchkError';
    this.code = code;
  }
}

class Mailchk {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: MailchkConfig) {
    if (!config.apiKey) {
      throw new MailchkError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.mailchk.io/v1';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Validate a single email address
   * @param email - Email address to validate
   * @returns Validation result
   */
  async validate(email: string): Promise<ValidationResult> {
    if (!email || typeof email !== 'string') {
      throw new MailchkError('Email address is required');
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
      throw new MailchkError('At least one email address is required');
    }

    if (emails.length > 1000) {
      throw new MailchkError('Maximum 1000 emails per bulk request');
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
  async getUsage(): Promise<{
    plan: string;
    used: number;
    limit: number;
    remaining: number;
    resetDate: string;
  }> {
    return this.request('/usage');
  }

  private async request<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'mailchk-node/1.1.0'
        },
        body: params ? JSON.stringify(params) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json() as ApiResult<T>;

      if (!response.ok || !data.success) {
        const errorData = data as ApiError;
        throw new MailchkError(
          errorData.error || `HTTP error ${response.status}`,
          errorData.code
        );
      }

      return (data as ApiResponse<T>).data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MailchkError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new MailchkError('Request timeout', 'TIMEOUT');
        }
        throw new MailchkError(error.message);
      }

      throw new MailchkError('Unknown error occurred');
    }
  }
}

// Factory function for creating instances
export function createMailchk(config: MailchkConfig): Mailchk {
  return new Mailchk(config);
}

// Default export
export default Mailchk;

// Named exports
export { Mailchk, MailchkError };
