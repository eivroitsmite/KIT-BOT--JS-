const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
const moment = require('moment-timezone');
dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const POST_TIME = '13:00'; 
const TIMEZONE = 'America/New_York'; 


const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'KRW', 'BRL', 'FEIN', 'STAR SHARDS'];


let isMarketRunning = false;
let stockInterval;
let customStocks = []; // Array to store custom stocks entered by the user

function scheduleStockPosts(channel) {
    const now = moment().tz(TIMEZONE); 
    const [postHour, postMinute] = POST_TIME.split(':').map(Number);
    let nextPostTime = moment.tz(`${now.format('YYYY-MM-DD')} ${POST_TIME}`, TIMEZONE);

    // If time has passed, set it for the next day
    if (now.isAfter(nextPostTime)) {
        nextPostTime = nextPostTime.add(1, 'days');
    }

    const timeUntilPost = nextPostTime.diff(now); // Time until next post in milliseconds
    console.log(`Stock posting scheduled in ${timeUntilPost / 1000 / 60} minutes.`);

    // Post stock updates daily
    setTimeout(() => {
        postStockUpdate(channel);
        stockInterval = setInterval(() => {
            postStockUpdate(channel);
        }, 24 * 60 * 60 * 1000); // 24 hours
    }, timeUntilPost);
}

// Function to post a daily stock update with the date in DD/MM format
function postStockUpdate(channel) {
    if (!isMarketRunning || customStocks.length === 0) {
        stopMarket(channel);
        return;
    }

 
    const stockDate = moment().tz(TIMEZONE); // Get today's date
    const formattedDate = stockDate.format('DD/MM');

    // Find the corresponding stock for today
    const stockForToday = customStocks.find((stock, index) => {
        const stockDate = moment().tz(TIMEZONE).add(index, 'days').format('DD/MM');
        return stockDate === formattedDate;
    });

    if (!stockForToday) {
        stopMarket(channel);
        return;
    }

    const { amount, currency } = stockForToday;

 
    const roleIdToPing = '1244051080699052064'; //Bot pings this role for each new post

    
    const formattedTitle = `<a:sparkle2:826557383853211709> VOTW ${stockDate.format('MMMM')} ${stockDate.format('Do')}`;

    const embed = new EmbedBuilder()
        .setTitle(formattedTitle)
        .setDescription(`On **${formattedDate}**, the stock price is **${amount} ${currency}**`)
        .setColor('#FF92C3')
        .setTimestamp();

  
    channel.send({ content: `<@&${roleIdToPing}>`, embeds: [embed] });
}

// Function to display the full stock list with start dates
function showStockList(channel) {
    if (customStocks.length === 0) {
        channel.send('No stocks have been entered yet.');
        return;
    }

    const stockList = customStocks.map((stock, index) => {
        // Get the starting date for each stock in the format DD/MM
        const stockDate = moment().tz(TIMEZONE).add(index, 'days');
        const formattedDate = stockDate.format('DD/MM');

        return `**${formattedDate}**: ${stock.amount} ${stock.currency}`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('Custom Stock List')
        .setDescription(stockList)
        .setColor('#FF92C3')
        .setTimestamp();

    channel.send({ embeds: [embed] });
}

function startMarket(channel, customInput) {
    customStocks = parseCustomStocks(customInput);
    if (customStocks.length === 0) {
        channel.send('No valid stocks provided. Please enter them in the format: `500 USD` or `1000 EUR`.');
        return;
    }

    isMarketRunning = true;
    channel.send('Stock market has started! Posting daily custom stock values.');
    showStockList(channel); // Show the full list upon starting
    scheduleStockPosts(channel);
}

// Function to stop the market
function stopMarket(channel) {
    isMarketRunning = false;
    clearInterval(stockInterval);
    channel.send('The stock market has ended. Use `/startstock` to restart it!');
}

// Function to parse custom stock input with currency validation
function parseCustomStocks(input) {
    const normalizedInput = input.replace(/\s+/g, ' ').trim();
    const stockEntries = normalizedInput.split(' ');

    const stocks = [];

    for (let i = 0; i < stockEntries.length; i++) {
        const stock = stockEntries[i].trim();
        const match = stock.match(/^(\d+)\s?([A-Za-z]+)$/);
        if (match) {
            const parsedAmount = parseInt(match[1], 10);
            const currency = match[2].toUpperCase();

            if (validCurrencies.includes(currency)) {
                stocks.push({ amount: parsedAmount, currency });
            } else {
                console.error(`Invalid currency detected: '${currency}'`);
            }
        } else {
            console.error(`Invalid stock format or unsupported currency: '${stock}'`);
        }
    }

    return stocks;
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const GUILD_ID = '1029914925214212137'; 
    const commands = [
        {
            name: 'startstock',
            description: 'Starts the stock market with custom values',
            options: [
                {
                    name: 'customstocks',
                    type: 3, 
                    description: 'Enter stock values in the format: "500 USD\\n1000 EUR" or "500USD 1000EUR"',
                    required: true,
                },
            ],
        },
        {
            name: 'stopstock',
            description: 'Stops the stock market',
        },
    ];

    try {
        await client.guilds.cache.get(GUILD_ID)?.commands.set(commands);
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});


client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'startstock') {
        if (isMarketRunning) {
            await interaction.reply('Stock market is already running!');
        } else {
            const input = options.getString('customstocks');
            console.log('Received input:', input); // Debugging log
            const channel = interaction.channel;
            startMarket(channel, input);
            await interaction.reply('Stock market has been started with custom values!');
        }
    } else if (commandName === 'stopstock') {
        if (!isMarketRunning) {
            await interaction.reply('The stock market is not currently running.');
        } else {
            stopMarket(interaction.channel);
            await interaction.reply('Stock market has been stopped.');
        }
    }
});

// Register slash commands: /startstock and /stopstock
client.on('ready', async () => {
    const data = [
        {
            name: 'startstock',
            description: 'Starts the stock market with custom values',
            options: [
                {
                    name: 'customstocks',
                    type: 3, 
                    description: 'Enter stock values in the format: "500 USD\\n1000 EUR" or "500USD 1000EUR"',
                    required: true,
                },
            ],
        },
        {
            name: 'stopstock',
            description: 'Stops the stock market',
        },
    ];

    const commands = await client.application.commands.set(data);
    console.log(`Registered commands: ${commands.map(c => c.name).join(', ')}`);
});

client.login(process.env.BOT_TOKEN);
