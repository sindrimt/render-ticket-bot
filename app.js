import dotenv from 'dotenv';
dotenv.config();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import {
  Client,
  GatewayIntentBits,
  Partials,
} from 'discord.js';

const { DISCORD_TOKEN } = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
  rest: { version: '10' },
});

// Calculate __dirname for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith('.js'));


for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  //console.log(filePath)
  import(filePath).then((module) => {
    const event = module.default; // Assuming your event files use default export
    console.log(event)
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }).catch((error) => {
    console.error(`Error loading event ${file}:`, error);
  });
}

client.rest.setToken(DISCORD_TOKEN);

async function main() {
  try {
    await client.login(DISCORD_TOKEN);
  } catch (err) {
    console.error(err);
    console.error("This was the error msg");
  }
}

main();