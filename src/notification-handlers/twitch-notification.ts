import axios from 'axios';
import { Database } from 'better-sqlite3';
import Discord from 'discord.js';
import notificationHandler from './notification-handler';
import Shubot from '..';

// interfaces
import { TwitchAPI } from '@/interfaces/twitchapi';

export default class twitchNotification extends notificationHandler {
  private readonly database: Database;
  private readonly databaseTableName = 'lastTwitchClipCheckDate';
  private readonly discordClipChannelId: string = '717558882976661636';
  private readonly twitchAccessToken: string;
  private readonly twitchClientId: string;
  private readonly twitchClipRefreshRate = 30000;

  private lastCheckDate: Date;

  constructor(
    discordClient: Discord.Client,
    clientId: string,
    accessToken: string,
    database: Database,
  ) {
    super(discordClient);
    this.database = database;
    this.twitchClientId = clientId;
    this.twitchAccessToken = accessToken;

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

    setInterval(this.checkTwitchClips.bind(this), this.twitchClipRefreshRate);
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

  private getTwitchClipsAfter(date: Date): Promise<TwitchAPI.Clip[]> {
    return axios
      .get(
        `https://api.twitch.tv/helix/clips?broadcaster_id=26640321&started_at=${date.toISOString()}&ended_at=${new Date().toISOString()}`,
        {
          headers: {
            Accept: 'application/vnd.twitchtv.v5+json',
            'Client-ID': this.twitchClientId,
            Authorization: `Bearer ${this.twitchAccessToken}`,
          },
        },
      )
      .then((res) => {
        // sort the clips by date
        const clips: TwitchAPI.Clip[] = res.data.data || [];
        clips.sort((first, second) => {
          const firstDate = new Date(first.created_at).getTime();
          const secondDate = new Date(second.created_at).getTime();
          return -(firstDate - secondDate);
        });
        return clips;
      });
  }

  private checkTwitchClips(): void {
    this.getTwitchClipsAfter(this.lastCheckDate)
      .then((clips) => {
        // check for new clips
        for (let i = 0; i < clips.length; i++) {
          Shubot.log.info(`Found Twitch clip: '${clips[i].title}'`);
        }
        clips.forEach((clip) => {
          this.sendDiscordMessage(
            this.discordClipChannelId,
            `https://clips.twitch.tv/${clip.slug}`,
          );
        });
        // update the last time we checked for clips
        this.upsertDate();
      })
      .catch(Shubot.log.error);
  }
}
