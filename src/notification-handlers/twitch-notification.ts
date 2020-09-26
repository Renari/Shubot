import axios from 'axios';
import Discord from 'discord.js';
import notificationHandler from './notification-handler';
import Shubot from '..';

// interfaces
import { TwitchAPI } from '../interfaces/twitchapi';
import lastTwitchClipCheckDate from '../interfaces/lastTwitchClipCheckDate';

export default class twitchNotification extends notificationHandler {
  private readonly database: Nedb;
  private readonly databaseType = 'lastTwitchClipCheckDate';
  private readonly discordClipChannelId: string = '717558882976661636';
  private readonly twitchClientId: string;
  private readonly twitchClipRefreshRate = 30000;

  constructor(discordClient: Discord.Client, clientId: string, database: Nedb) {
    super(discordClient);
    this.database = database;
    this.twitchClientId = clientId;

    setInterval(this.checkTwitchClips.bind(this), this.twitchClipRefreshRate);
  }

  private getTwitchClips(): Promise<TwitchAPI.Clip[]> {
    return axios
      .get('https://api.twitch.tv/kraken/clips/top?channel=Leaflit&period=day&limit=100', {
        headers: {
          Accept: 'application/vnd.twitchtv.v5+json',
          'Client-ID': this.twitchClientId,
        },
      })
      .then(res => {
        // sort the clips by date
        const clips: TwitchAPI.Clip[] = res.data.clips || [];
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
        this.getLastClipDate().then(lastClipDate => {
          const clipstopost: TwitchAPI.Clip[] = [];
          // check for new clips
          for (let i = 0; i < clips.length; i++) {
            // since clips is sorted by date ignore older clips
            if (new Date(clips[i].created_at).getTime() <= lastClipDate.getTime()) {
              break;
            } else {
              Shubot.log.info(`Found Twitch clip: '${clips[i].title}'`);
              clipstopost.push(clips[i]);
            }
          }
          clipstopost.forEach(clip => {
            this.sendDiscordMessage(
              this.discordClipChannelId,
              `https://clips.twitch.tv/${clip.slug}`,
            );
          });
          // store the latest date as the newest clip or the current time if there are no clips
          this.database.update(
            { type: this.databaseType, date: lastClipDate.toISOString() },
            {
              type: this.databaseType,
              date:
                clips.length > 0
                  ? new Date(clips[0].created_at).toISOString()
                  : new Date().toISOString(),
            },
            { upsert: true },
          );
        });
      })
      .catch(Shubot.log.error);
  }

  private getLastClipDate(): Promise<Date> {
    return new Promise((resolve, reject) => {
      this.database.findOne<lastTwitchClipCheckDate>({ type: this.databaseType }, (err, result) => {
        if (err) reject(err);
        resolve(result ? new Date(result.date) : new Date());
      });
    });
  }
}
