import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();

beforeEach(() => {
  fetchMock.resetMocks();
  
  // Reset environment variables
  delete process.env.MAILCHK_API_KEY;
  delete process.env.MAILCHK_BASE_URL;
  delete process.env.MAILCHK_TIMEOUT;
  delete process.env.MAILCHK_RETRY_ATTEMPTS;
  delete process.env.MAILCHK_RETRY_DELAY;
});

// Mock timers for consistent testing
jest.useFakeTimers();