// Integration test setup
// This file runs before all integration tests

// Mock environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.VITE_ENVIRONMENT = 'test';

// Set up any global mocks or configurations needed for integration tests
(global as any).ResizeObserver = class ResizeObserver {
  constructor(cb: any) {
    this.cb = cb;
  }
  cb: any;
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver if needed
(global as any).IntersectionObserver = class IntersectionObserver {
  constructor(cb: any) {
    this.cb = cb;
  }
  cb: any;
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords() { return []; }
};

console.log('Integration test setup completed'); 