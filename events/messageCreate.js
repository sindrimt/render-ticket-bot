console.log(3);
import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

//import { Events, MessageEmbed } from 'discord.js';

import pkg from "discord.js";
const { Events, EmbedBuilder } = pkg;

import { interact } from "../utils/dialogapi.js";
import startConversationWithIntercom from "../utils/startConversationWithIntercom.js";
import websocketStore from "../utils/webSocketStore.js";
import { isTicketChannel } from "../utils/ticketUtils.js";

import WebSocket from "ws";

const talkToHuman = (message) => {
  isTicketChannel(message.channel)
    .then(async (inTicket) => {
      if (inTicket) {
        console.log(message.author.id);
        const messages = await message.channel.messages.fetch();

        // Ping the server (Maybe not needed but eh)
        await axios.head("https://funding-pips-live-agent.onrender.com/intercom");

        // Create a intercom conversation
        startConversationWithIntercom(message.author.id, messages)
          .then(({ userID, conversationID }) => {
            console.log("starting websocket");

            // Create a websocket to the server with the conversation ID and userID gotten from the
            // initialization from the intercom conversation
            const ws = new WebSocket(
              `https://funding-pips-live-agent.onrender.com/intercom/user/${userID}/conversation/${conversationID}/socket`
            );

            // Catch event when the websocket opens
            ws.on("open", async () => {
              console.log("WebSocket connection opened.");
              websocketStore.set(message.channel.id, ws);
              const embed = new EmbedBuilder()
                .setTitle("Your message is sent to one of our agents")
                .setDescription("We will respond to you as quickly as possible")
                .setColor("#334AFA");
              message.channel.send({ embeds: [embed] });
            });

            // Catch the event when a message comes from intercom
            ws.on("message", (data) => {
              const event = JSON.parse(data);
              if (event.type === "live_agent.message") {
                message.channel.send(event.data.message);
              }
            });

            // Catch the close event and tell the user the connection in closed between the user and
            // the live agent
            ws.on("close", (code, reason) => {
              console.log(`WebSocket closed with code: ${code}, reason: ${reason}`);
              const embed = new EmbedBuilder()
                .setTitle("Intercom agent closed conversation")
                .setDescription("To start another conversation. You can start another one by asking for a human")
                .setColor("#334AFA");
              message.channel.send({ embeds: [embed] });
              websocketStore.delete(message.channel.id);
            });

            // Catch errors in the wesocket
            ws.on("error", (error) => {
              console.error("WebSocket error:", error);
              message.channel.send("An error occurred with the live chat connection. Please try again later.");
              ws.close(); // Optionally close the WebSocket if an error occurs
            });

            // Catch initial connection errors
            ws.onerror = (error) => {
              console.error("WebSocket initial connection error:", error);
            };
          })
          .catch((error) => {
            console.error("Error starting conversation with Intercom: ", error);
            message.channel.send("There was an error connecting to Intercom.");
          });
      } else {
        const embed = new EmbedBuilder()
          .setTitle("Support")
          .setDescription("You can only start a conversation with Intercom within a ticket channel.")
          .setColor("#ff0000");
        message.channel.send({ embeds: [embed] });
      }
    })
    .catch((error) => {
      console.error("Error checking ticket channel: ", error);
      message.channel.send("There was an error processing your request.");
    });
};

const getVoiceflowMessageResponse = (messageWithoutMention, message) => {
  console.log(messageWithoutMention)
  return new Promise((resolve, reject) => {
    const requestBody = {
      action: {
        type: "text",
        payload: messageWithoutMention,
      },
    };
    // Create the new user
    axios
      .post(`https://general-runtime.voiceflow.com/state/user/${message.author.id}/interact`, requestBody, {
        headers: {
          Authorization: "VF.DM.6546882c44035a00075819ea.nbYQUxqXPLkPG19u",
          "Content-Type": "application/json",
        },
      })
      .then((res) => {
        /* console.log("res data:")
console.log(res.data); */

        /*  console.log("resolve:") */
        resolve(res.data);
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      });
  });
};

const messageCreateHandler = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    console.log("Message created", message.content);

    // If a WebSocket connection exists for this channel, forward the message
    if (websocketStore.has(message.channel.id)) {
      console.log("Forwarding message from Discord to Intercom:", message.content);
      const ws = websocketStore.get(message.channel.id);
      // Send a JSON string with the message type and content
      ws.send(JSON.stringify({ type: "user.message", data: { message: message.content } }));
    } else {
      // Only respond with ai answer if the question is asked in the specified channel, or if
      // the channel name starts with "ticket"
      if (process.env.LIVEANSWERS_CHANNELS.includes(message.channel.id) || message.channel.name.startsWith("ticket")) {
        // If there is no WebSocket connection, process the message normally
        console.log("User message:", message.content);
        let liveAnswer = message;
        liveAnswer.isLive = true;
        const messageWithoutMention = message.content.replace(/^<@\!?(\d+)>/, "").trim();

        console.log("=====");

        if (process.env.LIVEANSWERS_CHANNELS.includes(message.channel.id)) {
          console.log("QNA channel triggered");
          // Send the user question to voiceflow
          await interact(liveAnswer, message.author.id, false, false, true, messageWithoutMention);
        }

        if (message.channel.name.startsWith("ticket")) {
          console.log("Starts with ticket")
          axios
            .get(`https://general-runtime.voiceflow.com/state/user/${message.author.id}`, {
              params: {
                versionID: "production",
              },
              headers: {
                Authorization: "VF.DM.6546882c44035a00075819ea.nbYQUxqXPLkPG19u",
              },
            })
            .then((response) => {
              // If a the userID does not exist in voiceflow, create a new user
              if (Object.keys(response.data).length === 0) {
                const requestBody = {
                  versionID: "production",
                  action: {
                    type: "launch",
                  },
                };
                // Create the new user
                axios
                  .post(`https://general-runtime.voiceflow.com/state/user/${message.author.id}`, requestBody, {
                    headers: {
                      Authorization: "VF.DM.6546882c44035a00075819ea.nbYQUxqXPLkPG19u",
                      "Content-Type": "application/json",
                    },
                  })
                  .then((res) => {
                    console.log(res.data);
                    getVoiceflowMessageResponse(messageWithoutMention, message).then((res) => {

                      console.log(res)

                      if (res[1].type === "end") {
                        channel.message.send("I cant answer that")
                      }

                      if (res[2]?.type === "talk_to_agent") {
                        talkToHuman(message);
                      } else {
                        console.log("ANSWER2");
                        console.log(res[1]?.payload?.message);

                        if (!res[1]?.payload?.message) {
                          getVoiceflowMessageResponse(messageWithoutMention, message).then((res) => {
                            if (res[2]?.type === "talk_to_agent") {
                              talkToHuman(message);
                            } else {
                              console.log("ANSWER2");
                              console.log(res[1]?.payload?.message);

                              if (!res[1]?.payload?.message) {
                                message.channel.send("An error occured. Setting you over to a human...");
                                talkToHuman(message);
                              } else {
                                message.channel.send(res[1]?.payload?.message);

                              }
                            }
                          });
                        } else {
                          message.channel.send(res[1]?.payload?.message);
                        }
                      }
                    });
                  })
                  .catch((err) => {
                    console.error(err);
                  });
              } else {
                getVoiceflowMessageResponse(messageWithoutMention, message).then((res) => {
                  if (res[2]?.type === "talk_to_agent") {
                    talkToHuman(message);
                  } else {
                    console.log("ANSWER2");
                    console.log(res[1]?.payload?.message);

                    if (!res[1]?.payload?.message) {
                      getVoiceflowMessageResponse(messageWithoutMention, message).then((res) => {
                        if (res[2]?.type === "talk_to_agent") {
                          talkToHuman(message);
                        } else {
                          console.log("ANSWER2");
                          console.log(res[1]?.payload?.message);

                          if (!res[1]?.payload?.message) {
                            message.channel.send("An error occured. Setting you over to a human...");
                            talkToHuman(message);
                          } else {
                            message.channel.send(res[1]?.payload?.message);

                          }

                        }
                      });
                    } else {
                      message.channel.send(res[1]?.payload?.message);
                    }
                  }
                });
              }
            })
            .catch((error) => {
              console.error(error);
            });
        }
      }
    }
  },
};

export default messageCreateHandler;
