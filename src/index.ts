import Database from 'better-sqlite3';
import Discord, { ClientOptions, Intents } from 'discord.js';
import logger from './logger';

// message handlers
import anidbHandler from './message-handlers/anidb-handler';
import customHandler from './message-handlers/custom-handler';
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
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
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
    this.messageHandlers.push(new customHandler(this.database));

    this.discordClient.on('message', this.messageHandler.bind(this));

    // handle message deletion
    new moderationLogHandler(this.discordClient);

    // post new twitch clips in discord
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_APP_ACCESS_TOKEN) {
      new twitchNotification(
        this.discordClient,
        process.env.TWITCH_CLIENT_ID,
        process.env.TWITCH_APP_ACCESS_TOKEN,
        this.database,
      );
    }
    // post new youtube videos in discord
    if (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID) {
      new youtubeNotification(
        this.discordClient,
        process.env.YOUTUBE_CHANNEL_ID,
        process.env.YOUTUBE_API_KEY,
        this.database,
      );
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

  private shutdown(code = 0): void {
    this.discordClient.destroy();
    process.exit(code);
  }
}

if (process.argv[2] == '--version') {
  console.log(Shubot.version); // eslint-disable-line no-console
} else {
  new Shubot();
}
