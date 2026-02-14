# Mailchk

Official Node.js/TypeScript SDK for the [Mailchk](https://mailchk.io) email validation API.

Detect disposable emails, verify MX records, check SPF/DMARC, detect aliasing, and protect your platform from fake signups.

## Installation

```bash
npm install mailchk
```

```bash
yarn add mailchk
```

```bash
pnpm add mailchk
```

## Quick Start

```typescript
import Mailchk from 'mailchk';

const mailchk = new Mailchk({
  apiKey: 'your-api-key'
});

// Validate an email
const result = await mailchk.validate('user@example.com');

console.log(result);
// {
//   email: 'user@example.com',
//   domain: 'example.com',
//   valid: true,
//   disposable: false,
//   scam_domain: false,
//   mx_exists: true,
//   blacklisted_mx: false,
//   free_email: false,
//   risk_score: 'low',
//   risk_factors: [],
//   deliverability_score: 95,
//   spf: 'pass',
//   dmarc: 'pass',
//   email_provider: null,
//   normalized_email: 'user@example.com',
//   is_aliased: false,
//   alias_type: null,
//   did_you_mean: '',
//   ...
// }
```

## Usage

### Initialize the Client

```typescript
import Mailchk from 'mailchk';

const mailchk = new Mailchk({
  apiKey: 'your-api-key',
  // Optional settings
  baseUrl: 'https://api.mailchk.io/v1', // Default
  timeout: 30000 // 30 seconds (default)
});
```

### Validate a Single Email

```typescript
const result = await mailchk.validate('test@tempmail.com');

if (!result.valid) {
  console.log('Invalid email:', result.risk_factors);
}

if (result.disposable) {
  console.log('Disposable email detected!');
}

if (result.scam_domain) {
  console.log('Scam domain detected!');
}

// Check deliverability
console.log(`Deliverability: ${result.deliverability_score}/100`);

// Check authentication
console.log(`SPF: ${result.spf}, DMARC: ${result.dmarc}`);

// Check for aliasing (e.g. user+tag@gmail.com)
if (result.is_aliased) {
  console.log(`Alias detected (${result.alias_type}): normalized to ${result.normalized_email}`);
}

// Did-you-mean suggestion for typos
if (result.did_you_mean) {
  console.log(`Did you mean: ${result.did_you_mean}?`);
}
```

### Bulk Validation

Validate up to 1,000 emails in a single request:

```typescript
const emails = [
  'user1@example.com',
  'user2@tempmail.com',
  'user3@gmail.com'
];

const results = await mailchk.validateBulk(emails);

console.log(`Valid: ${results.valid}/${results.total}`);

results.results.forEach(result => {
  console.log(`${result.email}: ${result.valid ? 'Valid' : 'Invalid'} (${result.risk_score})`);
});
```

### Quick Checks

```typescript
// Check if email is disposable
const isDisposable = await mailchk.isDisposable('test@tempmail.com');
// true

// Check if email is valid
const isValid = await mailchk.isValid('user@example.com');
// true

// Get risk score
const risk = await mailchk.getRiskScore('user@example.com');
// 'low', 'medium', 'high', or 'critical'

// Get deliverability score
const score = await mailchk.getDeliverabilityScore('user@example.com');
// 0-100
```

### Check Account Usage

```typescript
const usage = await mailchk.getUsage();

console.log(`${usage.remaining} validations remaining`);
console.log(`Resets on ${usage.resetDate}`);
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | The validated email address |
| `domain` | string | Domain part of the email |
| `valid` | boolean | Overall validity of the email |
| `disposable` | boolean | True if using a disposable/temporary email provider |
| `scam_domain` | boolean | True if the domain is flagged as scam or phishing |
| `mx_exists` | boolean | True if domain has valid MX records |
| `mx_records` | MxRecord[] | List of MX records (when available) |
| `blacklisted_mx` | boolean | True if MX server IPs are on a DNSBL blacklist |
| `free_email` | boolean | True if using a free email provider (Gmail, Yahoo, etc.) |
| `did_you_mean` | string | Suggested correction for domain typos (empty if none) |
| `risk_score` | string | Risk level: `'low'`, `'medium'`, `'high'`, `'critical'` |
| `risk_factors` | string[] | List of factors contributing to the risk score |
| `reason` | string | Human-readable explanation (when applicable) |
| `email_provider` | string \| null | Detected email provider name (e.g. "Gmail", "Outlook") |
| `deliverability_score` | number | Deliverability likelihood score (0-100) |
| `spf` | string | SPF authentication result: `'pass'`, `'fail'`, `'none'` |
| `dmarc` | string | DMARC policy result: `'pass'`, `'fail'`, `'none'` |
| `normalized_email` | string | Email after provider-specific normalization |
| `is_aliased` | boolean | True if the email uses aliasing (plus addressing, dot tricks, etc.) |
| `alias_type` | string \| null | Type of alias: `'plus_addressing'`, `'dot_variation'`, `'subdomain_addressing'`, `'provider_alias'` |

## Error Handling

```typescript
import Mailchk, { MailchkError } from 'mailchk';

try {
  const result = await mailchk.validate('invalid');
} catch (error) {
  if (error instanceof MailchkError) {
    console.error('Mailchk error:', error.message);
    console.error('Error code:', error.code);
  }
}
```

## TypeScript Support

This package includes full TypeScript definitions:

```typescript
import Mailchk, {
  ValidationResult,
  BulkValidationResult,
  MxRecord,
  MailchkConfig
} from 'mailchk';
```

## Requirements

- Node.js 16.0.0 or higher
- Valid Mailchk API key ([Get one free](https://mailchk.io))

## Links

- [Documentation](https://mailchk.io/docs)
- [API Reference](https://mailchk.io/docs/api)
- [Dashboard](https://mailchk.io/dashboard)
- [Support](mailto:support@mailchk.io)

## License

MIT
