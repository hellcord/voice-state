import { VoiceChannel, VoiceState } from "discord.js";

import { bot } from "./bot";
import { config } from "./config";

const ignore = new WeakSet<VoiceState>();

async function loop() {
  for (const [, guild] of bot.guilds.cache) {
    for (const [, channel] of guild.channels.cache) {
      if (!(channel instanceof VoiceChannel)) continue;
      const isIgnore = config.ignore.channels.includes(channel.id) && (
        !channel.parentId || config.ignore.category.includes(channel.parentId)
      );
      for (const [, member] of channel.members) {
        const canSpeak = isIgnore || channel.permissionsFor(member).has('Speak');
        if (!member.voice || member.voice.serverMute === !canSpeak) continue;
        if (ignore.has(member.voice)) continue;
        await member.voice.setMute(!canSpeak).catch(console.error);
      }
    }
  }
}

bot.on('voiceStateUpdate', (old, state) => {
  ignore.delete(old); ignore.delete(state);
  if (!state.member || !state.channel) return;
  const canSpeak = state.channel.permissionsFor(state.member).has('Speak');
  if (old.channel?.id === state.channel.id && state.serverMute === canSpeak) {
    ignore.add(state);
  }
});

while (true) {
  await loop();
  await new Promise(resolve => setTimeout(resolve, 100));
}