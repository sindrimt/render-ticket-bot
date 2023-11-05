/* const { Events } = require('discord.js')
const { interact } = require('../utils/dialogapi.js') */

import { Events } from 'discord.js'; 
import { interact } from '../utils/dialogapi.js'; 

const interactionCreateHandler = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton()) {
      console.log('Button interaction!');

      await interaction.deferReply({ ephemeral: true });

      try {
        await interact(interaction, interaction.user.id, true);
      } catch (error) {
        console.error('Error interacting with the API:', error);
        await interaction.followUp(
          'There was an error interacting with the API.'
        );
      }
    }
  },
};

export default interactionCreateHandler;