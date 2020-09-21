import axios from 'axios';
import Discord from 'discord.js';
import notificationHandler from './notification-handler';
import Shubot from '..';

// interfaces
import { TwitchAPI } from '../interfaces/twitchapi';

export default class twitchNotification extends notificationHandler {
  private readonly discordClipChannelId: string = '717558882976661636';
  private readonly twitchClientId: string;
  private readonly twitchClipRefreshRate = 30000;
  private lastClipDate: Date = new Date(0);

  constructor(discordClient: Discord.Client, clientId: string) {
    super(discordClient);
    this.twitchClientId = clientId;

    // TODO: change this to store the clip date in the database
    this.getTwitchClips()
      .then(clips => {
        if (clips.length > 0) {
          this.lastClipDate = new Date(clips[0].created_at);
        } else {
          // there are no clips, set the last clip date to now
          this.lastClipDate = new Date();
        }
        setInterval(this.checkTwitchClips.bind(this), this.twitchClipRefreshRate);
      })
      .catch(Shubot.log.error);
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
        const clipstopost: TwitchAPI.Clip[] = [];
        // check for new clips
        for (let i = 0; i < clips.length; i++) {
          // since clips is sorted by date ignore older clips
          if (new Date(clips[i].created_at).getTime() <= this.lastClipDate.getTime()) {
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
        // update the latest clip to the newest one
        if (clips.length > 0) {
          this.lastClipDate = new Date(clips[0].created_at);
        }
      })
      .catch(Shubot.log.error);
  }
}
