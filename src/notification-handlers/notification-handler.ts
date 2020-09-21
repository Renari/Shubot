import Shubot from '..';
import Discord from 'discord.js';

export default class notificationHandler {
  protected readonly discordClient: Discord.Client;
  private readonly discordGuildId: string = '717558249435562035';

  constructor(discordClient: Discord.Client) {
    this.discordClient = discordClient;
  }

  protected sendDiscordMessage(channelId: string, message: string): void {
    // post the new clips in discord
    const guild = this.discordClient.guilds.cache.get(this.discordGuildId);
    const channel = guild?.channels.cache.get(channelId);
    if (channel?.type === 'text') {
      (channel as Discord.TextChannel).send(message).catch(Shubot.log.error);
    } else {
      Shubot.log.error('Unable to find clips channel');
    }
  }
}
