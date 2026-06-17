type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type SupabaseClientOptions = {
  auth: {
    storage: StorageAdapter;
  };
};

type CreateClientCall = [string, string, SupabaseClientOptions];

const mockCreateClient = jest.fn(
  (_url: string, _key: string, _options: SupabaseClientOptions) => ({
    auth: {},
  })
);

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
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('ignores non-browser localStorage during static rendering', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {},
    });

    require('../supabase');

    const createClientCalls = mockCreateClient.mock.calls as CreateClientCall[];
    expect(createClientCalls).toHaveLength(1);
    const storage = createClientCalls[0]![2].auth.storage;

    await expect(storage.getItem('session')).resolves.toBeNull();
    await expect(storage.setItem('session', 'value')).resolves.toBeUndefined();
    await expect(storage.removeItem('session')).resolves.toBeUndefined();
  });
});
