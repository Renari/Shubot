import anidb from '../anidb';
import Discord from 'discord.js';
import messageHandler from './message-handler';
import SaberAlter from '../index';

export default class anidbHandler extends messageHandler {
  private readonly anidbClient: anidb;

  constructor() {
    super();
    this.anidbClient = new anidb();
  }

  handle(message: Discord.Message): void {
    const anidbAnimeMatches = this.match(message.content);
    anidbAnimeMatches.forEach((match) => {
      this.anidbClient
        .getShowData(match[1])
        .then((data) => {
          return message.reply({
            embeds: [anidb.generateDiscordEmbed(data.anime)],
          });
        })
        .catch(SaberAlter.log.error);
    });
  }

  protected match(message: string): RegExpMatchArray[] {
    return [...message.matchAll(anidb.animeUrlRegex)];
  }
}
