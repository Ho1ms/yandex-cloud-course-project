// Импортируем модули
const { Telegraf } = require('telegraf');
const axios = require('axios');

// Создаём объект класса Telegraf и передаём туда BOT_TOKEN
const bot = new Telegraf(process.env.BOT_TOKEN);

// Задаём поведение бота при получении комады /start от пользователя
bot.start((ctx) => {
    ctx.reply(`<b>👋 Привет ${ctx.from.username}!</b>\nЯ не просто бот, Я - твой финансовый помощник!\n\n<b>📕 Инструкция по использованию:</b>\n1) Для получения курса валют используй команду <code>/currency</code>\n2) Для конвертации - команду <code>/convert {sum} {from} {to}</code>`, { parse_mode: 'HTML' });
});

// Задаём обработчики команды /currency, которая отправляет запрос на API с курсами валют, после чего возвращает пользователю текущий курс USD, EUR и CNY.
bot.command('currency', async (ctx) => {
    try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/RUB');
        const rates = response.data.rates;
        ctx.reply(`Курс Рубля на сегодня.\n <b>USD: ${Math.round(1 / rates.USD, 2)}\n EUR: ${Math.round(1 / rates.EUR, 2)}\n CNY: ${Math.round(1 / rates.CNY, 2)}</b>`, { parse_mode: 'HTML' });
    } catch (error) {
        ctx.reply('Произошла ошибка при получении курса валют :(');
    }
});

// Задаём обработчики команды /convert, которая поможет пользователю узнать сумму в заданой валюте при переводе её в желаемую.
bot.command('convert', async (ctx) => {
    const commandText = ctx.message.text.replace('/convert', '').trim();
    const [sum, from, to] = commandText.split(' ');

    try {
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`);
        const rates = response.data.rates;
        const convertedSum = sum * rates[to];
        ctx.reply(`При конвертации <b>${sum} ${from}</b> в <b>${to}</b> вы получите: <b>${convertedSum} ${to}</b>`, { parse_mode: 'HTML' });
    } catch (error) {
        ctx.reply('Произошла ошибка при конвертации валюты');
    }
});

// Экспортируем обработчик событий
module.exports.handler = async function (event, context) {
    const message = JSON.parse(event['messages'][0]['details']['message']['body']);
    await bot.handleUpdate(message);
    return {
        statusCode: 500,
        body: event.string,
    };
};
