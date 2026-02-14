# Mailchk

Official Node.js/TypeScript SDK for the [Mailchk](https://mailchk.io) email validation API.

Detect disposable emails, verify MX records, and protect your platform from fake signups.

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
//   valid: true,
//   disposable: false,
//   catchAll: false,
//   freeProvider: false,
//   roleAccount: false,
//   mxExists: true,
//   riskScore: 'low',
//   riskFactors: [],
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
  console.log('Invalid email:', result.riskFactors);
}

if (result.disposable) {
  console.log('Disposable email detected!');
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
  console.log(`${result.email}: ${result.valid ? 'Valid' : 'Invalid'}`);
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
```

### Check MX Records

```typescript
const mxRecords = await mailchk.checkMx('example.com');

console.log(mxRecords);
// [
//   { exchange: 'mx1.example.com', priority: 10 },
//   { exchange: 'mx2.example.com', priority: 20 }
// ]
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
| `email` | string | The email address that was validated |
| `valid` | boolean | Overall validity (syntax, MX, not disposable) |
| `disposable` | boolean | True if using a disposable/temporary email provider |
| `catchAll` | boolean | True if domain accepts all email addresses |
| `freeProvider` | boolean | True if using a free email provider (Gmail, Yahoo, etc.) |
| `roleAccount` | boolean | True if role-based email (info@, admin@, etc.) |
| `mxExists` | boolean | True if domain has valid MX records |
| `mxRecords` | array | List of MX records for the domain |
| `riskScore` | string | Risk level: 'low', 'medium', 'high', 'critical' |
| `riskFactors` | array | List of factors contributing to the risk score |
| `syntaxValid` | boolean | True if email syntax is valid |
| `domain` | string | Domain part of the email |
| `localPart` | string | Local part of the email (before @) |

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
