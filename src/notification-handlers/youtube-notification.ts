import Discord from 'discord.js';
import notificationHandler from './notification-handler';
import Shubot from '..';
import youtube from '../youtube';

// interfaces
import latestYoutubeVideoDate from '../interfaces/latestYoutubeVideoDate';

export default class youtubeNotification extends notificationHandler {
  private readonly database: Nedb;
  private readonly databaseType = 'latestYoutubeVideoDate';
  private readonly discordChannelId: string = '725449150573051926';
  private readonly youtubeInstance: youtube;
  private readonly youtubeVideoRefreshRate = 30000;

  constructor(discordClient: Discord.Client, channelId: string, apiKey: string, database: Nedb) {
    super(discordClient);
    this.database = database;
    this.youtubeInstance = new youtube(apiKey, channelId);
    setInterval(this.checkForNewYoutubeVideos.bind(this), this.youtubeVideoRefreshRate);
  }

  private checkForNewYoutubeVideos(): void {
    this.getLastVideoDate().then(date => {
      if (!date) {
        // we've never got a youtube video before, try to get the latest one
        this.youtubeInstance.GetLatestVideoDate().then(date => {
          if (date) {
            // store this date in the database
            this.database.update(
              { type: this.databaseType },
              { type: this.databaseType, date },
              { upsert: true },
            );
          }
        });
      } else {
        // check for newer videos
        this.youtubeInstance.GetVideosAfterDate(date).then(videos => {
          if (videos && videos.items) {
            // post the oldest videos first
            for (let i = videos.items.length - 1; i >= 0; i--) {
              const video = videos.items[i].id?.videoId;
              if (video && videos.items[0].snippet?.publishedAt != date) {
                // post new videos to discord
                const title = videos.items[i].snippet?.title
                  ? videos.items[i].snippet?.title
                  : video;
                Shubot.log.info(`Found YouTube video ${title}`);
                this.sendDiscordMessage(this.discordChannelId, `https://youtu.be/${video}`);
              }
            }
            // update our latest video date
            this.database.update(
              { type: this.databaseType, date: date },
              { type: this.databaseType, date: videos.items[0].snippet?.publishedAt },
              { upsert: true },
            );
          }
        });
      }
    });
  }

  private getLastVideoDate(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.database.findOne<latestYoutubeVideoDate>({ type: this.databaseType }, (err, result) => {
        if (err) reject(err);
        resolve(result ? result.date : null);
      });
    });
  }
}
