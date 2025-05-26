import { GuildMember, VoiceChannel, VoiceState, type VoiceBasedChannel } from "discord.js";

import { bot } from "./bot";
import { config } from "./config";

const IGNORE_CACHE = new WeakMap<VoiceChannel | VoiceBasedChannel, boolean>();
const IGNORED = new WeakSet<VoiceState>();

function isIgnore(channel: VoiceChannel | VoiceBasedChannel) {
  var output = false;
  return IGNORE_CACHE.get(channel) ?? (
    IGNORE_CACHE.set(channel, output = (
      config.ignore.channels.includes(channel.id) && (
        !channel.parentId || config.ignore.category.includes(channel.parentId)
      )
    )),
    output
  );
}

function isCanSpeak(channel: VoiceChannel | VoiceBasedChannel, member: GuildMember) {
  return isIgnore(channel) || channel.permissionsFor(member).has('Speak');
}

async function loop() {
  for (const [, guild] of bot.guilds.cache) {
    for (const [, channel] of guild.channels.cache) {
      if (!(channel instanceof VoiceChannel)) continue;

      for (const [, member] of channel.members) {
        const canSpeak = isCanSpeak(channel, member);
        if (!member.voice) continue;
        if (member.voice.serverMute === !canSpeak) {
          IGNORED.delete(member.voice);
          continue;
        }
        if (IGNORED.has(member.voice)) continue;
        await member.voice.setMute(!canSpeak).catch(console.error);
      }
    }
  }
}

bot.on('voiceStateUpdate', (old, state) => {
  IGNORED.delete(old);
  IGNORED.delete(state);

  if (!old.channel || !state.channel) return;
  if (!old.member || !state.member) return;
  if (old.channel !== state.channel) return;
  if (typeof old.serverMute !== 'boolean' || typeof state.serverMute !== 'boolean') return;
  const canSpeak = isCanSpeak(state.channel, state.member);

  if (old.serverMute !== state.serverMute) {
    if (state.serverMute !== !canSpeak) {
      IGNORED.add(state);
    }
  }

});

while (true) {
  await loop();
  await new Promise(resolve => setTimeout(resolve, 50));
}