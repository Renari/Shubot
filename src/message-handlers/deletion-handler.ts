import Discord from 'discord.js';
import Shubot from '..';

export default class deletionHandler {
  private readonly discordClient;
  private readonly channel;

  constructor(discordClient: Discord.Client) {
    this.discordClient = discordClient;
    const guild = this.discordClient.guilds.cache.get('717558249435562035');
    this.channel = guild?.channels.cache.get('830136765850845204');
    if (this.channel) {
      discordClient.on('messageDelete', this.processMessage.bind(this));
    } else {
      Shubot.log.info('Unable to find moderator log channel, not monitoring.');
    }
  }

  private processMessage(message: Discord.Message | Discord.PartialMessage): void {
    if (message.partial) {
      message.fetch().then(this.messageDelete);
    } else {
      this.messageDelete(message);
    }
  }

  private messageDelete(message: Discord.Message): void {
    let description = 'Message by <@' +
      message.author +
      '> deleted from <#' +
      message.channel +
      '>';
    if (message.content) {
      description += '```' + message.content + '```';
    }
    if (message.attachments.size > 0) {
      description += '\nAttachments:';
      for (const [, attachment] of message.attachments) {
        description += `\n${attachment.url}`;
      }
    }
    const embed = new Discord.MessageEmbed().setDescription(description).setColor('#E74C3C');
    (this.channel as Discord.TextChannel).send(embed).catch(Shubot.log.error);
  }
}
