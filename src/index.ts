import Discord from 'discord.js';
import logger from './logger';
import axios from 'axios';
import { TwitchAPI } from './twitchapi';

export default class Shubot {
  private readonly discordClient: Discord.Client;
  private readonly discordGuildId: string = '422420722649137162';
  private readonly discordClipChannelId: string = '700248116607189033';
  private readonly refreshRate = 10000;
  private lastClipDate: Date = new Date(0);

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV === 'debug',
  });

  constructor() {
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
    setInterval(this.checkTwitchClips.bind(this), this.refreshRate);
  }

  private getTwitchClips(): Promise<TwitchAPI.Clip[]> {
    return axios
      .get('https://api.twitch.tv/kraken/clips/top?channel=Shurelia&period=day&limit=100', {
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

new Shubot();
