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
};

export default function () {
    const health = http.get(`${BASE_URL}/api/health`);

    check(health, {
        'health status is 200': (r) => r.status === 200,
    });

    if (health.status !== 200) {
        console.log(`HEALTH FAILED: ${health.status} - ${health.body}`);
    }

    const products = http.get(`${BASE_URL}/api/products`);

    check(products, {
        'products status is 200': (r) => r.status === 200,
    });

    if (products.status !== 200) {
        console.log(`PRODUCTS FAILED: ${products.status} - ${products.body}`);
    }

    sleep(1);
}