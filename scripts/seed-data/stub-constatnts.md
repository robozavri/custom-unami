const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124.0.0.0 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 412, height: 915 },
];

const COUNTRY_IPS = {
  'United States': ['13.57.0.1', '3.83.0.1', '34.201.0.1'],
  'United Kingdom': ['51.140.0.1', '51.141.0.1', '51.142.0.1'],
  Germany: ['18.195.0.1', '3.122.0.1', '18.156.0.1'],
  France: ['35.180.0.1', '15.188.0.1', '52.47.0.1'],
  Japan: ['18.176.0.1', '54.178.0.1', '13.230.0.1'],
  Australia: ['13.54.0.1', '52.62.0.1', '54.153.0.1'],
  Canada: ['35.183.0.1', '15.222.0.1', '3.96.0.1'],
  Brazil: ['18.228.0.1', '52.67.0.1', '54.94.0.1'],
  India: ['15.206.0.1', '13.232.0.1', '3.6.0.1'],
  Netherlands: ['145.97.0.1', '213.75.0.1', '37.128.0.1'],
};

const GLOBAL_FALLBACK_IPS = [
  // Broadly distributed regions for fallback variety
  '13.57.0.1', // US
  '51.140.0.1', // UK
  '18.195.0.1', // DE
  '35.180.0.1', // FR
  '18.176.0.1', // JP
  '13.54.0.1', // AU
  '35.183.0.1', // CA
  '18.228.0.1', // BR
  '15.206.0.1', // IN
  '145.97.0.1', // NL
];

const countries = [
  { name: 'United States', timezone: 'America/New_York', locale: 'en_US' },
  { name: 'United Kingdom', timezone: 'Europe/London', locale: 'en_GB' },
  { name: 'Germany', timezone: 'Europe/Berlin', locale: 'de' },
  { name: 'France', timezone: 'Europe/Paris', locale: 'fr' },
  { name: 'Japan', timezone: 'Asia/Tokyo', locale: 'ja' },
  { name: 'Australia', timezone: 'Australia/Sydney', locale: 'en_AU' },
  { name: 'Canada', timezone: 'America/Toronto', locale: 'en_CA' },
  { name: 'Brazil', timezone: 'America/Sao_Paulo', locale: 'pt_BR' },
  { name: 'India', timezone: 'Asia/Kolkata', locale: 'en_IN' },
  { name: 'Netherlands', timezone: 'Europe/Amsterdam', locale: 'nl' },
];

// Event types to seed
const BUSINESS_EVENTS = [
  'Start Free Trial',
  'Watch Demo',
  'Select Basic Plan',
  'Select Pro Plan',
  'Select Enterprise Plan',
  'Request Integration',
  'Contact Support',
];

// Simple pools
const PATHS = [
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/blog',
  '/features',
  '/demo',
  '/integrations',
  '/support',
];
