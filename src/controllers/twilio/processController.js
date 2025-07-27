const { VoiceResponse } = require("twilio").twiml;
const { getGPTResponse } = require("../../services/openai");

const { sessionMap, redirectToVoicemail } = require("../twilioController");

exports.handleProcess = async (req, res) => {
  const callSid = req.body.CallSid;
  const session = sessionMap.get(callSid);
  const userText = session?.lastUserText;

  const twiml = new VoiceResponse();

  if (!userText) {
    twiml.say("Sorry, I couldn’t understand that. Let’s try again.", {
      voice: "Polly.Joanna",
    });
    twiml.record({
      action: "/twilio-recording",
      method: "POST",
      timeout: 3,
      maxLength: 10,
      trim: "trim-silence",
      playBeep: true,
      recordingChannels: "mono",
    });
    return res.type("text/xml").send(twiml.toString());
  }

  const prev = session || { history: [] };

  try {
    const gptResult = await getGPTResponse(userText, prev.history);
    const spokenReply = gptResult.reply.replace(/\s*DONE\.?\s*$/i, "").trim();

    twiml.say(spokenReply, { voice: "Polly.Joanna" });
    console.log("🤖 Olivia replies:", gptResult.reply);

    if (gptResult.done) {
      twiml.hangup();
      sessionMap.delete(callSid);
    } else {
      twiml.record({
        action: "/twilio-recording",
        method: "POST",
        timeout: 3,
        maxLength: 10,
        trim: "trim-silence",
        playBeep: true,
        recordingChannels: "mono",
      });
      sessionMap.set(callSid, {
        history: gptResult.history,
      });
    }

    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ GPT error:", error);
    return res.type("text/xml").send(redirectToVoicemail().toString());
  }
};
