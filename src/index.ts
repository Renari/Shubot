import Database from 'better-sqlite3';
import Discord, { ClientOptions, GatewayIntentBits } from 'discord.js';
import logger from './logger';

// message handlers
import anidbHandler from './message-handlers/anidb-handler';
import moderationLogHandler from './message-handlers/moderation-log-handler';
import messageHandler from './message-handlers/message-handler';

// notification handlers
import twitchNotification from './notification-handlers/twitch-notification';
import youtubeNotification from './notification-handlers/youtube-notification';

export default class Shubot {
  public static readonly version: string = '<version>';
  public readonly database: Database.Database = new Database('database.db', {});
  public readonly discordClient: Discord.Client = new Discord.Client({
    intents: [
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.MessageContent,
    ],
  } as ClientOptions);
  private readonly messageHandlers: messageHandler[] = [];

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV === 'debug',
  });

  constructor() {
    this.discordClient.once('ready', this.ready.bind(this));

    // connect to discord
    if (process.env.DISCORD_TOKEN) {
      this.discordClient.login(process.env.DISCORD_TOKEN).catch(Shubot.log.error);
    }
  }

  private ready(): void {
    Shubot.log.info('discord connection successful');

    // which message handlers we're loading
    this.messageHandlers.push(new anidbHandler());

    this.discordClient.on('messageCreate', this.messageHandler.bind(this));

    // handle message deletion
    new moderationLogHandler(this.discordClient);

    // post new YouTube videos in discord
    if (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID) {
      const channels = process.env.YOUTUBE_CHANNEL_ID.includes(',')
        ? process.env.YOUTUBE_CHANNEL_ID.split(',')
        : [process.env.YOUTUBE_CHANNEL_ID];

      for (const channel of channels) {
        new youtubeNotification(
          this.discordClient,
          channel,
          process.env.YOUTUBE_API_KEY,
          this.database,
        );
      }
    }
  }

  private messageHandler(message: Discord.Message): void {
    // ignore own messages
    if (this.discordClient.user && message.author.equals(this.discordClient.user)) return;
    // run the message through each message handler
    this.messageHandlers.forEach((handler) => {
      handler.handle(message);
    });
  }
}

if (process.argv[2] == '--version') {
  console.log(Shubot.version); // eslint-disable-line no-console
} else {
  new Shubot();
}
