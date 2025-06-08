const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const { TOKEN } = require('./Api_teg/token');

let users = require('./users.json');
let waitingForPercent = {}; // хранит, что бот ждет от юзера ручной ввод процента
let lastMessageId = {}; // для удаления старых сообщений
// === Переводы для сообщений ===
const translations = {
  saved: {
    ru: '✅ Сохранено!',
    ua: '✅ Збережено!',
    en: '✅ Saved!'
  },
  interval: {
    ru: 'Интервал',
    ua: 'Інтервал',
    en: 'Interval'
  },
  threshold: {
    ru: 'Порог',
    ua: 'Поріг',
    en: 'Threshold'
  },
  choose_arbitrage_interval: {
    ru: '⏱ Выберите интервал для арбитража:',
    ua: '⏱ Оберіть інтервал для арбітражу:',
    en: '⏱ Choose interval for arbitrage:'
},
enter_arbitrage_threshold: {
    ru: '✏️ Введите порог (%) арбитража от 1 до 10 (например: 1.5):',
    ua: '✏️ Введіть поріг (%) арбітражу від 1 до 10 (наприклад: 1.5):',
    en: '✏️ Enter arbitrage threshold (%) from 1 to 10 (e.g.: 1.5):'
},
choose_dump_interval: {
    ru: '⏱ Выберите интервал между сигналами:',
    ua: '⏱ Оберіть інтервал між сигналами:',
    en: '⏱ Choose interval between signals:'
},
enter_dump_threshold: {
    ru: '✏️ Введите порог изменения цены вручную (от 1 до 10%):',
    ua: '✏️ Введіть поріг зміни ціни вручну (від 1 до 10%):',
    en: '✏️ Enter manual price change threshold (from 1 to 10%):'
},
invalid_format_threshold: {
    ru: '🚫 Неверный формат. Введите число от 1 до 10. Например: 1.5',
    ua: '🚫 Невірний формат. Введіть число від 1 до 10. Наприклад: 1.5',
    en: '🚫 Invalid format. Enter a number from 1 to 10. Example: 1.5'
 }
};

const bot = new TelegramBot(TOKEN, { polling: true });

bot.setMyCommands([
  { command: '/start', description: 'Запустити бота' }
]);

// === Удаление предыдущего сообщения ===
function deleteLastMessage(chatId) {
  if (lastMessageId[chatId]) {
    bot.deleteMessage(chatId, lastMessageId[chatId]).catch(() => {});
    lastMessageId[chatId] = null;
  }
}

// === Получение локализованного главного меню ===
function getMainMenu(chatId) {
  const lang = users[chatId]?.lang || 'ua';
  if (lang === 'ru') {
    return {
      reply_markup: {
        keyboard: [
          ['📊 Управление', '📈 Биржи'],
          ['👤 Доступ', 'ℹ️ Информация']
        ],
        resize_keyboard: true
      }
    };
  } else if (lang === 'en') {
    return {
      reply_markup: {
        keyboard: [
          ['📊 Management', '📈 Exchanges'],
          ['👤 Access', 'ℹ️ Information']
        ],
        resize_keyboard: true
      }
    };
  } else {
    return {
      reply_markup: {
        keyboard: [
          ['📊 Управління', '📈 Біржі'],
          ['👤 Доступ', 'ℹ️ Інформація']
        ],
        resize_keyboard: true
      }
    };
  }
}

// === Получение локализованного меню Управления ===
function getManagementMenu(chatId) {
  const lang = users[chatId]?.lang || 'ua';
  if (lang === 'ru') {
    return [
      [{ text: '⚙️ Dump/Pump', callback_data: 'manage_dump' }],
      [{ text: '🤝 Арбитраж', callback_data: 'manage_arbitrage' }],
      [{ text: '🌐 Язык', callback_data: 'manage_language' }],
      [{ text: '⬅️ Назад', callback_data: 'back_to_main' }]
    ];
  } else if (lang === 'en') {
    return [
      [{ text: '⚙️ Dump/Pump', callback_data: 'manage_dump' }],
      [{ text: '🤝 Arbitrage', callback_data: 'manage_arbitrage' }],
      [{ text: '🌐 Language', callback_data: 'manage_language' }],
      [{ text: '⬅️ Back', callback_data: 'back_to_main' }]
    ];
  } else {
    return [
      [{ text: '⚙️ Dump/Pump', callback_data: 'manage_dump' }],
      [{ text: '🤝 Арбітраж', callback_data: 'manage_arbitrage' }],
      [{ text: '🌐 Мова', callback_data: 'manage_language' }],
      [{ text: '⬅️ Назад', callback_data: 'back_to_main' }]
    ];
  }
}

// === Главное меню ===
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  if (!users[chatId]) {
    users[chatId] = { exchanges: {}, lang: 'ua' };
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
  }

  deleteLastMessage(chatId);

  bot.sendMessage(chatId, '👋 Ласкаво просимо! Оберіть розділ:', getMainMenu(chatId)).then(sentMessage => {
    lastMessageId[chatId] = sentMessage.message_id;
  });
});

// === Обработка кнопок ===
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // === Биржи ===
  if (text === '📈 Біржі' || text === '📈 Биржи' || text === '📈 Exchanges') {
    if (!users[chatId]) users[chatId] = { exchanges: {} };

    deleteLastMessage(chatId);

    const exchanges = ['BINANCE', 'BYBIT', 'BITGET', 'MEXC', 'OKX'];
    const keyboard = exchanges.map(name => {
      const checked = users[chatId].exchanges[name] ? '✅' : '❌';
      return [{ text: `${checked} ${name}`, callback_data: `toggle_${name}` }];
    });

    keyboard.push([{ text: '⬅️ Назад', callback_data: 'back_to_main' }]);

    bot.sendMessage(chatId, 'Оберіть біржі для сигналів:', {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }).then(sentMessage => {
      lastMessageId[chatId] = sentMessage.message_id;
    });

    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
  }

  // === Управление ===
  if (text === '📊 Управління' || text === '📊 Управление' || text === '📊 Management') {
    deleteLastMessage(chatId);

    bot.sendMessage(chatId, 'Оберіть розділ для налаштування:', {
      reply_markup: {
        inline_keyboard: getManagementMenu(chatId)
      }
    }).then(sentMessage => {
      lastMessageId[chatId] = sentMessage.message_id;
    });
  }

  // === Заглушки для Доступ и Информация ===
  if (text === '👤 Доступ' || text === '👤 Access' || text === 'ℹ️ Інформація' || text === 'ℹ️ Информация' || text === 'ℹ️ Information') {
    deleteLastMessage(chatId);

    const keyboard = [
      [{ text: '⬅️ Назад', callback_data: 'back_to_main' }]
    ];

    bot.sendMessage(chatId, 'Поки що цей розділ у розробці.', {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }).then(sentMessage => {
      lastMessageId[chatId] = sentMessage.message_id;
    });
  }
});

// === Обработка callback_query ===
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // === Назад в главное меню ===
  if (data === 'back_to_main') {
    deleteLastMessage(chatId);

    bot.sendMessage(chatId, '👋 Ласкаво просимо! Оберіть розділ:', getMainMenu(chatId)).then(sentMessage => {
      lastMessageId[chatId] = sentMessage.message_id;
    });
  }

  // === Язык ===
  if (data === 'manage_language') {
    deleteLastMessage(chatId);

    const langKeyboard = [
      [{ text: 'Русский', callback_data: 'set_lang_ru' }],
      [{ text: 'Українська', callback_data: 'set_lang_ua' }],
      [{ text: 'English', callback_data: 'set_lang_en' }],
      [{ text: '⬅️ Назад', callback_data: 'back_to_manage' }]
    ];

    bot.sendMessage(chatId, '🌐 Оберіть мову / Choose language:', {
      reply_markup: {
        inline_keyboard: langKeyboard
      }
    }).then(sentMessage => {
      lastMessageId[chatId] = sentMessage.message_id;
    });
  }

  if (data === 'back_to_manage') {
    deleteLastMessage(chatId);

    bot.sendMessage(chatId, 'Оберіть розділ для налаштування:', {
      reply_markup: {
        inline_keyboard: getManagementMenu(chatId)
      }
    }).then(sentMessage => {
      lastMessageId[chatId] = sentMessage.message_id;
    });
  }

  if (data.startsWith('set_lang_')) {
    const langCode = data.replace('set_lang_', '');
    if (!users[chatId]) users[chatId] = {};
    users[chatId].lang = langCode;
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));

    bot.sendMessage(chatId, `✅ Мова змінена на ${langCode === 'ru' ? 'Русский' : langCode === 'ua' ? 'Українська' : 'English'}`);
  }
  // === Dump/Pump ===
  if (data === 'manage_dump') {
    deleteLastMessage(chatId);

    const intervalButtons = [
      [{ text: '10с', callback_data: 'interval_10' }, { text: '30с', callback_data: 'interval_30' }],
      [{ text: '1м', callback_data: 'interval_60' }, { text: '1м30с', callback_data: 'interval_90' }],
      [{ text: '2м', callback_data: 'interval_120' }, { text: '2м30с', callback_data: 'interval_150' }],
      [{ text: '3м', callback_data: 'interval_180' }, { text: '3м30с', callback_data: 'interval_210' }],
      [{ text: '4м', callback_data: 'interval_240' }, { text: '4м30с', callback_data: 'interval_270' }],
      [{ text: '5м', callback_data: 'interval_300' }],
      [{ text: '⬅️ Назад', callback_data: 'back_to_manage' }]
    ];

    const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, translations.choose_dump_interval[lang], {

      reply_markup: { inline_keyboard: intervalButtons }
    }).then(sentMessage => {
      lastMessageId[chatId] = sentMessage.message_id;
    });
  }

  if (data.startsWith('interval_')) {
    const seconds = parseInt(data.replace('interval_', ''), 10);
    if (!users[chatId]) users[chatId] = {};
    if (!users[chatId].dump_pump) users[chatId].dump_pump = {};

    users[chatId].dump_pump.interval = seconds;
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));

    waitingForPercent[chatId] = true;
    const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, translations.enter_dump_threshold[lang]);
  }

  // === Manage Arbitrage ===
if (data === 'manage_arbitrage') {
  deleteLastMessage(chatId);

  const intervalButtons = [
    [{ text: '10с', callback_data: 'arb_interval_10' }, { text: '30с', callback_data: 'arb_interval_30' }],
    [{ text: '1м', callback_data: 'arb_interval_60' }, { text: '1м30с', callback_data: 'arb_interval_90' }],
    [{ text: '2м', callback_data: 'arb_interval_120' }, { text: '2м30с', callback_data: 'arb_interval_150' }],
    [{ text: '3м', callback_data: 'arb_interval_180' }, { text: '3м30с', callback_data: 'arb_interval_210' }],
    [{ text: '4м', callback_data: 'arb_interval_240' }, { text: '4м30с', callback_data: 'arb_interval_270' }],
    [{ text: '5м', callback_data: 'arb_interval_300' }],
    [{ text: '⬅️ Назад', callback_data: 'back_to_manage' }]
  ];

  const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, translations.choose_arbitrage_interval[lang], {

    reply_markup: { inline_keyboard: intervalButtons }
  }).then(sentMessage => {
    lastMessageId[chatId] = sentMessage.message_id;
  });
}
// === Arb interval ===
if (data.startsWith('arb_interval_')) {
  const seconds = parseInt(data.replace('arb_interval_', ''), 10);

  if (!users[chatId]) users[chatId] = {};
  if (!users[chatId].arbitrage) users[chatId].arbitrage = {};

  users[chatId].arbitrage.interval = seconds;
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));

const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, translations.enter_arbitrage_threshold[lang]);

  users[chatId].awaitingArbitragePercent = true;
}

  // === Toggle биржи ===
  if (data.startsWith('toggle_')) {
    const name = data.replace('toggle_', '');
    if (!users[chatId]) users[chatId] = { exchanges: {} };

    users[chatId].exchanges[name] = !users[chatId].exchanges[name];
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));

    const exchanges = ['BINANCE', 'BYBIT', 'BITGET', 'MEXC', 'OKX'];
    const keyboard = exchanges.map(name => {
      const checked = users[chatId].exchanges[name] ? '✅' : '❌';
      return [{ text: `${checked} ${name}`, callback_data: `toggle_${name}` }];
    });

    keyboard.push([{ text: '⬅️ Назад', callback_data: 'back_to_main' }]);

    bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
  }

  bot.answerCallbackQuery(query.id);
});

// === Обработка ввода процента ===
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
// === Arbitrage Percent ===
if (users[chatId]?.awaitingArbitragePercent) {
  const value = parseFloat(text.replace(',', '.'));

  if (!isNaN(value) && value >= 1 && value <= 10) {
    if (!users[chatId].arbitrage) users[chatId].arbitrage = {};
    users[chatId].arbitrage.percent = value;
    users[chatId].awaitingArbitragePercent = false;

    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));

  const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, `${translations.saved[lang]}\n${translations.interval[lang]}: ${users[chatId].arbitrage.interval} сек\n${translations.threshold[lang]}: ${value}%`);

  } else {
  const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, translations.invalid_format_threshold[lang]);
  }

  return; // Чтобы дальше не шло
}

  if (waitingForPercent[chatId]) {
    const percent = parseFloat(text.replace(',', '.'));

    if (isNaN(percent) || percent < 1 || percent > 10) {
    const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, translations.invalid_format_threshold[lang]);
      return;
    }

    if (!users[chatId]) users[chatId] = {};
    if (!users[chatId].dump_pump) users[chatId].dump_pump = {};

    users[chatId].dump_pump.percent = percent;
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));

    delete waitingForPercent[chatId];

  const lang = users[chatId]?.lang || 'ua';
bot.sendMessage(chatId, `${translations.saved[lang]}\n${translations.interval[lang]}: ${users[chatId].dump_pump.interval} сек\n${translations.threshold[lang]}: ${percent}%`);

  }
});
