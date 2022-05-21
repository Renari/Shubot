import { Database } from 'better-sqlite3';
import Discord from 'discord.js';
import notificationHandler from './notification-handler';
import Shubot from '..';
import youtube from '../youtube';

export default class youtubeNotification extends notificationHandler {
  private readonly database: Database;
  private readonly databaseTableName = 'latestYoutubeVideoDate';
  private readonly discordChannelId: string = '725449150573051926';
  private readonly youtubeInstance: youtube;
  private readonly youtubeVideoRefreshRate = 3600000; // once per hour

  private lastCheckDate: Date;

  constructor(
    discordClient: Discord.Client,
    channelId: string,
    apiKey: string,
    database: Database,
  ) {
    super(discordClient);
    this.database = database;
    this.youtubeInstance = new youtube(apiKey, channelId);

    // make sure our database table exists
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${this.databaseTableName}
         (
             date
             TEXT
             NOT
             NULL
         );`,
      )
      .run();

    // get the last time we checked for clips
    const row = this.database.prepare(`SELECT date FROM ${this.databaseTableName}`).get();
    this.lastCheckDate = row && row.date ? new Date(row.date) : new Date();

    setInterval(this.checkForNewYoutubeVideos.bind(this), this.youtubeVideoRefreshRate);
  }

  private checkForNewYoutubeVideos(): void {
    // check for newer videos
    this.youtubeInstance.GetVideosAfterDate(this.lastCheckDate.toISOString()).then((videos) => {
      if (videos && videos.items) {
        // post the oldest videos first
        for (let i = videos.items.length - 1; i >= 0; i--) {
          const video = videos.items[i].id?.videoId;
          // post new videos to discord
          const title = videos.items[i].snippet?.title ? videos.items[i].snippet?.title : video;
          Shubot.log.info(`Found YouTube video ${title}`);
          this.sendDiscordMessage(this.discordChannelId, `https://youtu.be/${video}`);
        }
        // update our latest video date
        this.upsertDate();
      }
    });
  }

  private upsertDate(): void {
    this.lastCheckDate = new Date();
    this.database
      .prepare(`UPDATE ${this.databaseTableName} SET date = ?;`)
      .run(this.lastCheckDate.toISOString());
    this.database
      .prepare(`INSERT INTO ${this.databaseTableName} (date) SELECT ? WHERE (SELECT Changes() = 0)`)
      .run(this.lastCheckDate.toISOString());
  }
}
