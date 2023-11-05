import axios from "axios";

async function startConversationWithIntercom(userID, messages) {
  const history = messages
  .map(({ author, content }) => ({
    author: author.username,
    text: content,
  }))
  .reverse();

    try {
        // Make a POST request using Axios
        const response = await axios.post(
            "https://funding-pips-live-agent.onrender.com/intercom/conversation",
            {
                userID: userID,
                history: history
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        // Axios wraps the response in a data property
        return response.data;
    } catch (error) {
        // Error handling with Axios should catch any error thrown on request failure
        throw new Error("Failed to start conversation with Intercom: " + error);
    }
}

export default startConversationWithIntercom;
