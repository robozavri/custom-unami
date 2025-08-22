/* eslint-disable no-console */
// This file contains all the constants and data structures needed for realistic user activity simulation
// It can be imported by other seed files to ensure consistency across all test data generation

// Realistic user agents for different devices and browsers
const USER_AGENTS = {
  desktop: {
    chrome: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ],
    firefox: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13.5; rv:124.0) Gecko/20100101 Firefox/124.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
    ],
    safari: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ],
    edge: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124.0.0.0 Chrome/124.0.0.0 Safari/537.36',
    ],
  },
  mobile: {
    safari: [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    ],
    chrome: [
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; OnePlus 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    ],
    samsung: [
      'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    ],
  },
  tablet: {
    safari: [
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ],
    chrome: [
      'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ],
  },
};

// Device configurations
const DEVICES = {
  desktop: {
    screen: ['1920x1080', '1536x864', '1440x900', '1366x768', '1280x720'],
    os: ['Windows', 'macOS', 'Linux'],
  },
  mobile: {
    screen: ['390x844', '375x812', '412x915', '360x800', '414x896'],
    os: ['iOS', 'Android'],
  },
  tablet: {
    screen: ['768x1024', '810x1080', '820x1180', '834x1194'],
    os: ['iOS', 'Android'],
  },
};

// Countries with realistic data
const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    region: 'CA',
    city: 'San Francisco',
    timezone: 'America/Los_Angeles',
  },
  { code: 'DE', name: 'Germany', region: 'BY', city: 'Berlin', timezone: 'Europe/Berlin' },
  { code: 'GB', name: 'United Kingdom', region: 'EN', city: 'London', timezone: 'Europe/London' },
  { code: 'FR', name: 'France', region: 'IDF', city: 'Paris', timezone: 'Europe/Paris' },
  { code: 'CA', name: 'Canada', region: 'ON', city: 'Toronto', timezone: 'America/Toronto' },
  { code: 'AU', name: 'Australia', region: 'NSW', city: 'Sydney', timezone: 'Australia/Sydney' },
  { code: 'JP', name: 'Japan', region: '13', city: 'Tokyo', timezone: 'Asia/Tokyo' },
  { code: 'BR', name: 'Brazil', region: 'SP', city: 'São Paulo', timezone: 'America/Sao_Paulo' },
  { code: 'IN', name: 'India', region: 'MH', city: 'Mumbai', timezone: 'Asia/Kolkata' },
  {
    code: 'NL',
    name: 'Netherlands',
    region: 'NH',
    city: 'Amsterdam',
    timezone: 'Europe/Amsterdam',
  },
  { code: 'IT', name: 'Italy', region: 'RM', city: 'Rome', timezone: 'Europe/Rome' },
  { code: 'ES', name: 'Spain', region: 'MD', city: 'Madrid', timezone: 'Europe/Madrid' },
  { code: 'SE', name: 'Sweden', region: 'AB', city: 'Stockholm', timezone: 'Europe/Stockholm' },
  { code: 'NO', name: 'Norway', region: 'OS', city: 'Oslo', timezone: 'Europe/Oslo' },
  { code: 'DK', name: 'Denmark', region: '84', city: 'Copenhagen', timezone: 'Europe/Copenhagen' },
];

// Page paths to visit
const PATHS = [
  '/faqs',
  '/features',
  '/home',
  '/integrations',
  '/pricing',
  '/about',
  '/contact',
  '/blog',
  '/demo',
  '/support',
  '/api',
  '/docs',
  '/tutorials',
  '/case-studies',
  '/team',
];

// Business events
const BUSINESS_EVENTS = [
  'Start Free Trial',
  'Watch Demo',
  'Select Basic Plan',
  'Select Pro Plan',
  'Select Enterprise Plan',
  'Request Integration',
  'Contact Support',
  'Download Whitepaper',
  'Subscribe Newsletter',
  'Request Quote',
  'Purchase',
  'Add to Cart',
  'View Product',
  'Signup',
  'Upgrade Plan',
];

// UTM parameters for realistic traffic sources
const UTM_SOURCES = [
  'google',
  'facebook',
  'twitter',
  'linkedin',
  'email',
  'direct',
  'organic',
  'referral',
];
const UTM_MEDIUMS = ['cpc', 'social', 'email', 'organic', 'referral', 'banner', 'affiliate'];
const UTM_CAMPAIGNS = [
  'summer2024',
  'product-launch',
  'pricing-update',
  'feature-announcement',
  'holiday-sale',
  'webinar-series',
  'case-study',
  'tutorial-series',
];

// Languages
const LANGUAGES = [
  'en-US',
  'en-GB',
  'de-DE',
  'fr-FR',
  'es-ES',
  'it-IT',
  'pt-BR',
  'ja-JP',
  'ko-KR',
  'zh-CN',
];

// Helper functions
function pickFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function pickInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomDevice() {
  const deviceTypes = Object.keys(DEVICES);
  const deviceType = pickFrom(deviceTypes);
  const deviceConfig = DEVICES[deviceType];

  return {
    type: deviceType,
    screen: pickFrom(deviceConfig.screen),
    os: pickFrom(deviceConfig.os),
  };
}

function pickRandomBrowser(deviceType) {
  const browsers = Object.keys(USER_AGENTS[deviceType]);
  const browser = pickFrom(browsers);
  const userAgent = pickFrom(USER_AGENTS[deviceType][browser]);

  return { browser, userAgent };
}

function pickRandomCountry() {
  return pickFrom(COUNTRIES);
}

function pickRandomLanguage() {
  return pickFrom(LANGUAGES);
}

function generateEventData(eventName) {
  const eventData = [];

  switch (eventName) {
    case 'Start Free Trial':
      eventData.push(
        { key: 'plan_type', value: pickFrom(['basic', 'pro', 'enterprise']), type: 1 },
        { key: 'trial_length', value: pickFrom([7, 14, 30]), type: 2 },
        { key: 'source', value: pickFrom(['pricing_page', 'demo', 'landing_page']), type: 1 },
      );
      break;
    case 'Watch Demo':
      eventData.push(
        { key: 'demo_type', value: pickFrom(['product', 'feature', 'use_case']), type: 1 },
        { key: 'duration', value: pickInt(30, 300), type: 2 },
        { key: 'completion_rate', value: Math.random(), type: 2 },
      );
      break;
    case 'Select Basic Plan':
    case 'Select Pro Plan':
    case 'Select Enterprise Plan': {
      const plan = eventName.replace('Select ', '').replace(' Plan', '').toLowerCase();
      eventData.push(
        { key: 'plan_type', value: plan, type: 1 },
        { key: 'price', value: plan === 'basic' ? 29 : plan === 'pro' ? 99 : 299, type: 2 },
        { key: 'billing_cycle', value: pickFrom(['monthly', 'annual']), type: 1 },
      );
      break;
    }
    case 'Request Integration':
      eventData.push(
        { key: 'integration_type', value: pickFrom(['api', 'webhook', 'sdk', 'plugin']), type: 1 },
        {
          key: 'platform',
          value: pickFrom(['shopify', 'woocommerce', 'magento', 'custom']),
          type: 1,
        },
        { key: 'priority', value: pickFrom(['low', 'medium', 'high']), type: 1 },
      );
      break;
    case 'Contact Support':
      eventData.push(
        {
          key: 'support_type',
          value: pickFrom(['technical', 'billing', 'feature_request', 'general']),
          type: 1,
        },
        { key: 'priority', value: pickFrom(['low', 'medium', 'high', 'urgent']), type: 1 },
        { key: 'channel', value: pickFrom(['chat', 'email', 'phone', 'ticket']), type: 1 },
      );
      break;
    case 'Download Whitepaper':
      eventData.push(
        {
          key: 'whitepaper_title',
          value: pickFrom(['Analytics Guide', 'ROI Study', 'Best Practices']),
          type: 1,
        },
        { key: 'file_size', value: pickInt(1, 10), type: 2 },
        { key: 'industry', value: pickFrom(['ecommerce', 'saas', 'enterprise']), type: 1 },
      );
      break;
    case 'Subscribe Newsletter':
      eventData.push(
        {
          key: 'newsletter_type',
          value: pickFrom(['weekly', 'monthly', 'product-updates']),
          type: 1,
        },
        { key: 'source', value: pickFrom(['footer', 'popup', 'sidebar']), type: 1 },
      );
      break;
    case 'Request Quote':
      eventData.push(
        { key: 'company_size', value: pickFrom(['1-10', '11-50', '51-200', '200+']), type: 1 },
        { key: 'budget_range', value: pickFrom(['$1k-$5k', '$5k-$10k', '$10k+']), type: 1 },
        { key: 'timeline', value: pickFrom(['immediate', '1-3 months', '3-6 months']), type: 1 },
      );
      break;
    case 'Purchase':
      eventData.push(
        { key: 'product_id', value: pickFrom(['prod_001', 'prod_002', 'prod_003']), type: 1 },
        { key: 'amount', value: pickInt(50, 500), type: 2 },
        { key: 'currency', value: 'USD', type: 1 },
      );
      break;
    case 'Add to Cart':
      eventData.push(
        { key: 'product_id', value: pickFrom(['prod_001', 'prod_002', 'prod_003']), type: 1 },
        { key: 'quantity', value: pickInt(1, 5), type: 2 },
        { key: 'price', value: pickInt(20, 200), type: 2 },
      );
      break;
    case 'View Product':
      eventData.push(
        { key: 'product_id', value: pickFrom(['prod_001', 'prod_002', 'prod_003']), type: 1 },
        { key: 'category', value: pickFrom(['electronics', 'clothing', 'books']), type: 1 },
        { key: 'view_duration', value: pickInt(10, 120), type: 2 },
      );
      break;
    case 'Signup':
      eventData.push(
        { key: 'signup_method', value: pickFrom(['email', 'google', 'facebook']), type: 1 },
        { key: 'newsletter_optin', value: Math.random() > 0.5 ? 1 : 0, type: 2 },
        { key: 'referral_source', value: pickFrom(['direct', 'social', 'search']), type: 1 },
      );
      break;
    case 'Upgrade Plan':
      eventData.push(
        { key: 'from_plan', value: pickFrom(['free', 'basic', 'pro']), type: 1 },
        { key: 'to_plan', value: pickFrom(['basic', 'pro', 'enterprise']), type: 1 },
        { key: 'upgrade_reason', value: pickFrom(['features', 'limits', 'support']), type: 1 },
      );
      break;
  }

  return eventData;
}

module.exports = {
  USER_AGENTS,
  DEVICES,
  COUNTRIES,
  PATHS,
  BUSINESS_EVENTS,
  UTM_SOURCES,
  UTM_MEDIUMS,
  UTM_CAMPAIGNS,
  LANGUAGES,
  pickFrom,
  pickInt,
  pickRandomDevice,
  pickRandomBrowser,
  pickRandomCountry,
  pickRandomLanguage,
  generateEventData,
};
