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
  private readonly twitchChannels = [
    26640321, // Leaflit
    780426582, // Angel's Sword Guild
  ];
  private readonly twitchClientId: string;
  private readonly twitchClipRefreshRate = 30000;
  private readonly twitchClientSecret: string;

  private lastCheckDate: Date;
  private twitchAccessToken: string | undefined;

  constructor(
    discordClient: Discord.Client,
    clientId: string,
    clientSecret: string,
    database: Database,
  ) {
    super(discordClient);
    this.database = database;
    this.twitchClientId = clientId;
    this.twitchClientSecret = clientSecret;

    this.getTwitchAccessToken().catch(Shubot.log.error);

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
    const row = this.database.prepare(`SELECT date FROM ${this.databaseTableName}`).get() as {
      date: string;
    };
    this.lastCheckDate = row && row.date ? new Date(row.date) : new Date();

    setInterval(this.checkTwitchClips.bind(this), this.twitchClipRefreshRate);
  }

  private validateTwitchAccessToken(): Promise<boolean> {
    return axios
      .get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          Authorization: `OAuth ${this.twitchAccessToken}`,
        },
      })
      .then((res) => {
        return res.status === 200;
      });
  }

  private getTwitchAccessToken(): Promise<boolean> {
    return axios
      .post('https://id.twitch.tv/oauth2/token', {
        client_id: this.twitchClientId,
        client_secret: this.twitchClientSecret,
        grant_type: 'client_credentials',
      })
      .then((res) => {
        if (res.status !== 200) return false;
        this.twitchAccessToken = res.data.access_token;
        return true;
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

  private getTwitchClipsAfter(date: Date, broadcaster: number): Promise<TwitchAPI.Clip[]> {
    return axios
      .get(
        `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcaster}&started_at=${date.toISOString()}&ended_at=${new Date().toISOString()}`,
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
    this.validateTwitchAccessToken()
      .then((valid) => {
        return new Promise<void>((resolve, reject) => {
          if (valid) resolve();
          this.getTwitchAccessToken().then((acquiredToken) => {
            if (acquiredToken) {
              resolve();
            } else {
              reject('Unable to acquire access token');
            }
          });
        });
      })
      .then(() => {
        for (const broadcaster of this.twitchChannels) {
          this.getTwitchClipsAfter(this.lastCheckDate, broadcaster).then((clips) => {
            // check for new clips
            for (let i = 0; i < clips.length; i++) {
              Shubot.log.info(
                `Acquired Twitch clip from ${clips[i].broadcaster_name} '${clips[i].title}' ${clips[i].url}`,
              );
            }
            clips.forEach((clip) => {
              this.sendDiscordMessage(this.discordClipChannelId, clip.url);
            });
            // update the last time we checked for clips
            this.upsertDate();
          });
        }
      })
      .catch(Shubot.log.error);
  }
}
