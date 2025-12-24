# 💰 Mini Messenger — Гайд по Монетизации и Рекламе

## 📊 Способы Монетизации

### 1. 💎 Внутренняя валюта (Звёзды)

**Уже реализовано:**
- Покупка звёзд через Telegram (кнопка в настройках)
- Ежедневный бонус (+10-70 ⭐)
- Реферальная программа (+100 ⭐ за друга)
- Прокачка уровня (бонус за активность)

**Как добавить реальные платежи:**

```javascript
// 1. Telegram Stars (рекомендуется для MVP)
// В Telegram боте добавьте:
const invoice = {
  chat_id: chatId,
  title: '100 звёзд',
  description: 'Пополнение баланса',
  payload: 'stars_100',
  currency: 'XTR', // Telegram Stars
  prices: [{ label: '100 ⭐', amount: 100 }]
};
bot.sendInvoice(invoice);

// 2. Stripe/PayPal
// Добавьте endpoint:
// POST /api/payment/create
// POST /api/payment/webhook
```

### 2. 📺 Реклама

#### A. Rewarded Ads (Реклама за награду)

**Где показывать:**
- Модал "Получить звёзды" → "Смотреть рекламу" (+15 ⭐)
- После проигрыша в играх ("Посмотри рекламу и получи ещё попытку")
- Перед открытием premium функций

**Реализация с Google AdMob (для мобильных):**

```html
<!-- В index.html -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXX" crossorigin="anonymous"></script>

<script>
// Rewarded ad
async function showRewardedAd() {
  return new Promise((resolve) => {
    // Для веб используйте Video Ads SDK
    // Для мобильных - AdMob/Unity Ads
    
    // Пример с mock:
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999">
        <div style="text-align:center;color:white">
          <div style="font-size:48px;margin-bottom:20px">📺</div>
          <div style="margin-bottom:20px">Реклама...</div>
          <div id="ad-timer">5</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    let seconds = 5;
    const timer = setInterval(() => {
      seconds--;
      document.getElementById('ad-timer').textContent = seconds;
      if (seconds <= 0) {
        clearInterval(timer);
        modal.remove();
        resolve(true); // Награда
      }
    }, 1000);
  });
}

// Использование:
async function earnStars(type) {
  if (type === 'watch') {
    const watched = await showRewardedAd();
    if (watched) {
      user.balance += 15;
      toast('+15 ⭐ за просмотр!', 'success');
    }
  }
}
</script>
```

#### B. Banner Ads (Баннерная реклама)

**Где размещать:**
- Внизу экрана чатов (для бесплатных пользователей)
- В списке чатов каждые 5-10 элементов
- На экране настроек

```html
<!-- Banner внизу -->
<div id="ad-banner" style="position:fixed;bottom:70px;left:0;right:0;height:50px;background:var(--surface2);display:flex;align-items:center;justify-content:center;border-top:1px solid var(--border)">
  <ins class="adsbygoogle"
       style="display:inline-block;width:320px;height:50px"
       data-ad-client="ca-pub-XXXXXXXX"
       data-ad-slot="XXXXXXXX"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>

<script>
// Скрыть для Premium пользователей
function updateAdBanner() {
  const banner = document.getElementById('ad-banner');
  if (user?.premium) {
    banner.style.display = 'none';
  }
}
</script>
```

#### C. Native Ads (Нативная реклама)

В списке чатов как "спонсируемый чат":

```javascript
function renderChats(chats) {
  let html = '';
  
  chats.forEach((chat, i) => {
    html += renderChatItem(chat);
    
    // Каждые 7 чатов показываем рекламу
    if (i > 0 && i % 7 === 0 && !user?.premium) {
      html += `
        <div class="chat-item sponsored" onclick="openSponsoredLink()">
          <div class="avatar" style="background:linear-gradient(135deg,#f59e0b,#ef4444)">📢</div>
          <div class="chat-item-info">
            <div class="chat-item-top">
              <span class="chat-name">Реклама</span>
              <span class="chat-time">Спонсор</span>
            </div>
            <div class="chat-last">Ваша реклама может быть здесь</div>
          </div>
        </div>
      `;
    }
  });
  
  return html;
}
```

### 3. 👑 Premium Подписка

**Текущие преимущества (можно расширить):**
- Без рекламы
- Эксклюзивные стикеры
- Больше обоев
- Галочка верификации
- Увеличенный лимит файлов
- Приоритетная поддержка

**Добавить:**
- Расширенная статистика
- Голосовые сообщения до 5 минут
- Видеосообщения HD
- Кастомные темы
- API доступ

### 4. 🎨 NFT Username Marketplace

**Уже реализовано:**
- Покупка уникальных username за звёзды
- Продажа username другим пользователям
- Комиссия платформы (можно добавить 5-10%)

```javascript
// Добавить комиссию при продаже:
if (pathname === '/api/nft/buy' && req.method === 'POST') {
  // ...
  const commission = Math.floor(nft.price * 0.1); // 10%
  const sellerAmount = nft.price - commission;
  
  seller.balance += sellerAmount;
  // commission идёт платформе
}
```

---

## 🛠️ Рекламные Платформы

### Для Web:
1. **Google AdSense** - самый популярный
2. **Yandex Advertising Network** - для РУ аудитории
3. **PropellerAds** - Push и PopUnder
4. **Media.net** - контекстная реклама

### Для Mobile:
1. **Google AdMob** - лидер рынка
2. **Unity Ads** - хорошие выплаты
3. **AppLovin** - высокий eCPM
4. **Yandex Mobile Ads** - для РУ

### Rewarded Video:
1. **ironSource** - лучший для игр
2. **Vungle** - качественное видео
3. **Tapjoy** - офферволл

---

## 📱 Интеграция Telegram Payments

```javascript
// telegram-bot.js
// Добавьте обработку платежей:

bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', async (msg) => {
  const payment = msg.successful_payment;
  const userId = msg.from.id;
  
  // Найти пользователя в БД и начислить звёзды
  const telegramUser = telegramUsers[userId];
  if (telegramUser?.messengerUserId) {
    // Вызвать API мессенджера для начисления
    await fetch('http://localhost:3000/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'YOUR_ADMIN_PASSWORD',
        userId: telegramUser.messengerUserId,
        action: 'addStars',
        amount: payment.total_amount // Telegram Stars = наши звёзды
      })
    });
    
    bot.sendMessage(userId, `✅ Спасибо за покупку!\n+${payment.total_amount} ⭐ зачислено на ваш счёт!`);
  }
});

// Команда для покупки
bot.onText(/\/buy/, async (msg) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '💎 100 ⭐ — 100 Stars', callback_data: 'buy_100' }],
      [{ text: '💎 500 ⭐ — 400 Stars', callback_data: 'buy_500' }],
      [{ text: '💎 1000 ⭐ — 700 Stars', callback_data: 'buy_1000' }]
    ]
  };
  
  await bot.sendMessage(msg.chat.id, '💰 Выберите пакет звёзд:', { reply_markup: keyboard });
});

bot.on('callback_query', async (query) => {
  if (query.data.startsWith('buy_')) {
    const amount = parseInt(query.data.split('_')[1]);
    const prices = { 100: 100, 500: 400, 1000: 700 };
    
    await bot.sendInvoice(query.message.chat.id, {
      title: `${amount} звёзд`,
      description: `Пополнение баланса в Mini Messenger`,
      payload: `stars_${amount}`,
      currency: 'XTR',
      prices: [{ label: `${amount} ⭐`, amount: prices[amount] }]
    });
  }
});
```

---

## 📈 Метрики для Аналитики

Добавьте отслеживание:

```javascript
// analytics.js
const analytics = {
  track(event, data = {}) {
    // Google Analytics
    gtag('event', event, data);
    
    // Или свой сервер
    fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({ event, data, timestamp: Date.now() })
    });
  }
};

// Использование:
analytics.track('purchase', { item: 'premium', price: 500 });
analytics.track('ad_view', { type: 'rewarded', completed: true });
analytics.track('daily_bonus', { streak: 5, earned: 50 });
```

---

## 💡 Идеи для Дополнительной Монетизации

1. **Эксклюзивные стикерпаки** — 30-100 ⭐
2. **Голосовые эффекты** — изменение голоса в звонках
3. **Профиль++** — анимированные аватары, рамки
4. **Расширенная история** — поиск по всем сообщениям
5. **Автоответчик** — бот отвечает когда вы оффлайн
6. **Статистика чатов** — кто больше пишет, графики
7. **Расписание сообщений** — отложенная отправка
8. **Каналы Premium** — больше подписчиков, аналитика
9. **API для разработчиков** — создание ботов
10. **Верификация бизнеса** — галочка для компаний

---

## 🚀 Быстрый Старт

1. Зарегистрируйтесь в Google AdSense/AdMob
2. Создайте рекламные блоки
3. Добавьте код в index.html
4. Настройте Telegram бота для платежей
5. Добавьте аналитику
6. Тестируйте и оптимизируйте!

---

**Важно:** Не перегружайте приложение рекламой — это отпугнёт пользователей. 
Лучший баланс: rewarded ads + premium подписка.
