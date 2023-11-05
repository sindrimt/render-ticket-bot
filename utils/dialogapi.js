import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

let noReplyTimeout = null;
const versionID = process.env.VOICEFLOW_VERSION_ID || "development";
const projectID = process.env.VOICEFLOW_PROJECT_ID || null;
let session = `${versionID}.${createSession()}`;

export async function interact(interaction, user, isFollow, isDM, isLive, threadTitle) {
  let action;
  if (interaction?.customId?.includes("path-")) {
    action = {
      type: interaction.customId,
      payload: {
        actions: [],
      },
    };
  } else if (interaction?.customId?.includes("intent-")) {
    let intentName = interaction.customId.replace("intent-", "");
    action = {
      type: "intent",
      payload: {
        actions: [],
        entities: [],
        intent: {
          name: `${intentName}`,
        },
      },
    };
  } else if (interaction?.isLive === true) {
    isLive = true;
    const messageWithoutMention = interaction.content.replace(/^<@\!?(\d+)>/, "").trim();

    action = {
      type: "intent",
      payload: {
        intent: {
          name: "live_answer",
        },
        query: messageWithoutMention,
        entities: [],
      },
    };
  } else {
    console.log("Type TEXT");
    const messageWithoutMention = interaction.content.replace(/^<@\!?(\d+)>/, "").trim();
    console.log(messageWithoutMention);
    action = {
      type: "text",
      payload: messageWithoutMention,
    };
  }
  await dialogAPI(interaction, user, isFollow, isDM, action, isLive, threadTitle);
}

async function saveData(user, username, isDM) {
  const response = await axios.patch(
    `${process.env.VOICEFLOW_API_URL}/state/user/${user}/variables`,
    { userName: username, isDM: isDM },
    {
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
        "Content-Type": "application/json",
        versionID: versionID,
      },
    }
  );
  return;
}

async function dialogAPI(interaction, user, isFollow, isDM, action, isLive, threadTitle) {
  clearTimeout(noReplyTimeout);
  let username = "";
  if (!isDM) {
    isDM = false;
  }
  try {
    username = interaction.user.username;
  } catch (error) {
    username = interaction.author.username;
  }

  await saveData(user, username, isDM);



  const response = await axios.post(
    `${process.env.VOICEFLOW_API_URL}/state/user/${user}/interact`,
    {
      action: action,
      config: {
        tts: false,
        stripSSML: true,
        stopAll: true,
        excludeTypes: ["path", "debug", "flow", "block"],
      },
    },
    {
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
        "Content-Type": "application/json",
        sessionid: session,
      },
    }
  ).catch((err) => {
    console.log("This is the error", err)
  })

  if (response.data.length != 0) {
    let isEnding = response.data.some((item) => item.type === "end");
    const noReply = getNoReplyTimeout(response.data);

    for (const trace of response.data) {
      if (trace.type === "text") {
        if (isFollow) {
          await interaction.followUp({
            content: trace.payload.message,
            ephemeral: true,
          });
        } else if (isLive == true && process.env.THREADS == "true") {
          // Create a new thread from the message
          interaction
            .startThread({
              name: threadTitle,
              autoArchiveDuration: 10080, // Duration until the thread is archived in minutes, it can be '60', '1440', '4320', '10080'
            })
            .then((newThread) => {
              newThread.send(trace.payload.message);
            })
            .catch(console.error);
        } else {
          await interaction.reply({
            content: trace.payload.message,
            ephemeral: true,
          });
        }
      } else if (trace.type === "choice") {
        const actionRow = new ActionRowBuilder();
        trace.payload.buttons.forEach((button, index) => {
          if (index < 5) {
            let customId = button.request.type;
            if (button.request.type == "intent") {
              customId = `intent-${button.request.payload.intent.name}`;
            }
            actionRow.addComponents(
              new ButtonBuilder().setCustomId(customId).setLabel(button.name).setStyle(ButtonStyle.Primary).setDisabled(false)
            );
          }
        });
        if (isFollow) {
          await interaction.followUp({
            components: [actionRow],
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            components: [actionRow],
            ephemeral: true,
          });
        }
      } else if (trace.type === "visual" && trace.payload.visualType === "image") {
        const embed = new EmbedBuilder().setImage(trace.payload.image).setTitle("Image");

        if (isFollow) {
          await interaction.followUp({ embeds: [embed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
    }
    if (noReply && isEnding === false) {
      noReplyTimeout = setTimeout(async () => {
        action = {
          type: "no-reply",
        };
        await dialogAPI(interaction, user, true, action);
      }, noReply);
    }
    if (isEnding === true) {
      // an end trace means the the Voiceflow dialog has ended

      let userName = null;
      let avatarURL = "https://s3.amazonaws.com/com.voiceflow.studio/share/200x200/200x200.png";
      try {
        userName = interaction.user.username;
        avatarURL = interaction.user.displayAvatarURL({
          format: "png",
          dynamic: true,
          size: 1024,
        });
      } catch {
        userName = interaction.author.username;
        avatarURL = interaction.author.displayAvatarURL({
          format: "png",
          dynamic: true,
          size: 1024,
        });
      }
      await saveTranscript(userName, avatarURL);
    }
  }
}

function getNoReplyTimeout(arr) {
  const noReplyItem = arr.find((item) => item.type === "no-reply");
  if (noReplyItem) {
    return noReplyItem.payload.timeout * 1000;
  } else {
    return null;
  }
}

function createSession() {
  // Random Number Generator
  var randomNo = Math.floor(Math.random() * 1000 + 1);
  // get Timestamp
  var timestamp = Date.now();
  // get Day
  var date = new Date();
  var weekday = new Array(7);
  weekday[0] = "Sunday";
  weekday[1] = "Monday";
  weekday[2] = "Tuesday";
  weekday[3] = "Wednesday";
  weekday[4] = "Thursday";
  weekday[5] = "Friday";
  weekday[6] = "Saturday";
  var day = weekday[date.getDay()];
  // Join random number+day+timestamp
  var session_id = randomNo + day + timestamp;
  return session_id;
}

async function saveTranscript(username, userpix) {
  if (projectID) {
    console.log("SAVE TRANSCRIPT");
    if (!username || username == "" || username == undefined) {
      username = "Anonymous";
    }
    axios({
      method: "put",
      url: "https://api.voiceflow.com/v2/transcripts",
      data: {
        browser: "Discord",
        device: "desktop",
        os: "macOS",
        sessionID: session,
        unread: true,
        versionID: versionID,
        projectID: projectID,
        user: {
          name: username,
          image: userpix,
        },
      },
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
      },
    })
      .then(function(response) {
        console.log("Saved!");
        session = `${process.env.VOICEFLOW_VERSION_ID}.${createSession()}`;
      })
      .catch((err) => console.log(err));
  }
}
