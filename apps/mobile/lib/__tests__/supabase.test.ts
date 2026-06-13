const mockCreateClient = jest.fn(() => ({
  auth: {},
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

jest.mock('react-native-url-polyfill/auto', () => undefined);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('Supabase storage adapter', () => {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();

    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    } else {
      delete (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage;
    }
  });

  it('ignores non-browser localStorage during static rendering', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {},
    });

    require('../supabase');

    const storage = mockCreateClient.mock.calls[0][2].auth.storage;

    await expect(storage.getItem('session')).resolves.toBeNull();
    await expect(storage.setItem('session', 'value')).resolves.toBeUndefined();
    await expect(storage.removeItem('session')).resolves.toBeUndefined();
  });
});
