import axios from 'axios';
import Discord from 'discord.js';
import logger from './logger';
import nedb from 'nedb';
import path from 'path';
import { TwitchAPI } from './twitchapi';

// message handlers
import anidbHandler from './message-handlers/anidb-handler';
import customHandler from './message-handlers/custom-handler';
import messageHandler from './message-handlers/message-handler';

export default class Shubot {
  public static readonly version: string = '<version>';
  private readonly discordClient: Discord.Client;
  private readonly discordGuildId: string = '422420722649137162';
  private readonly discordClipChannelId: string = '700248116607189033';
  private readonly twitchClipRefreshRate = 30000;
  private lastClipDate: Date = new Date(0);
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
    this.getTwitchClips()
      .then(clips => {
        if (clips.length > 0) {
          this.lastClipDate = new Date(clips[0].created_at);
        } else {
          // there are no clips, set the last clip date to now
          this.lastClipDate = new Date();
        }
      })
      .catch(err => {
        Shubot.log.error(err);
        this.shutdown(1);
      });
  }

  private ready(): void {
    Shubot.log.info('discord connection successful');

    // which message handlers we're loading
    this.messageHandlers.push(new anidbHandler());
    this.messageHandlers.push(new customHandler(this.discordClient, this.database));

    this.discordClient.on('message', this.messageHandler.bind(this));

    setInterval(this.checkTwitchClips.bind(this), this.twitchClipRefreshRate);
  }

  private messageHandler(message: Discord.Message): void {
    // ignore own messages
    if (this.discordClient.user && message.author.equals(this.discordClient.user)) return;
    // run the message through each message handler
    this.messageHandlers.forEach(handler => {
      handler.handle(message);
    });
  }

  private getTwitchClips(): Promise<TwitchAPI.Clip[]> {
    return axios
      .get('https://api.twitch.tv/kraken/clips/top?channel=Leaflit&period=day&limit=100', {
        headers: {
          Accept: 'application/vnd.twitchtv.v5+json',
          'Client-ID': process.env.TWITCH_CLIENT_ID,
        },
      })
      .then(res => {
        // sort the clips by date
        const clips: TwitchAPI.Clip[] = res.data.clips;
        clips.sort((first, second) => {
          const firstDate = new Date(first.created_at).getTime();
          const secondDate = new Date(second.created_at).getTime();
          return -(firstDate - secondDate);
        });
        return clips;
      });
  }

  private checkTwitchClips(): void {
    this.getTwitchClips()
      .then(clips => {
        const clipstopost: TwitchAPI.Clip[] = [];
        // check for new clips
        for (let i = 0; i < clips.length; i++) {
          // since clips is sorted by date ignore older clips
          if (new Date(clips[i].created_at).getTime() <= this.lastClipDate.getTime()) {
            break;
          } else {
            Shubot.log.info(`Found '${clips[i].title}'`);
            clipstopost.push(clips[i]);
          }
        }
        // post the new clips in discord
        const guild = this.discordClient.guilds.cache.get(this.discordGuildId);
        const channel = guild?.channels.cache.get(this.discordClipChannelId);
        if (channel?.type === 'text') {
          clipstopost.forEach(clip => {
            (channel as Discord.TextChannel)
              .send(`https://clips.twitch.tv/${clip.slug}`)
              .catch(Shubot.log.error);
          });
        } else {
          Shubot.log.error('Unable to find clips channel');
        }
        // update the latest clip to the newest one
        if (clips.length > 0) {
          this.lastClipDate = new Date(clips[0].created_at);
        }
      })
      .catch(Shubot.log.error);
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
