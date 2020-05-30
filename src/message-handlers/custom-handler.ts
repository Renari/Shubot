import anidb from '../anidb';
import Discord, { DMChannel, GuildMember, NewsChannel, TextChannel } from 'discord.js';
import messageHandler from './message-handler';
import nedb from 'nedb';
import Shubot from '../index';

interface command {
  name: string;
  response: string;
}

export default class customHandler extends messageHandler {
  private readonly database: nedb;
  private commands: Map<string, string> = new Map();
  private commandString = '';

  constructor(discordClient: Discord.Client, database: nedb) {
    super();
    this.database = database;
    this.database.find<command>({ type: 'customcommand' }, (err, commands) => {
      for (let i = 0; i < commands.length; i++) {
        this.commands.set(commands[i].name, commands[i].response);
      }
      this.generateCommandRegex();
    });
  }

  protected match(message: string): RegExpMatchArray[] {
    const match = message.match(new RegExp(`^(!(?:${this.commandString}))\s?(.+)?$`, 'i'));
    return match ? [match] : [];
  }

  public handle(message: Discord.Message): void {
    const match = this.match(message.content);
    if (match.length) {
      const command = match[0][1];
      const args = match[0][2] ? customHandler.parseArgs(match[0][2]) : [];
      switch (command) {
        case '!commandadd':
          // this command requires permissions
          if (!this.checkPermissions(message.member, message.channel)) return;
          // if we don't have 2 args there's either no command or no response
          if (args.length !== 2)
            message.channel
              .send('```!commandadd <command name> <response>```')
              .catch(Shubot.log.error);
          else {
            this.database.update(
              { type: 'customcommand', name: args[0] },
              { type: 'customcommand', name: args[0], response: args[1] },
              { upsert: true },
            );
            this.commands.set(args[0], args[1]);
            this.generateCommandRegex();
            message.react('✅').catch(Shubot.log.error);
          }
          break;
        case '!commandremove':
          // this command requires permissions
          if (!this.checkPermissions(message.member, message.channel)) return;
          if (args.length !== 1)
            message.channel.send('```!commandremove <command name>```').catch(Shubot.log.error);
          else {
            this.database.remove({ type: 'customcommand', name: args[0] });
            this.commands.delete(args[0]);
            this.generateCommandRegex();
            message.react('✅').catch(Shubot.log.error);
          }
          break;
        default:
          const response = this.commands.get(command.substr(1));
          if (response) {
            // handle anidb links in custom commands
            const anidbMatch = Array.from(response.matchAll(anidb.animeUrlRegex));
            if (anidbMatch) {
              new anidb().getShowData(anidbMatch[0][1]).then((data) => {
                const embed = anidb.generateDiscordEmbed(data.anime)
                message.channel.send(response, { embed }).catch(Shubot.log.error);
              })
            } else {
              message.channel.send(response).catch(Shubot.log.error);
            }
          }
      }
    }
  }

  private checkPermissions(user: GuildMember | null, channel: TextChannel | DMChannel | NewsChannel): boolean {
    const hasPermissions =
      // if the user is not set this is probably a DM
      user !== null && (
      // user is an admin
      user.hasPermission(Discord.Permissions.FLAGS.ADMINISTRATOR) ||
      // user is a moderator
      user.roles.cache.has('424706015842402316'));
    if (!hasPermissions) {
      // to add a command you must be in the server and have the correct permissions
      channel
        .send("Sorry, you don't have the required permissions to run this command.")
        .catch(Shubot.log.error);
    }
    return hasPermissions;
  }

  private static parseArgs(command: string): string[] {
    const split = [...command.matchAll(/[^\s"']+|"([^"]*)"|'([^']*)'/g)];
    const args = [];
    for (const arg of split) {
      if (arg[1]) {
        // we had a quoted argument
        args.push(arg[1]);
      } else {
        // we had an unquoted parameter
        args.push(arg[0]);
      }
    }
    return args;
  }

  private generateCommandRegex(): void {
    this.commandString = '(?:commandadd)|(?:commandremove)';
    for (const [key] of this.commands) {
      this.commandString += `|(?:${key})`;
    }
  }
}
