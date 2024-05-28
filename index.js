// Импортируем модули
const { session, Telegraf, Markup, Telegram } = require('telegraf');
const axios = require('axios');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const XMLParser = require('xml2js').parseString;

// Создаём объект класса Telegraf и передаём туда BOT_TOKEN
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session())

const currency_codes = {
    USD: "R01235",
    EUR: "R01239",
    CNY: "R01375",
};

const currencies = ['RUB', 'USD', 'EUR', 'CNY']
// Задаём поведение бота при получении комады /start от пользователя
bot.start((ctx) => {
    ctx.reply(`<b>👋 Привет ${ctx.from.username}!</b>\nЯ не просто бот, Я - твой финансовый помощник!\n\n<b>📕 Инструкция по использованию:</b>\n1) Для получения курса валют используй команду <code>/currency</code>\n2) Для конвертации - команду <code>/convert</code>\n3) Для получения истории курса валют - команду <code>/history</code>`, { parse_mode: 'HTML' });
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
    ctx.session.Messages = [ctx.message.message_id]
    ctx.session.isConvert = true
    ctx.session.convertStep = 1
    msg = await ctx.reply('Укажите сумму, которую хотите конвертировать, либо нажмите Отменить для отмены.', 
    
    Markup.inlineKeyboard([ Markup.callbackButton('Отменить', 'clear') ]).extra())
    ctx.session.Messages.push(msg.message_id)
});

bot.action("clear", (ctx) => {
    ctx.session = null    
    ctx.session.Messages.forEach(m => {
        ctx.deleteMessage(m)
    });
})

bot.hears(/\d/, async (ctx, next) => {
    if (!ctx.session.isConvert || ctx.session.convertStep !== 1) {
        return await next()
    }
    ctx.session.convertStep = 2
    ctx.session.convertSum = ctx.message.text

    await ctx.deleteMessage()
    await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.Messages[1],null, `Выберите валюту которую вы хотите конвертировать в колличестве ${ctx.message.text} единиц`)
    
    const buttons = currencies.map(currency => [Markup.callbackButton(currency, currency)])
    buttons.push([Markup.callbackButton('Отменить', 'clear')])

    await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.session.Messages[1], null,  Markup.inlineKeyboard(buttons))

})

bot.action(/\w{3}/, async (ctx, next) => {
    if (!ctx.session.isConvert || ctx.session.convertStep !== 2) {
        return await next()
    }
    ctx.session.convertCurrency = ctx.callbackQuery.data
    ctx.session.convertStep = 3

    await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.Messages[1],null, `Выберите валюту для конвертации ${ctx.session.convertSum} ${ctx.session.convertCurrency}`)
    
    const buttons = currencies.map(currency => {
        if (currency != ctx.callbackQuery.data) {
            return [Markup.callbackButton(currency, currency)]
        }
    }).filter(i => i != undefined)
    buttons.push([Markup.callbackButton('Отменить', 'clear')])

    await ctx.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.session.Messages[1], null,  Markup.inlineKeyboard(buttons))
})

bot.action(/\w{3}/, async (ctx, next) => {
    if (!ctx.session.isConvert || ctx.session.convertStep !== 3) {
        return await next()
    }
    const {convertSum, convertCurrency} = ctx.session;
    const to = ctx.callbackQuery.data;

    try {
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${convertCurrency}`);
        const rates = response.data.rates;
        const convertedSum = convertSum * rates[to];
        ctx.reply(`При конвертации <b>${convertSum} ${convertCurrency}</b> в <b>${to}</b> вы получите: <b>${convertedSum} ${to}</b>`, { parse_mode: 'HTML' });
    } catch (error) {
        ctx.reply('Произошла ошибка при конвертации валюты');
    }
    
    ctx.session.Messages.forEach(m => {
        ctx.deleteMessage(m)
    });
    ctx.session = null
})

bot.command('history', async (ctx) => {
    ctx.deleteMessage(ctx.message.message_id)
    await ctx.reply('Выберите валюту для получения истории курса за неделю.', Markup.inlineKeyboard(currencies.slice(1).map(currency => [Markup.callbackButton(currency, 'history-'+currency)])).extra())
})



const renderChart = async (data) => {
    const configuration = {
        type: 'line',
        data: data
    };
    const width = 400; //px
    const height = 400; //px
    const backgroundColour = 'white'; // Uses https://www.w3schools.com/tags/canvas_fillstyle.asp
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour});
    const image = await chartJSNodeCanvas.renderToBuffer(configuration);

    return image;
};

bot.action(/history-/, async (ctx) => {
    const currency = ctx.callbackQuery.data.split('-')[1]
    
    const d = new Date()
    const d_e = ((d.getDate() < 10)?"0":"") + d.getDate() +"/"+(((d.getMonth()+1) < 10)?"0":"") + (d.getMonth()+1) +"/"+ d.getFullYear();
    const a = new Date(new Date() - 30*24*60*60*1000)
    const d_s = ((a.getDate() < 10)?"0":"") + a.getDate() +"/"+(((a.getMonth()+1) < 10)?"0":"") + (a.getMonth()+1) +"/"+ a.getFullYear();
    
    const label = [];
    const values = [];

    try {
        const response = await axios.get(`https://cbr.ru/scripts/XML_dynamic.asp?date_req1=${d_s}&date_req2=${d_e}&VAL_NM_RQ=${currency_codes[currency]}`);
        let xml = response.data
        XMLParser(xml, (err, res) => {
            const json = JSON.parse(JSON.stringify(res, null, 4))
            for (let val in json.ValCurs.Record) {
                label.push(json.ValCurs.Record[val]['$']['Date'])
                values.push(parseFloat(json.ValCurs.Record[val].Value[0]))
            }
        })
    } catch (error) {
        ctx.reply('Произошла ошибка при запросе');
    }
    
    const data = {
        labels: label, // Даты
        datasets: [{
            label: `Курс ${currency} за месяц`,
            data: values, // Цены
            fill: false,
            borderColor: 'blue'
        }]
    };
    const chartImage = await renderChart(data);
    ctx.replyWithPhoto( { source: chartImage });
})
// Экспортируем обработчик событий
module.exports.handler = async function (event, context) {
    const message = JSON.parse(event['messages'][0]['details']['message']['body']);
    await bot.handleUpdate(message);
    return {
        statusCode: 500,
        body: event.string,
    };
};
