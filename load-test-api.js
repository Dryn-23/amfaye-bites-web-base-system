import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'https://amfaye-bites-web-base-system-1.onrender.com';

export const options = {
    stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 30 },
        { duration: '20s', target: 50 },
        { duration: '20s', target: 100 },
        { duration: '10s', target: 0 },
    ],

    thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<3000'],
    },
};

export default function () {
    // Health check
    const health = http.get(`${BASE_URL}/api/health`);

    check(health, {
        'health status is 200': (r) => r.status === 200,
        'database is connected': (r) =>
            r.body.includes('"success":true'),
    });

    // Product API
    const products = http.get(`${BASE_URL}/api/products`);

    check(products, {
        'products status is 200': (r) => r.status === 200,
        'products returned data': (r) => r.body.length > 0,
    });

    sleep(1);
}