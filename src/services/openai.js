const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getGPTResponse(userText, history = [], onProgress) {
  const messages = [
    {
      role: "system",
      content:
        "You are a friendly and professional receptionist named Olivia. Greet callers warmly, assist them clearly and efficiently, and never mention that you are an AI. Speak naturally, just like a real human receptionist would. Once you’ve helped the caller completely or have collected all needed information, say something like: 'That's everything I needed. Is there anything else I can help you with?' If the caller says no or doesn’t reply clearly, end your response with 'DONE.'",
    },
    ...history,
    { role: "user", content: userText },
  ];

  const params = {
    model: "gpt-4",
    messages,
    temperature: 0.6,
    top_p: 1,
    frequency_penalty: 0.2,
    presence_penalty: 0.2,
    max_tokens: 120,
  };

  // If we have a progress callback, use streaming
  if (onProgress) {
    onProgress();

    const stream = await openai.chat.completions.create({
      ...params,
      stream: true,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
    }

    const message = fullResponse.trim();
    const isDone = /\bDONE\.?$/i.test(message);

    return {
      reply: message,
      done: isDone,
      history: [
        ...history,
        { role: "user", content: userText },
        { role: "assistant", content: message },
      ],
    };
  } else {
    // Non-streaming fallback
    const chat = await openai.chat.completions.create(params);

    const message = chat.choices[0].message.content.trim();
    const isDone = /\bDONE\.?$/i.test(message);

    return {
      reply: message,
      done: isDone,
      history: [
        ...history,
        { role: "user", content: userText },
        { role: "assistant", content: message },
      ],
    };
  }
}

module.exports = { getGPTResponse };
