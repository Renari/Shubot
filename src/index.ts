import Discord from 'discord.js';
import logger from './logger';
import nedb from 'nedb';
import path from 'path';

// message handlers
import anidbHandler from './message-handlers/anidb-handler';
import customHandler from './message-handlers/custom-handler';
import messageHandler from './message-handlers/message-handler';
import pixivHandler from './message-handlers/pixiv-handler';

// notification handlers
import twitchNotification from './notification-handlers/twitch-notification';
import youtubeNotification from './notification-handlers/youtube-notification';

export default class Shubot {
  public static readonly version: string = '<version>';
  private readonly discordClient: Discord.Client;
  private readonly messageHandlers: messageHandler[] = [];
  private readonly database: nedb;

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV === 'debug',
  });

  constructor() {
    this.database = new nedb({
      filename: path.resolve('database.db'),
      autoload: true,
    });

    this.discordClient = new Discord.Client();

    this.discordClient.once('ready', () => this.ready());

    // connect to discord
    this.discordClient.login(process.env.DISCORD_TOKEN).catch(Shubot.log.error);
  }

  private ready(): void {
    Shubot.log.info('discord connection successful');

    // which message handlers we're loading
    this.messageHandlers.push(new anidbHandler());
    this.messageHandlers.push(new customHandler(this.discordClient, this.database));
    this.messageHandlers.push(new pixivHandler(this.discordClient));

    this.discordClient.on('message', this.messageHandler.bind(this));

    // post new twitch clips in discord
    if (process.env.TWITCH_CLIENT_ID) {
      new twitchNotification(this.discordClient, process.env.TWITCH_CLIENT_ID);
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
    this.messageHandlers.forEach(handler => {
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
