jest.mock('fs', () => {
  const mem = { data: '' };
  return {
    promises: {
      mkdir: jest.fn(async () => {}),
      readFile: jest.fn(async () => {
        if (!mem.data) throw new Error('ENOENT');
        return mem.data;
      }),
      writeFile: jest.fn(async (file, content) => { mem.data = content; })
    },
    // Додаємо синхронні та callback-API, які використовує winston File transport
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(() => {}),
    statSync: jest.fn(() => ({ isDirectory: () => true })),
    stat: jest.fn((file, cb) => cb(null, { isFile: () => true, isDirectory: () => false })),
    createWriteStream: jest.fn(() => ({ write: () => {}, end: () => {} }))
  };
});

jest.mock('axios');

const axios = require('axios');

// Скидаємо кеш модуля, щоб отримати новий інстанс UserManager з нашими моками
let userManager;
const loadUserManager = () => {
  jest.isolateModules(() => {
    userManager = require('../src/userManager');
  });
};

describe('UserManager', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    loadUserManager();
  });

  test('createUser та getUser працюють і додають методи-розширення', async () => {
    const tgId = '1001';
    const userInfo = { username: 'test', firstName: 'Ivan', lastName: 'P', phone: '+380501234567', email: 'a@b.com' };
    const created = await userManager.createUser(tgId, userInfo);
    expect(created.telegramId).toBe(tgId);

    const user = await userManager.getUser(tgId);
    expect(user).toBeTruthy();
    expect(typeof user.isLinkedToServer).toBe('function');
    expect(user.isLinkedToServer()).toBeFalsy();
  });

  test('linkUserToServer, isUserLinked та unlink працюють (з валідним токеном)', async () => {
    const tgId = '1002';
    await userManager.createUser(tgId, { username: 'u' });

    // Мокаємо успішну перевірку токена
    axios.get.mockResolvedValueOnce({ status: 200, data: { id: 1 } });

    await userManager.linkUserToServer(tgId, 55, 'tok');
    const linkedTrue = await userManager.isUserLinked(tgId);
    expect(linkedTrue).toBe(true);

    await userManager.unlinkUserFromServer(tgId);
    const linkedFalse = await userManager.isUserLinked(tgId);
    expect(linkedFalse).toBe(false);
  });

  test('isUserLinked повертає false, якщо токен недійсний на сервері', async () => {
    const tgId = '1003';
    await userManager.createUser(tgId, { username: 'u' });

    // Мокаємо недійсний токен
    axios.get.mockResolvedValueOnce({ status: 401 });
    const linked = await userManager.isUserLinked(tgId);
    expect(linked).toBe(false);
  });

  test('getServerCredentials кидає, якщо токен прострочений', async () => {
    const tgId = '1006';

    // Зберігаємо користувача з простроченим токеном
    const users = {};
    const expired = new Date(Date.now() - 3600_000).toISOString();
    users[tgId] = { telegramId: tgId, serverUserId: 1, token: 'tok', tokenExpires: expired };

    // Перезаписуємо файл користувачів через saveUsers
    const fsMock = require('fs').promises;
    await fsMock.writeFile('ignored', JSON.stringify(users));

    // Перезавантажимо модуль, щоб прочитав нові дані
    loadUserManager();

    await expect(userManager.getServerCredentials(tgId)).rejects.toThrow('Токен закінчився');
  });

  test('мова користувача та сповіщення', async () => {
    const tgId = '1007';
    await userManager.createUser(tgId, { username: 'u' });

    expect(await userManager.getUserLanguage(tgId)).toBe('uk');
    await userManager.setUserLanguage(tgId, 'en');
    expect(await userManager.getUserLanguage(tgId)).toBe('en');

    const enabled = await userManager.toggleNotifications(tgId);
    expect(typeof enabled).toBe('boolean');
  });
});
