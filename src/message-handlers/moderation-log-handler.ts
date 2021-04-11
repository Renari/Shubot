import Discord, { MessageAttachment } from 'discord.js';
import Shubot from '..';

export default class moderationLogHandler {
  private readonly discordClient;
  private readonly channel;
  private readonly guildId = '717558249435562035';

  constructor(discordClient: Discord.Client) {
    this.discordClient = discordClient;
    const guild = this.discordClient.guilds.cache.get(this.guildId);
    this.channel = guild?.channels.cache.get('830136765850845204');
    if (this.channel) {
      discordClient.on('messageDelete', (message) => {
        this.processMessage(message).then(this.messageDelete.bind(this));
      });
      discordClient.on('messageUpdate', (oldMessage, newMessage) => {
        this.processMessage(oldMessage).then((fullOldMessage) => {
          this.processMessage(newMessage).then((fullNewMessage) => {
            this.messageEdit(fullOldMessage, fullNewMessage);
          });
        });
      });
    } else {
      Shubot.log.info('Unable to find moderator log channel, not monitoring.');
    }
  }

  private processMessage(
    message: Discord.Message | Discord.PartialMessage,
  ): Promise<Discord.Message> {
    return new Promise<Discord.Message>((resolve) => {
      if (message.partial) {
        message.fetch().then((message) => {
          resolve(message);
        });
      } else {
        resolve(message);
      }
    });
  }

  private static processAttachments(message: Discord.Message): string {
    let attachmentsDescription = '';
    if (message.attachments.size > 0) {
      attachmentsDescription = '\nAttachments:';
      for (const [, attachment] of message.attachments) {
        attachmentsDescription += `\n${attachment.url}`;
      }
    }
    return attachmentsDescription;
  }

  private static processEmbeds(oldMessage: Discord.Message, newMessage: Discord.Message): string {
    if (oldMessage.embeds.length > newMessage.embeds.length) {
      return this.processEmbed(oldMessage);
    }
    return '';
  }

  private static processEmbed(message: Discord.Message): string {
    let embedDescription = '';
    if (message.embeds.length > 0) {
      embedDescription = '\nEmbeds:';
      for (let i = 0; i < message.embeds.length; i++) {
        // we are inserting a zero width space here to prevent closing of the code block
        // noinspection TypeScriptValidateJSTypes
        embedDescription +=
          '\n```json\n' +
          JSON.stringify(message.embeds[i].toJSON()).replace(/`/g, '`\u200B') +
          '```';
      }
    }
    return embedDescription;
  }

  private messageDelete(message: Discord.Message): void {
    let description =
      'Message by <@' + message.author + '> deleted from <#' + message.channel + '>';
    if (message.content) {
      description += '```' + message.content + '```';
    }
    description += moderationLogHandler.processEmbed(message);
    const embed = new Discord.MessageEmbed().setDescription(description).setColor('#E74C3C');
    (this.channel as Discord.TextChannel).send(embed).catch(Shubot.log.error);
  }

  private messageEdit(oldMessage: Discord.Message, newMessage: Discord.Message): void {
    // ignore messages that only have embeds added
    if (
      oldMessage.content == newMessage.content &&
      oldMessage.attachments.size == newMessage.attachments.size &&
      oldMessage.embeds.length <= newMessage.embeds.length
    )
      return;

    let description =
      '[Message](https://discord.com/channels/' +
      this.guildId +
      '/' +
      oldMessage.channel.id +
      '/' +
      oldMessage.id +
      ') by <@' +
      oldMessage.author +
      '> edited in <#' +
      oldMessage.channel +
      '>\nFrom: ';
    if (oldMessage.content) {
      description += '```' + oldMessage.content + '```';
    }
    description += moderationLogHandler.processAttachments(oldMessage);
    description += moderationLogHandler.processEmbeds(oldMessage, newMessage);
    description += '\nTo:';
    if (newMessage.content) {
      description += '```' + newMessage.content + '```';
    }
    description += moderationLogHandler.processAttachments(newMessage);
    const embed = new Discord.MessageEmbed().setDescription(description).setColor('#FFFF00');
    if (description.length < 2048) {
      (this.channel as Discord.TextChannel).send(embed).catch(Shubot.log.error);
    } else {
      embed.setDescription('Maximum message length exceeded, attaching as file.');
      embed.attachFiles([new MessageAttachment(new Buffer(description), 'messagedata.txt')]);
    }
  }
}
