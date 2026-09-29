import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Override from the command line:
//   k6 run -e BASE_URL=http://localhost:5000 load-test.js
const BASE_URL =
  __ENV.BASE_URL || 'https://amfaye-bites-web-base-system-1.onrender.com';

// Separate counters so rate limiting is not confused with real failures.
const rateLimited = new Counter('rate_limited_429');
const serverErrors = new Counter('server_errors_5xx');

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 30 },
    { duration: '20s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  // The run fails automatically if any of these are broken.
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    'http_req_duration{endpoint:products}': ['p(95)<1000'],
    rate_limited_429: ['count==0'],
    server_errors_5xx: ['count==0'],
  },
};

// Module-level variables are per-VU in k6, so each VU logs a
// problem at most once instead of hundreds of times.
let loggedProblem = false;

function hit(name, path) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { endpoint: name } });

  check(res, {
    [`${name} status is 200`]: (r) => r.status === 200,
  });

  if (res.status === 429) {
    rateLimited.add(1);
  } else if (res.status >= 500) {
    serverErrors.add(1);
  }

  if (res.status !== 200 && !loggedProblem) {
    loggedProblem = true;
    console.log(`${name.toUpperCase()} FAILED: ${res.status} - ${res.body}`);
  }

  return res;
}

export default function () {
  hit('health', '/api/health');
  hit('products', '/api/products');

  // Random 1-3s think time, closer to how real users behave.
  sleep(1 + Math.random() * 2);
}