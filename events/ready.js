//const { Events } = require('discord.js')
import { Events } from "discord.js"

const clientReadyHandler = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
  },
};

export default clientReadyHandler;
