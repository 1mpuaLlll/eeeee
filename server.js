import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// ============ DATABASE ============
let db = { users: {}, groups: {}, chats: {}, messages: {}, sessions: {}, nfts: {}, nftMarket: [], calls: {}, groupCalls: {} };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...db, ...data };
      console.log('📂 База данных загружена:', Object.keys(db.users).length, 'пользователей');
    } else {
      console.log('📂 Создание новой базы данных');
      saveDBSync();
    }
  } catch (e) { 
    console.error('⚠️ Ошибка загрузки БД:', e.message);
  }
}

// Immediate sync save for critical operations
function saveDBSync() {
  try { 
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); 
    console.log('💾 БД сохранена');
  } catch (e) { 
    console.error('DB save error:', e); 
  }
}

// Debounced save for non-critical operations
let saveTimeout = null;
function saveDB() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveDBSync, 500);
}

// Auto-save every 30 seconds as backup
setInterval(saveDBSync, 30000);

loadDB();

// System bots
const BOTS = {
  saved: { id: 'saved', username: 'saved', name: 'Избранное', isBot: true, verified: true, online: true, avatar: '⭐' },
  aibot: { id: 'aibot', username: 'aibot', name: 'AI Ассистент', isBot: true, verified: true, online: true, avatar: '🤖' },
  gamebot: { id: 'gamebot', username: 'gamebot', name: 'Game Bot', isBot: true, verified: true, online: true, avatar: '🎮' },
  musicbot: { id: 'musicbot', username: 'musicbot', name: 'Music Bot', isBot: true, verified: true, online: true, avatar: '🎵' },
  premiumbot: { id: 'premiumbot', username: 'premiumbot', name: 'Premium Bot', isBot: true, verified: true, online: true, avatar: '⭐' },
  weatherbot: { id: 'weatherbot', username: 'weatherbot', name: 'Weather Bot', isBot: true, verified: true, online: true, avatar: '🌤️' },
  quotebot: { id: 'quotebot', username: 'quotebot', name: 'Quote Bot', isBot: true, verified: true, online: true, avatar: '💬' }
};

// ============ HELPERS ============
const genId = () => crypto.randomBytes(12).toString('hex');
const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(data)); };
const safeUser = u => u ? { id: u.id, username: u.username, name: u.name, avatar: u.avatar, banner: u.banner, online: u.online, verified: u.verified, premium: u.premium, bio: u.bio, isBot: u.isBot, level: u.level || 1, balance: u.balance || 0, inventory: u.inventory || [], nftUsernames: u.nftUsernames || [], createdAt: u.createdAt } : null;

// Password hashing with salt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

async function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

// ============ BOT RESPONSES ============
function getBotResponse(botId, text) {
  const t = text.toLowerCase();
  
  if (botId === 'aibot') {
    if (t.includes('привет')) return 'Привет! 👋 Я AI ассистент. Чем помочь?';
    if (t.includes('помощь')) return 'Я могу:\n• Отвечать на вопросы\n• Помогать с задачами\n• Давать советы';
    if (t.includes('как дела')) return 'Отлично! Готов помогать 24/7 💪';
    return 'Интересный вопрос! 🤔 Спроси что-то конкретное.';
  }
  
  if (botId === 'gamebot') {
    if (t.includes('привет')) return '🎮 Привет!\n\nИгры:\n• /dice - Кости\n• /coin - Монетка\n• /slot - Слоты';
    if (t.includes('/dice') || t.includes('кости')) {
      const num = Math.floor(Math.random() * 6) + 1;
      return `🎲 Выпало: ${num}\n${num >= 4 ? '🎉 +10 ⭐!' : '😔 Попробуй ещё!'}`;
    }
    if (t.includes('/coin')) return Math.random() > 0.5 ? '🪙 Орёл! +5 ⭐' : '🪙 Решка!';
    if (t.includes('/slot')) {
      const slots = ['🍒', '🍋', '💎', '7️⃣'];
      const r = [0, 1, 2].map(() => slots[Math.floor(Math.random() * slots.length)]);
      return `🎰 ${r.join(' | ')}\n${r[0] === r[1] && r[1] === r[2] ? '🎉 ДЖЕКПОТ! +100 ⭐' : 'Попробуй ещё!'}`;
    }
    return 'Напиши /dice, /coin или /slot! 🎮';
  }
  
  if (botId === 'musicbot') {
    if (t.includes('привет') || t.includes('хай') || t.includes('hello')) {
      return '🎵 Привет, меломан!\n\nМои команды:\n• /top - Топ 10 треков\n• /random - Случайный трек\n• /rock - Рок\n• /pop - Поп\n• /rap - Рэп';
    }
    if (t.includes('/top') || t.includes('топ')) {
      return '🔥 Топ треков:\n\n1. 🏆 Дора - Дорадура\n2. 🥈 Miyagi - Minor\n3. 🥉 Макс Корж - Жить в кайф\n4. Scriptonite - Привет\n5. Баста - Сансара';
    }
    if (t.includes('/random') || t.includes('случайн')) {
      const tracks = ['Oxxxymiron - Город под подошвой', 'Pharaoh - Black Siemens', 'Face - Бургер', 'Miyagi - Marlboro', 'Kizaru - Karmageddon'];
      return `🎲 ${tracks[Math.floor(Math.random() * tracks.length)]}`;
    }
    if (t.includes('рок') || t.includes('/rock')) return '🎸 Рок:\n• Кино - Группа крови\n• ДДТ - Что такое осень\n• Сплин - Выхода нет';
    if (t.includes('поп') || t.includes('/pop')) return '🎤 Поп:\n• Zivert - Life\n• Ёлка - Прованс\n• Artik & Asti - Грустный дэнс';
    if (t.includes('рэп') || t.includes('/rap')) return '🎤 Рэп:\n• Oxxxymiron - Где нас нет\n• Баста - Мама\n• Miyagi - Minor';
    return '🎵 /top, /random или жанр!';
  }
  
  if (botId === 'weatherbot') {
    if (t.includes('москва') || t.includes('москве')) {
      const temp = Math.floor(Math.random() * 30) - 10;
      return `🌤️ Москва:\n🌡️ ${temp}°C\n💨 ${Math.floor(Math.random() * 10)} м/с`;
    }
    if (t.includes('питер') || t.includes('петербург')) {
      const temp = Math.floor(Math.random() * 25) - 5;
      return `🌧️ Санкт-Петербург:\n🌡️ ${temp}°C\n💨 ${Math.floor(Math.random() * 15)} м/с`;
    }
    return '🌍 Напиши город (Москва, Питер)!';
  }
  
  if (botId === 'quotebot') {
    const quotes = [
      { t: 'Будь собой, остальные роли заняты.', a: 'Оскар Уайльд' },
      { t: 'Успех — идти от неудачи к неудаче без потери энтузиазма.', a: 'Черчилль' },
      { t: 'Единственный способ делать великую работу — любить её.', a: 'Стив Джобс' }
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    return `💬 «${q.t}»\n— ${q.a}`;
  }
  
  if (botId === 'premiumbot') {
    if (t.includes('привет')) return '⭐ Premium Bot!\n\n• /benefits - Что даёт\n• /price - Цены';
    if (t.includes('/benefits')) return '👑 Premium:\n✓ Без рекламы\n✓ Эксклюзивные стикеры\n✓ Больше обоев';
    if (t.includes('/price')) return '💰 500 ⭐ / месяц\n4000 ⭐ / год';
    return '⭐ /benefits или /price';
  }
  
  if (botId === 'saved') return '⭐ Твоё Избранное! Пересылай сюда важное.';
  
  return 'Бот временно недоступен.';
}

// ============ HTTP SERVER ============
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.writeHead(200).end();
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = token ? db.sessions[token] : null;
  const authUser = session ? db.users[session.userId] : null;
  
  // Static
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    return res.writeHead(200, { 'Content-Type': 'text/html' }).end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }
  if (req.method === 'GET' && pathname === '/admin') {
    return res.writeHead(200, { 'Content-Type': 'text/html' }).end(fs.readFileSync(path.join(__dirname, 'admin.html')));
  }
  
  // ============ AUTH ============
  if (pathname === '/api/auth/check' && req.method === 'POST') {
    const body = await parseBody(req);
    const username = (body.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const email = body.email;
    
    let exists = false;
    let error = null;
    
    if (username && (Object.values(db.users).find(u => u.username === username) || BOTS[username])) {
      exists = true;
      error = 'Username уже занят';
    }
    if (email && Object.values(db.users).find(u => u.email === email)) {
      exists = true;
      error = 'Email уже используется';
    }
    
    return json(res, 200, { exists, error });
  }
  
  if ((pathname === '/api/register' || pathname === '/api/auth/register') && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.username || !body.name || !body.password) return json(res, 400, { error: 'Заполните все обязательные поля' });
    if (body.password.length < 6) return json(res, 400, { error: 'Пароль минимум 6 символов' });
    const username = body.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (username.length < 3) return json(res, 400, { error: 'Username мин 3 символа' });
    if (Object.values(db.users).find(u => u.username === username) || BOTS[username]) return json(res, 400, { error: 'Username занят' });
    
    const passwordHash = hashPassword(body.password);
    const user = { 
      id: genId(), 
      username, 
      name: body.name.substring(0, 50), 
      email: body.email || null, 
      emailVerified: body.emailVerified || false, 
      passwordHash,
      avatar: null, 
      banner: null,
      bio: '', 
      online: true, 
      verified: false, 
      premium: false, 
      balance: 50, 
      level: 1, 
      xp: 0, 
      inventory: [], 
      nftUsernames: [],
      channels: [], 
      privacy: { showOnline: true }, 
      sounds: true, 
      createdAt: Date.now() 
    };
    db.users[user.id] = user;
    const sessionToken = genId();
    db.sessions[sessionToken] = { userId: user.id, createdAt: Date.now() };
    saveDBSync(); // Critical: save immediately
    console.log('👤 Registered:', user.username, 'Token:', sessionToken);
    return json(res, 200, { user: safeUser(user), token: sessionToken });
  }
  
  if ((pathname === '/api/login' || pathname === '/api/auth/login') && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.username || !body.password) return json(res, 400, { error: 'Введите логин и пароль' });
    const user = Object.values(db.users).find(u => u.username === body.username.toLowerCase());
    if (!user) return json(res, 404, { error: 'Пользователь не найден' });
    if (user.banned) return json(res, 403, { error: 'Аккаунт заблокирован' });
    
    // Check password
    if (!verifyPassword(body.password, user.passwordHash)) {
      return json(res, 401, { error: 'Неверный пароль' });
    }
    
    user.online = true;
    const sessionToken = genId();
    db.sessions[sessionToken] = { userId: user.id, createdAt: Date.now() };
    saveDBSync(); // Critical: save immediately
    console.log('🔑 Login:', user.username, 'Token:', sessionToken);
    return json(res, 200, { user: safeUser(user), token: sessionToken });
  }
  
  if (pathname === '/api/me') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    return json(res, 200, { user: safeUser(authUser) });
  }
  
  // ============ USER ============
  if (pathname === '/api/user/settings' && req.method === 'PUT') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    if (body.name) authUser.name = body.name.substring(0, 50);
    if (body.bio !== undefined) authUser.bio = body.bio.substring(0, 200);
    if (body.privacy) authUser.privacy = { ...authUser.privacy, ...body.privacy };
    if (body.sounds !== undefined) authUser.sounds = body.sounds;
    saveDB();
    return json(res, 200, { user: safeUser(authUser) });
  }
  
  if (pathname === '/api/user/avatar' && req.method === 'PUT') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    authUser.avatar = body.avatar;
    saveDB();
    return json(res, 200, { avatar: authUser.avatar });
  }
  
  if (pathname === '/api/user/buy' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    if ((authUser.balance || 0) < body.price) return json(res, 400, { error: 'Мало звёзд' });
    authUser.balance -= body.price;
    authUser.inventory = authUser.inventory || [];
    if (!authUser.inventory.includes(body.itemId)) authUser.inventory.push(body.itemId);
    if (body.itemId === 'premium') authUser.premium = true;
    saveDB();
    return json(res, 200, { balance: authUser.balance, inventory: authUser.inventory });
  }
  
  if (pathname === '/api/user/daily' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const now = Date.now();
    if (now - (authUser.lastDaily || 0) < 86400000) return json(res, 400, { error: 'Уже получен' });
    const streak = (now - (authUser.lastDaily || 0) < 172800000) ? (authUser.dailyStreak || 0) + 1 : 1;
    const earned = Math.min(10 + streak * 10, 70);
    authUser.balance = (authUser.balance || 0) + earned;
    authUser.lastDaily = now;
    authUser.dailyStreak = streak;
    saveDB();
    return json(res, 200, { earned, streak, balance: authUser.balance });
  }
  
  // ============ CHATS ============
  if (pathname === '/api/chats' && req.method === 'GET') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    
    // Private chats
    const userChats = Object.values(db.chats).filter(c => c.participants?.includes(authUser.id));
    const privateChats = userChats.map(c => {
      const otherId = c.participants.find(p => p !== authUser.id);
      const other = db.users[otherId] || BOTS[otherId];
      const msgs = db.messages[c.id] || [];
      return { id: c.id, type: 'private', other: safeUser(other) || { id: otherId, name: 'Удалённый' }, lastMessage: msgs[msgs.length - 1], unread: c.unread?.[authUser.id] || 0 };
    });
    
    // Group chats
    const userGroups = Object.values(db.groups || {}).filter(g => g.members?.includes(authUser.id));
    const groupChats = userGroups.map(g => {
      const msgs = db.messages[g.id] || [];
      return { 
        id: g.id, 
        type: 'group',
        isGroup: true,
        other: { 
          id: g.id, 
          name: g.name, 
          avatar: g.avatar,
          memberCount: g.members?.length || 0
        }, 
        lastMessage: msgs[msgs.length - 1], 
        unread: g.unread?.[authUser.id] || 0 
      };
    });
    
    const result = [...privateChats, ...groupChats].sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
    return json(res, 200, { chats: result });
  }
  
  if (pathname === '/api/chats' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    let pid = body.participantId;
    if (!BOTS[pid]) {
      const target = db.users[pid] || Object.values(db.users).find(u => u.username === pid);
      if (!target) return json(res, 404, { error: 'Не найден' });
      pid = target.id;
    }
    let chat = Object.values(db.chats).find(c => c.participants?.includes(authUser.id) && c.participants?.includes(pid));
    if (!chat) {
      chat = { id: genId(), participants: [authUser.id, pid], createdAt: Date.now(), unread: {} };
      db.chats[chat.id] = chat;
      db.messages[chat.id] = [];
      saveDB();
    }
    return json(res, 200, { chat });
  }
  
  if (pathname.match(/^\/api\/chats\/[^\/]+$/) && req.method === 'DELETE') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const chatId = pathname.split('/')[3];
    const chat = db.chats[chatId];
    if (!chat || !chat.participants?.includes(authUser.id)) return json(res, 404, { error: 'Not found' });
    delete db.chats[chatId];
    delete db.messages[chatId];
    saveDB();
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/chats\/[^\/]+\/clear$/) && req.method === 'DELETE') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const chatId = pathname.split('/')[3];
    db.messages[chatId] = [];
    saveDB();
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/chats\/[^\/]+\/messages$/)) {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const chatId = pathname.split('/')[3];
    return json(res, 200, { messages: db.messages[chatId] || [] });
  }
  
  // ============ GROUPS ============
  if (pathname === '/api/groups' && req.method === 'GET') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const userGroups = Object.values(db.groups || {}).filter(g => g.members?.includes(authUser.id));
    return json(res, 200, { groups: userGroups.map(g => ({
      id: g.id, name: g.name, avatar: g.avatar, memberCount: g.members?.length || 0, isOwner: g.ownerId === authUser.id
    }))});
  }
  
  if (pathname === '/api/groups' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    if (!body.name) return json(res, 400, { error: 'Введите название группы' });
    
    const group = {
      id: genId(),
      name: body.name.substring(0, 50),
      description: (body.description || '').substring(0, 200),
      avatar: body.avatar || null,
      ownerId: authUser.id,
      members: [authUser.id],
      admins: [authUser.id],
      unread: {},
      createdAt: Date.now()
    };
    
    if (!db.groups) db.groups = {};
    db.groups[group.id] = group;
    db.messages[group.id] = [];
    saveDB();
    return json(res, 200, { group });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+$/) && req.method === 'GET') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    
    const members = group.members.map(mId => {
      const u = db.users[mId];
      return u ? { ...safeUser(u), isAdmin: group.admins?.includes(mId), isOwner: group.ownerId === mId } : null;
    }).filter(Boolean);
    
    return json(res, 200, { 
      group: { ...group, members, memberCount: members.length, isOwner: group.ownerId === authUser.id, isAdmin: group.admins?.includes(authUser.id) }
    });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+$/) && req.method === 'PUT') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    if (!group.admins?.includes(authUser.id)) return json(res, 403, { error: 'Нет прав' });
    
    const body = await parseBody(req);
    if (body.name) group.name = body.name.substring(0, 50);
    if (body.description !== undefined) group.description = body.description.substring(0, 200);
    if (body.avatar !== undefined) group.avatar = body.avatar;
    saveDB();
    return json(res, 200, { group });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+$/) && req.method === 'DELETE') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    if (group.ownerId !== authUser.id) return json(res, 403, { error: 'Только владелец может удалить группу' });
    
    delete db.groups[groupId];
    delete db.messages[groupId];
    saveDB();
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+\/join$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    
    if (!group.members.includes(authUser.id)) {
      group.members.push(authUser.id);
      saveDB();
    }
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+\/leave$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    if (group.ownerId === authUser.id) return json(res, 400, { error: 'Владелец не может покинуть группу' });
    
    group.members = group.members.filter(id => id !== authUser.id);
    group.admins = (group.admins || []).filter(id => id !== authUser.id);
    saveDB();
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+\/members$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    if (!group.admins?.includes(authUser.id)) return json(res, 403, { error: 'Нет прав' });
    
    const body = await parseBody(req);
    const user = db.users[body.userId] || Object.values(db.users).find(u => u.username === body.username);
    if (!user) return json(res, 404, { error: 'Пользователь не найден' });
    
    if (!group.members.includes(user.id)) {
      group.members.push(user.id);
      saveDB();
      
      // Notify user via WebSocket
      const userWs = clients.get(user.id);
      if (userWs) userWs.send(JSON.stringify({ type: 'group_invite', groupId, groupName: group.name }));
    }
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+\/kick$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    if (!group.admins?.includes(authUser.id)) return json(res, 403, { error: 'Нет прав' });
    
    const body = await parseBody(req);
    if (body.userId === group.ownerId) return json(res, 400, { error: 'Нельзя кикнуть владельца' });
    
    group.members = group.members.filter(id => id !== body.userId);
    group.admins = (group.admins || []).filter(id => id !== body.userId);
    saveDB();
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+\/admin$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group) return json(res, 404, { error: 'Группа не найдена' });
    if (group.ownerId !== authUser.id) return json(res, 403, { error: 'Только владелец может назначать админов' });
    
    const body = await parseBody(req);
    if (!group.members.includes(body.userId)) return json(res, 400, { error: 'Пользователь не в группе' });
    
    if (!group.admins) group.admins = [group.ownerId];
    if (body.isAdmin && !group.admins.includes(body.userId)) {
      group.admins.push(body.userId);
    } else if (!body.isAdmin) {
      group.admins = group.admins.filter(id => id !== body.userId);
    }
    saveDB();
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/groups\/[^\/]+\/messages$/)) {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const groupId = pathname.split('/')[3];
    const group = db.groups?.[groupId];
    if (!group || !group.members?.includes(authUser.id)) return json(res, 404, { error: 'Группа не найдена' });
    return json(res, 200, { messages: db.messages[groupId] || [] });
  }
  
  // ============ SEARCH ============
  if (pathname === '/api/search') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const users = Object.values(db.users).filter(u => u.username.includes(q) || u.name.toLowerCase().includes(q)).map(safeUser).slice(0, 10);
    const bots = Object.values(BOTS).filter(b => b.username.includes(q) || b.name.toLowerCase().includes(q));
    const channels = Object.values(db.channels).filter(c => c.name.toLowerCase().includes(q)).map(c => ({ id: c.id, name: c.name, isChannel: true, memberCount: c.members?.length || 0 }));
    return json(res, 200, { users, bots, channels });
  }
  
  // ============ CHANNELS ============
  if (pathname === '/api/channels' && req.method === 'GET') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const userChannels = Object.values(db.channels).filter(c => c.members?.includes(authUser.id)).map(c => ({ id: c.id, name: c.name, avatar: c.avatar, memberCount: c.members?.length || 0 }));
    return json(res, 200, { channels: userChannels });
  }
  
  if (pathname === '/api/channels' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    if (!body.name) return json(res, 400, { error: 'Нужно название' });
    
    // Check username availability
    let username = null;
    if (body.username) {
      username = body.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (username.length < 3) return json(res, 400, { error: 'Username минимум 3 символа' });
      if (username.length > 32) return json(res, 400, { error: 'Username максимум 32 символа' });
      const taken = Object.values(db.channels).find(c => c.username === username);
      if (taken) return json(res, 400, { error: 'Username занят' });
    }
    
    const channel = { 
      id: genId(), 
      name: body.name.substring(0, 50), 
      username: username,
      description: (body.description || '').substring(0, 500), 
      avatar: body.avatar || null,
      banner: null,
      ownerId: authUser.id, 
      members: [authUser.id], 
      admins: [authUser.id],
      roles: { [authUser.id]: 'owner' }, 
      posts: [], 
      chat: [],
      settings: {
        allowComments: true,
        allowReactions: true,
        paidReactions: false,
        reactionPrice: 1
      },
      createdAt: Date.now() 
    };
    db.channels[channel.id] = channel;
    authUser.channels = authUser.channels || [];
    authUser.channels.push(channel.id);
    saveDBSync();
    return json(res, 200, { channel });
  }
  
  // Get channel by username
  if (pathname.match(/^\/api\/channels\/by-username\/[^\/]+$/) && req.method === 'GET') {
    const username = pathname.split('/')[4].toLowerCase();
    const channel = Object.values(db.channels).find(c => c.username === username);
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    const members = (channel.members || []).map(mId => { const u = db.users[mId]; return u ? { ...safeUser(u), role: channel.roles?.[mId] || 'member' } : null; }).filter(Boolean);
    return json(res, 200, { channel: { ...channel, members, memberCount: members.length } });
  }
  
  // Check username availability
  if (pathname === '/api/channels/check-username' && req.method === 'POST') {
    const body = await parseBody(req);
    const username = (body.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (username.length < 3) return json(res, 200, { available: false, error: 'Минимум 3 символа' });
    const taken = Object.values(db.channels).find(c => c.username === username);
    return json(res, 200, { available: !taken, username });
  }
  
  if (pathname.match(/^\/api\/channels\/[^\/]+$/) && req.method === 'GET') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Не найден' });
    if (!channel.members?.includes(authUser.id)) { channel.members.push(authUser.id); channel.roles[authUser.id] = 'member'; saveDB(); }
    const members = channel.members.map(mId => { const u = db.users[mId]; return u ? { ...safeUser(u), role: channel.roles?.[mId] || 'member' } : null; }).filter(Boolean);
    const isAdmin = channel.ownerId === authUser.id || channel.admins?.includes(authUser.id);
    return json(res, 200, { channel: { ...channel, members, memberCount: members.length, isAdmin, isOwner: channel.ownerId === authUser.id } });
  }
  
  // Update channel settings (owner/admin only)
  if (pathname.match(/^\/api\/channels\/[^\/]+\/settings$/) && req.method === 'PUT') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    if (channel.ownerId !== authUser.id && !channel.admins?.includes(authUser.id)) {
      return json(res, 403, { error: 'Нет прав' });
    }
    const body = await parseBody(req);
    
    // Update name
    if (body.name) channel.name = body.name.substring(0, 50);
    
    // Update username (owner only)
    if (body.username !== undefined && channel.ownerId === authUser.id) {
      if (body.username === '' || body.username === null) {
        channel.username = null;
      } else {
        const username = body.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (username.length >= 3 && username.length <= 32) {
          const taken = Object.values(db.channels).find(c => c.username === username && c.id !== channelId);
          if (!taken) channel.username = username;
        }
      }
    }
    
    // Update description
    if (body.description !== undefined) channel.description = (body.description || '').substring(0, 500);
    
    // Update avatar
    if (body.avatar !== undefined) channel.avatar = body.avatar || null;
    
    // Update banner
    if (body.banner !== undefined) channel.banner = body.banner || null;
    
    // Update settings
    if (body.settings) {
      channel.settings = channel.settings || {};
      if (body.settings.allowComments !== undefined) channel.settings.allowComments = body.settings.allowComments;
      if (body.settings.allowReactions !== undefined) channel.settings.allowReactions = body.settings.allowReactions;
      if (body.settings.paidReactions !== undefined) channel.settings.paidReactions = body.settings.paidReactions;
      if (body.settings.reactionPrice !== undefined) channel.settings.reactionPrice = Math.max(1, Math.min(100, body.settings.reactionPrice));
    }
    
    saveDBSync();
    return json(res, 200, { success: true, channel });
  }
  
  // Add/remove admin (owner only)
  if (pathname.match(/^\/api\/channels\/[^\/]+\/admins$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    if (channel.ownerId !== authUser.id) return json(res, 403, { error: 'Только владелец может назначать админов' });
    
    const body = await parseBody(req);
    const targetUser = db.users[body.userId];
    if (!targetUser) return json(res, 404, { error: 'Пользователь не найден' });
    if (!channel.members?.includes(body.userId)) return json(res, 400, { error: 'Пользователь не подписан на канал' });
    
    channel.admins = channel.admins || [];
    
    if (body.action === 'add') {
      if (!channel.admins.includes(body.userId)) {
        channel.admins.push(body.userId);
        channel.roles[body.userId] = 'admin';
      }
    } else if (body.action === 'remove') {
      channel.admins = channel.admins.filter(id => id !== body.userId);
      channel.roles[body.userId] = 'member';
    }
    
    saveDBSync();
    return json(res, 200, { success: true, admins: channel.admins });
  }
  
  // Kick member (owner/admin)
  if (pathname.match(/^\/api\/channels\/[^\/]+\/kick$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    if (channel.ownerId !== authUser.id && !channel.admins?.includes(authUser.id)) {
      return json(res, 403, { error: 'Нет прав' });
    }
    
    const body = await parseBody(req);
    if (body.userId === channel.ownerId) return json(res, 400, { error: 'Нельзя кикнуть владельца' });
    if (channel.admins?.includes(body.userId) && channel.ownerId !== authUser.id) {
      return json(res, 400, { error: 'Только владелец может кикнуть админа' });
    }
    
    channel.members = (channel.members || []).filter(id => id !== body.userId);
    channel.admins = (channel.admins || []).filter(id => id !== body.userId);
    if (channel.roles) delete channel.roles[body.userId];
    
    saveDBSync();
    return json(res, 200, { success: true });
  }
  
  // Paid reaction on post
  if (pathname.match(/^\/api\/channels\/[^\/]+\/posts\/[^\/]+\/paid-reaction$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const parts = pathname.split('/');
    const channelId = parts[3];
    const postId = parts[5];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    
    const post = (channel.posts || []).find(p => p.id === postId);
    if (!post) return json(res, 404, { error: 'Пост не найден' });
    
    const body = await parseBody(req);
    const emoji = body.emoji || '⭐';
    const price = channel.settings?.reactionPrice || 1;
    
    if ((authUser.balance || 0) < price) {
      return json(res, 400, { error: `Нужно ${price} ⭐` });
    }
    
    // Deduct from user
    authUser.balance = (authUser.balance || 0) - price;
    
    // Add to channel owner
    const owner = db.users[channel.ownerId];
    if (owner) owner.balance = (owner.balance || 0) + price;
    
    // Add reaction
    post.paidReactions = post.paidReactions || {};
    post.paidReactions[emoji] = post.paidReactions[emoji] || [];
    post.paidReactions[emoji].push({ 
      userId: authUser.id, 
      amount: price, 
      createdAt: Date.now() 
    });
    
    saveDBSync();
    return json(res, 200, { 
      success: true, 
      balance: authUser.balance, 
      totalReactions: Object.values(post.paidReactions).reduce((a, r) => a + r.length, 0)
    });
  }
  
  if (pathname.match(/^\/api\/channels\/[^\/]+\/posts$/)) {
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Not found' });
    const posts = (channel.posts || []).map(p => ({ ...p, author: db.users[p.from] ? safeUser(db.users[p.from]) : null })).reverse();
    return json(res, 200, { posts });
  }
  
  if (pathname.match(/^\/api\/channels\/[^\/]+\/chat$/)) {
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Not found' });
    const messages = (channel.chat || []).map(m => ({ ...m, author: db.users[m.from] ? safeUser(db.users[m.from]) : null }));
    return json(res, 200, { messages });
  }
  
  // Channel join
  if (pathname.match(/^\/api\/channels\/[^\/]+\/join$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    if (!channel.members) channel.members = [];
    if (!channel.members.includes(authUser.id)) {
      channel.members.push(authUser.id);
      channel.roles = channel.roles || {};
      channel.roles[authUser.id] = 'member';
    }
    authUser.channels = authUser.channels || [];
    if (!authUser.channels.includes(channelId)) authUser.channels.push(channelId);
    saveDBSync();
    return json(res, 200, { success: true, channel: { ...channel, memberCount: channel.members.length } });
  }
  
  // Channel leave
  if (pathname.match(/^\/api\/channels\/[^\/]+\/leave$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    if (channel.ownerId === authUser.id) return json(res, 400, { error: 'Владелец не может покинуть канал' });
    channel.members = (channel.members || []).filter(id => id !== authUser.id);
    if (channel.roles) delete channel.roles[authUser.id];
    authUser.channels = (authUser.channels || []).filter(id => id !== channelId);
    saveDBSync();
    return json(res, 200, { success: true });
  }
  
  // Channel invite link
  if (pathname.match(/^\/api\/channels\/[^\/]+\/invite$/) && req.method === 'GET') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    return json(res, 200, { invite: `mini://channel/${channelId}`, channelId });
  }
  
  // Channel post
  if (pathname.match(/^\/api\/channels\/[^\/]+\/post$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    if (channel.ownerId !== authUser.id && channel.roles?.[authUser.id] !== 'admin') {
      return json(res, 403, { error: 'Нет прав на публикацию' });
    }
    const body = await parseBody(req);
    const post = { id: genId(), from: authUser.id, text: body.text || '', image: body.image || null, likes: [], createdAt: Date.now() };
    channel.posts = channel.posts || [];
    channel.posts.push(post);
    saveDBSync();
    return json(res, 200, { post: { ...post, author: safeUser(authUser) } });
  }
  
  // Channel post like
  if (pathname.match(/^\/api\/channels\/[^\/]+\/posts\/[^\/]+\/like$/) && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const parts = pathname.split('/');
    const channelId = parts[3];
    const postId = parts[5];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    const post = (channel.posts || []).find(p => p.id === postId);
    if (!post) return json(res, 404, { error: 'Пост не найден' });
    post.likes = post.likes || [];
    const idx = post.likes.indexOf(authUser.id);
    if (idx === -1) post.likes.push(authUser.id);
    else post.likes.splice(idx, 1);
    saveDB();
    return json(res, 200, { likes: post.likes.length, liked: post.likes.includes(authUser.id) });
  }
  
  // Channel avatar
  if (pathname.match(/^\/api\/channels\/[^\/]+\/avatar$/) && req.method === 'PUT') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const channelId = pathname.split('/')[3];
    const channel = db.channels[channelId];
    if (!channel) return json(res, 404, { error: 'Канал не найден' });
    if (channel.ownerId !== authUser.id) return json(res, 403, { error: 'Только владелец может изменить аватар' });
    const body = await parseBody(req);
    channel.avatar = body.avatar || null;
    saveDBSync();
    return json(res, 200, { success: true, channel });
  }
  
  // ============ NFT ============
  if (pathname === '/api/nft/market') return json(res, 200, { nfts: db.nftMarket.filter(n => n.forSale) });
  
  if (pathname === '/api/nft/search') {
    const q = (url.searchParams.get('q') || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (q.length < 3) return json(res, 200, { available: false });
    const taken = Object.values(db.users).find(u => u.username === q) || BOTS[q] || db.nfts[q];
    return json(res, 200, { available: !taken, username: q, price: 50 });
  }
  
  if (pathname === '/api/nft/buy-username' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    const username = (body.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (username.length < 3) return json(res, 400, { error: 'Мин 3 символа' });
    const taken = Object.values(db.users).find(u => u.username === username) || BOTS[username] || db.nfts[username];
    if (taken) return json(res, 400, { error: 'Занят' });
    if ((authUser.balance || 0) < 50) return json(res, 400, { error: 'Мало звёзд' });
    authUser.balance -= 50;
    
    // Create NFT record
    const nft = { id: genId(), username, ownerId: authUser.id, price: 50, forSale: false, createdAt: Date.now() };
    db.nfts[username] = nft;
    
    // Add to user's NFT collection
    if (!authUser.nftUsernames) authUser.nftUsernames = [];
    authUser.nftUsernames.push({ username, id: nft.id, acquiredAt: Date.now() });
    
    // Optionally change username to the NFT one
    if (body.useAsUsername) {
      authUser.username = username;
    }
    
    saveDB();
    return json(res, 200, { success: true, balance: authUser.balance, username, user: safeUser(authUser) });
  }
  
  if (pathname === '/api/nft/my') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const myNfts = Object.values(db.nfts).filter(n => n.ownerId === authUser.id);
    return json(res, 200, { nfts: myNfts, collection: authUser.nftUsernames || [] });
  }
  
  if (pathname === '/api/nft/list' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    let nft = Object.values(db.nfts).find(n => n.ownerId === authUser.id);
    if (!nft) { nft = { id: genId(), username: authUser.username, ownerId: authUser.id, price: body.price || 100, forSale: true, createdAt: Date.now() }; db.nfts[authUser.username] = nft; }
    nft.price = body.price || 100; nft.forSale = true;
    if (!db.nftMarket.find(n => n.id === nft.id)) db.nftMarket.push(nft);
    saveDB();
    return json(res, 200, { success: true });
  }
  
  if (pathname === '/api/favorites' && req.method === 'POST') {
    if (!authUser) return json(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    let favChat = Object.values(db.chats).find(c => c.participants?.includes(authUser.id) && c.participants?.includes('saved'));
    if (!favChat) { favChat = { id: genId(), participants: [authUser.id, 'saved'], createdAt: Date.now(), unread: {} }; db.chats[favChat.id] = favChat; db.messages[favChat.id] = []; }
    const sourceMsg = (db.messages[body.chatId] || []).find(m => m.id === body.messageId);
    if (sourceMsg) { db.messages[favChat.id].push({ ...sourceMsg, id: genId(), savedFrom: body.chatId, createdAt: Date.now() }); saveDB(); }
    return json(res, 200, { success: true });
  }
  
  // ============ ADMIN ============
  const ADMIN_PASSWORD = '1mpuLtestlll122';
  
  if (pathname === '/api/admin/stats') {
    const body = await parseBody(req);
    if (body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Wrong password' });
    return json(res, 200, { 
      users: Object.keys(db.users).length, 
      chats: Object.keys(db.chats).length, 
      groups: Object.keys(db.groups || {}).length,
      channels: Object.keys(db.channels || {}).length, 
      messages: Object.values(db.messages).reduce((a, m) => a + m.length, 0), 
      online: Object.values(db.users).filter(u => u.online).length, 
      nfts: Object.keys(db.nfts || {}).length,
      sessions: Object.keys(db.sessions || {}).length
    });
  }
  
  if (pathname === '/api/admin/full') {
    const body = await parseBody(req);
    if (body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Wrong password' });
    return json(res, 200, {
      users: db.users,
      chats: db.chats,
      groups: db.groups || {},
      channels: db.channels || {},
      messages: db.messages,
      sessions: db.sessions,
      nfts: db.nfts || {},
      nftMarket: db.nftMarket || []
    });
  }
  
  if (pathname === '/api/admin/users') {
    const body = await parseBody(req);
    if (body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Wrong password' });
    return json(res, 200, { users: Object.values(db.users).map(u => ({ ...safeUser(u), banned: u.banned, email: u.email })) });
  }
  
  if (pathname === '/api/admin/messages') {
    const body = await parseBody(req);
    if (body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Wrong password' });
    const allMessages = [];
    for (const [chatId, msgs] of Object.entries(db.messages)) {
      const chat = db.chats[chatId];
      for (const m of msgs.slice(-50)) {
        const fromUser = db.users[m.from] || BOTS[m.from];
        allMessages.push({ id: m.id, chatId, chatName: chat?.participants?.map(p => db.users[p]?.name || BOTS[p]?.name || '?').join(' & ') || chatId, from: fromUser?.name || '?', fromUsername: fromUser?.username || '?', text: m.text || (m.image ? '[Фото]' : (m.voice ? '[Голосовое]' : '')), createdAt: m.createdAt });
      }
    }
    allMessages.sort((a, b) => b.createdAt - a.createdAt);
    return json(res, 200, { messages: allMessages.slice(0, 200) });
  }
  
  if (pathname === '/api/admin/action' && req.method === 'POST') {
    const body = await parseBody(req);
    if (body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Wrong password' });
    
    // User actions
    if (body.userId) {
      const user = db.users[body.userId];
      if (!user && !['editUser'].includes(body.action)) return json(res, 404, { error: 'User not found' });
      
      if (body.action === 'ban') user.banned = true;
      if (body.action === 'unban') user.banned = false;
      if (body.action === 'verify') user.verified = !user.verified;
      if (body.action === 'premium') user.premium = !user.premium;
      if (body.action === 'addStars') user.balance = (user.balance || 0) + (body.amount || 100);
      if (body.action === 'setStars') user.balance = body.amount || 0;
      if (body.action === 'setLevel') { user.level = body.amount || 1; user.xp = 0; }
      if (body.action === 'giveItem') { user.inventory = user.inventory || []; if (!user.inventory.includes(body.item)) user.inventory.push(body.item); }
      if (body.action === 'delete') { delete db.users[body.userId]; }
      if (body.action === 'editUser') {
        if (body.name) user.name = body.name;
        if (body.username) user.username = body.username;
        if (body.bio !== undefined) user.bio = body.bio;
        if (body.avatar !== undefined) user.avatar = body.avatar || null;
        if (body.banner !== undefined) user.banner = body.banner || null;
        if (body.balance !== undefined) user.balance = body.balance;
        if (body.level !== undefined) user.level = body.level;
      }
    }
    
    // Chat actions
    if (body.action === 'deleteChat' && body.chatId) {
      delete db.chats[body.chatId];
      delete db.messages[body.chatId];
    }
    
    // Group actions
    if (body.action === 'deleteGroup' && body.groupId) {
      if (db.groups) delete db.groups[body.groupId];
      delete db.messages[body.groupId];
    }
    if (body.action === 'editGroup' && body.groupId) {
      const group = db.groups?.[body.groupId];
      if (group) {
        if (body.name) group.name = body.name;
        if (body.description !== undefined) group.description = body.description;
        if (body.avatar !== undefined) group.avatar = body.avatar || null;
      }
    }
    if (body.action === 'setGroupAvatar' && body.groupId) {
      const group = db.groups?.[body.groupId];
      if (group) group.avatar = body.avatar || null;
    }
    if (body.action === 'createGroup') {
      if (!db.groups) db.groups = {};
      const group = {
        id: genId(),
        name: body.name || 'Новая группа',
        description: body.description || '',
        avatar: body.avatar || null,
        ownerId: body.ownerId || Object.keys(db.users)[0],
        members: [body.ownerId || Object.keys(db.users)[0]],
        admins: [body.ownerId || Object.keys(db.users)[0]],
        createdAt: Date.now()
      };
      db.groups[group.id] = group;
      db.messages[group.id] = [];
    }
    
    // Channel actions
    if (body.action === 'deleteChannel' && body.channelId) {
      if (db.channels) delete db.channels[body.channelId];
    }
    if (body.action === 'editChannel' && body.channelId) {
      const channel = db.channels?.[body.channelId];
      if (channel) {
        if (body.name) channel.name = body.name;
        if (body.description !== undefined) channel.description = body.description;
        if (body.avatar !== undefined) channel.avatar = body.avatar || null;
      }
    }
    if (body.action === 'setChannelAvatar' && body.channelId) {
      const channel = db.channels?.[body.channelId];
      if (channel) channel.avatar = body.avatar || null;
    }
    if (body.action === 'createChannel') {
      if (!db.channels) db.channels = {};
      const channel = {
        id: genId(),
        name: body.name || 'Новый канал',
        description: body.description || '',
        avatar: body.avatar || null,
        ownerId: body.ownerId || Object.keys(db.users)[0],
        members: [body.ownerId || Object.keys(db.users)[0]],
        roles: { [body.ownerId || Object.keys(db.users)[0]]: 'owner' },
        posts: [],
        chat: [],
        createdAt: Date.now()
      };
      db.channels[channel.id] = channel;
    }
    
    // Message actions
    if (body.action === 'deleteMessage' && body.chatId && body.msgId) {
      const msgs = db.messages[body.chatId];
      if (msgs) {
        const idx = msgs.findIndex(m => m.id === body.msgId);
        if (idx !== -1) msgs.splice(idx, 1);
      }
    }
    
    // NFT actions
    if (body.action === 'deleteNft' && body.username) {
      if (db.nfts) delete db.nfts[body.username];
      db.nftMarket = (db.nftMarket || []).filter(n => n.username !== body.username);
    }
    
    saveDBSync();
    return json(res, 200, { success: true });
  }
  
  if (pathname.match(/^\/api\/admin\/messages\/[^\/]+$/) && req.method === 'DELETE') {
    const body = await parseBody(req);
    if (body.password !== ADMIN_PASSWORD) return json(res, 401, { error: 'Wrong password' });
    const msgId = pathname.split('/')[4];
    for (const msgs of Object.values(db.messages)) { const idx = msgs.findIndex(m => m.id === msgId); if (idx !== -1) { msgs.splice(idx, 1); saveDBSync(); break; } }
    return json(res, 200, { success: true });
  }
  
  // 404 - Route not found
  return json(res, 404, { error: 'API endpoint not found' });
});

// ============ WEBSOCKET ============
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Map(); // userId -> ws
const activeCalls = new Map(); // callId -> { from, to, status }

function broadcast(data, excludeId = null) {
  const msg = JSON.stringify(data);
  wsClients.forEach((ws, id) => { if (id !== excludeId && ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

function sendTo(userId, data) {
  const ws = wsClients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

function broadcastToChannel(channelId, data) {
  const channel = db.channels[channelId];
  if (!channel) return;
  const msg = JSON.stringify(data);
  channel.members.forEach(mId => { const ws = wsClients.get(mId); if (ws?.readyState === WebSocket.OPEN) ws.send(msg); });
}

wss.on('connection', ws => {
  let userId = null;
  
  ws.on('message', async data => {
    try {
      const msg = JSON.parse(data.toString());
      
      // ============ AUTH ============
      if (msg.type === 'auth') {
        const session = db.sessions[msg.token];
        if (!session) return ws.send(JSON.stringify({ type: 'error', error: 'Invalid token' }));
        userId = session.userId;
        const user = db.users[userId];
        if (user) { user.online = true; user.lastActive = Date.now(); }
        wsClients.set(userId, ws);
        ws.send(JSON.stringify({ type: 'auth_success', user: safeUser(user) }));
        broadcast({ type: 'user_online', userId }, userId);
      }
      
      // ============ MESSAGES ============
      else if (msg.type === 'send_message') {
        if (!userId) return;
        const user = db.users[userId];
        
        // Check if it's a group message
        const group = db.groups?.[msg.chatId];
        if (group) {
          if (!group.members?.includes(userId)) return;
          
          const message = { id: genId(), from: userId, text: msg.text, image: msg.image, voice: msg.voice, replyTo: msg.replyTo, createdAt: Date.now() };
          db.messages[msg.chatId] = db.messages[msg.chatId] || [];
          db.messages[msg.chatId].push(message);
          saveDB();
          
          const fullMsg = { ...message, fromUser: safeUser(user) };
          // Send to all group members
          group.members.forEach(mId => {
            const mWs = wsClients.get(mId);
            if (mWs?.readyState === WebSocket.OPEN) {
              mWs.send(JSON.stringify({ type: 'new_message', chatId: msg.chatId, isGroup: true, message: fullMsg }));
            }
          });
          return;
        }
        
        // Private chat
        const chat = db.chats[msg.chatId];
        if (!chat || !chat.participants?.includes(userId)) return;
        
        const message = { id: genId(), from: userId, text: msg.text, image: msg.image, voice: msg.voice, replyTo: msg.replyTo, createdAt: Date.now() };
        db.messages[msg.chatId] = db.messages[msg.chatId] || [];
        db.messages[msg.chatId].push(message);
        
        user.xp = (user.xp || 0) + 1;
        if (user.xp >= user.level * 100) { user.level = (user.level || 1) + 1; user.xp = 0; const bonus = user.level * 10; user.balance = (user.balance || 0) + bonus; ws.send(JSON.stringify({ type: 'level_up', level: user.level, bonus })); }
        saveDB();
        
        const fullMsg = { ...message, fromUser: safeUser(user) };
        chat.participants.forEach(pId => { const pWs = wsClients.get(pId); if (pWs?.readyState === WebSocket.OPEN) pWs.send(JSON.stringify({ type: 'new_message', chatId: msg.chatId, message: fullMsg })); });
        
        const otherId = chat.participants.find(p => p !== userId);
        if (BOTS[otherId]) {
          setTimeout(() => {
            const botResponse = getBotResponse(otherId, msg.text || '');
            const botMsg = { id: genId(), from: otherId, text: botResponse, createdAt: Date.now() };
            db.messages[msg.chatId].push(botMsg);
            saveDB();
            chat.participants.forEach(pId => { const pWs = wsClients.get(pId); if (pWs?.readyState === WebSocket.OPEN) pWs.send(JSON.stringify({ type: 'new_message', chatId: msg.chatId, message: { ...botMsg, fromUser: BOTS[otherId] } })); });
          }, 500 + Math.random() * 1000);
        }
      }
      
      // ============ GROUP CALLS ============
      else if (msg.type === 'start_group_call') {
        if (!userId) return;
        const user = db.users[userId];
        const group = db.groups?.[msg.groupId];
        
        if (!group || !group.members?.includes(userId)) {
          return ws.send(JSON.stringify({ type: 'call_error', error: 'Группа не найдена' }));
        }
        
        // Create or join group call
        let groupCall = db.groupCalls?.[msg.groupId];
        if (!groupCall) {
          if (!db.groupCalls) db.groupCalls = {};
          groupCall = {
            id: genId(),
            groupId: msg.groupId,
            participants: [userId],
            startedAt: Date.now()
          };
          db.groupCalls[msg.groupId] = groupCall;
        } else if (!groupCall.participants.includes(userId)) {
          groupCall.participants.push(userId);
        }
        saveDB();
        
        // Notify all group members
        group.members.forEach(mId => {
          const mWs = wsClients.get(mId);
          if (mWs?.readyState === WebSocket.OPEN) {
            mWs.send(JSON.stringify({
              type: mId === userId ? 'group_call_started' : 'incoming_group_call',
              groupId: msg.groupId,
              groupName: group.name,
              callId: groupCall.id,
              participants: groupCall.participants.map(pId => safeUser(db.users[pId])).filter(Boolean)
            }));
          }
        });
        
        console.log(`📞 Group call started in ${group.name} by ${user.name}`);
      }
      
      else if (msg.type === 'join_group_call') {
        if (!userId) return;
        const groupCall = db.groupCalls?.[msg.groupId];
        const group = db.groups?.[msg.groupId];
        
        if (!groupCall || !group) {
          return ws.send(JSON.stringify({ type: 'call_error', error: 'Звонок не найден' }));
        }
        
        if (!groupCall.participants.includes(userId)) {
          groupCall.participants.push(userId);
          saveDB();
        }
        
        // Notify all participants
        group.members.forEach(mId => {
          const mWs = wsClients.get(mId);
          if (mWs?.readyState === WebSocket.OPEN) {
            mWs.send(JSON.stringify({
              type: 'group_call_updated',
              groupId: msg.groupId,
              participants: groupCall.participants.map(pId => safeUser(db.users[pId])).filter(Boolean)
            }));
          }
        });
      }
      
      else if (msg.type === 'leave_group_call') {
        if (!userId) return;
        const groupCall = db.groupCalls?.[msg.groupId];
        const group = db.groups?.[msg.groupId];
        
        if (!groupCall || !group) return;
        
        groupCall.participants = groupCall.participants.filter(id => id !== userId);
        
        if (groupCall.participants.length === 0) {
          delete db.groupCalls[msg.groupId];
        }
        saveDB();
        
        // Notify all participants
        group.members.forEach(mId => {
          const mWs = wsClients.get(mId);
          if (mWs?.readyState === WebSocket.OPEN) {
            mWs.send(JSON.stringify({
              type: groupCall.participants.length === 0 ? 'group_call_ended' : 'group_call_updated',
              groupId: msg.groupId,
              participants: groupCall.participants.map(pId => safeUser(db.users[pId])).filter(Boolean)
            }));
          }
        });
      }
      
      else if (msg.type === 'group_rtc_offer' || msg.type === 'group_rtc_answer' || msg.type === 'group_rtc_ice') {
        // Forward WebRTC signaling to specific participant in group call
        const targetWs = wsClients.get(msg.to);
        if (targetWs?.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({ ...msg, from: userId }));
        }
      }
      
      // ============ CALLS ============
      else if (msg.type === 'start_call') {
        if (!userId) return;
        const user = db.users[userId];
        const targetUser = db.users[msg.to];
        
        if (!targetUser) {
          return ws.send(JSON.stringify({ type: 'call_error', error: 'Пользователь не найден' }));
        }
        
        // Check if target is online
        if (!wsClients.has(msg.to)) {
          return ws.send(JSON.stringify({ type: 'call_error', error: 'Пользователь не в сети' }));
        }
        
        // Create call
        const callId = genId();
        activeCalls.set(callId, {
          id: callId,
          from: userId,
          to: msg.to,
          status: 'ringing',
          startedAt: Date.now()
        });
        
        // Notify caller that call started
        ws.send(JSON.stringify({ type: 'call_started', callId }));
        
        // Send incoming call to target
        sendTo(msg.to, {
          type: 'incoming_call',
          callId,
          from: userId,
          name: user.name,
          avatar: user.avatar
        });
        
        console.log(`📞 Call started: ${user.name} -> ${targetUser.name} (${callId})`);
      }
      
      else if (msg.type === 'accept_call') {
        if (!userId) return;
        const call = activeCalls.get(msg.callId);
        
        if (!call || call.to !== userId) {
          return ws.send(JSON.stringify({ type: 'call_error', error: 'Звонок не найден' }));
        }
        
        call.status = 'connected';
        
        // Notify caller that call was accepted
        sendTo(call.from, {
          type: 'call_accepted',
          callId: msg.callId
        });
        
        console.log(`✅ Call accepted: ${msg.callId}`);
      }
      
      else if (msg.type === 'end_call') {
        if (!userId) return;
        const call = activeCalls.get(msg.callId);
        
        if (call) {
          const otherId = call.from === userId ? call.to : call.from;
          
          // Notify other party
          sendTo(otherId, {
            type: 'call_ended',
            callId: msg.callId
          });
          
          activeCalls.delete(msg.callId);
          console.log(`📵 Call ended: ${msg.callId}`);
        }
      }
      
      // ============ WebRTC SIGNALING ============
      else if (msg.type === 'rtc_offer') {
        if (!userId) return;
        const call = activeCalls.get(msg.callId);
        
        if (call) {
          const targetId = call.from === userId ? call.to : call.from;
          sendTo(targetId, {
            type: 'rtc_offer',
            callId: msg.callId,
            from: userId,
            offer: msg.offer
          });
          console.log(`📤 RTC Offer sent: ${userId} -> ${targetId}`);
        }
      }
      
      else if (msg.type === 'rtc_answer') {
        if (!userId) return;
        const call = activeCalls.get(msg.callId);
        
        if (call) {
          const targetId = call.from === userId ? call.to : call.from;
          sendTo(targetId, {
            type: 'rtc_answer',
            callId: msg.callId,
            from: userId,
            answer: msg.answer
          });
          console.log(`📥 RTC Answer sent: ${userId} -> ${targetId}`);
        }
      }
      
      else if (msg.type === 'rtc_ice') {
        if (!userId) return;
        const call = activeCalls.get(msg.callId);
        
        if (call) {
          const targetId = call.from === userId ? call.to : call.from;
          sendTo(targetId, {
            type: 'rtc_ice',
            callId: msg.callId,
            from: userId,
            candidate: msg.candidate
          });
        }
      }
      
      // ============ CHANNELS ============
      else if (msg.type === 'channel_message') {
        if (!userId) return;
        const user = db.users[userId];
        const channel = db.channels[msg.channelId];
        if (!channel || !channel.members?.includes(userId)) return;
        
        const message = { id: genId(), from: userId, text: msg.text, image: msg.image, createdAt: Date.now(), likes: 0 };
        if (msg.endpoint === 'post') {
          if (channel.ownerId !== userId) return;
          channel.posts = channel.posts || [];
          channel.posts.push(message);
          broadcastToChannel(msg.channelId, { type: 'channel_post', channelId: msg.channelId, post: { ...message, author: safeUser(user) } });
        } else {
          channel.chat = channel.chat || [];
          channel.chat.push(message);
          broadcastToChannel(msg.channelId, { type: 'channel_chat', channelId: msg.channelId, message: { ...message, author: safeUser(user) } });
        }
        saveDB();
      }
      
      // ============ TYPING ============
      else if (msg.type === 'typing') {
        if (!userId) return;
        const chat = db.chats[msg.chatId];
        if (!chat) return;
        chat.participants.forEach(pId => { if (pId !== userId) { const pWs = wsClients.get(pId); if (pWs?.readyState === WebSocket.OPEN) pWs.send(JSON.stringify({ type: 'typing', chatId: msg.chatId, userId })); } });
      }
      
      else if (msg.type === 'read') {
        const chat = db.chats[msg.chatId];
        if (chat) { chat.unread = chat.unread || {}; chat.unread[userId] = 0; saveDB(); }
      }
      
    } catch (e) { console.error('WS error:', e); }
  });
  
  ws.on('close', () => {
    if (userId) {
      const user = db.users[userId];
      if (user) { user.online = false; saveDB(); }
      wsClients.delete(userId);
      broadcast({ type: 'user_offline', userId });
      
      // End any active calls
      activeCalls.forEach((call, callId) => {
        if (call.from === userId || call.to === userId) {
          const otherId = call.from === userId ? call.to : call.from;
          sendTo(otherId, { type: 'call_ended', callId });
          activeCalls.delete(callId);
        }
      });
    }
  });
});

// ============ START ============
const HOST = process.env.HOST || '0.0.0.0';
const ACTUAL_PORT = process.env.PORT || PORT;

server.listen(ACTUAL_PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     🚀 Mini Messenger v5.4 - Production Ready          ║
╠════════════════════════════════════════════════════════╣
║  📍 Server: http://${HOST}:${ACTUAL_PORT}              ║
║  👑 Admin: /admin                                      ║
║  📂 База: database.json                                ║
╠════════════════════════════════════════════════════════╣
║  ✅ WebRTC Звонки                                      ║
║  ✅ JSON Database + Auto-save                          ║
║  ✅ 7 ботов                                            ║
║  ✅ NFT маркет                                         ║
║  ✅ Telegram-style каналы                              ║
╚════════════════════════════════════════════════════════╝
  `);
});
