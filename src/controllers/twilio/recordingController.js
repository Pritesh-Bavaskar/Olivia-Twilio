const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { VoiceResponse } = require("twilio").twiml;
const {
  openai,
  sessionMap,
  holdMessages,
  redirectToVoicemail,
} = require("../twilioController");

exports.handleRecording = async (req, res) => {
  const callSid = req.body.CallSid;
  const recordingUrl = req.body.RecordingUrl + ".wav";
  console.log("🎙️ Recording URL:", recordingUrl);

  const twiml = new VoiceResponse();
  const holdMessage =
    holdMessages[Math.floor(Math.random() * holdMessages.length)];
  twiml.say(holdMessage, { voice: "Polly.Joanna" });
  twiml.redirect("/twilio-process");

  try {
    const response = await axios.get(recordingUrl, {
      responseType: "arraybuffer",
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    const tempPath = path.join(os.tmpdir(), `recording-${Date.now()}.wav`);
    fs.writeFileSync(tempPath, response.data);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    fs.unlinkSync(tempPath);
    const userText = transcription.text.trim();
    console.log("🧠 Transcription:", userText);

    const isUnclear =
      !userText ||
      userText.length < 3 ||
      /^(uh|um|ah|er|hmm|\?+|\.{3,}|-+)$/i.test(userText);

    if (isUnclear) {
      const prev = sessionMap.get(callSid) || { unclearCount: 0 };
      const unclearCount = (prev.unclearCount || 0) + 1;
      sessionMap.set(callSid, { ...prev, unclearCount });

      const twiml = new VoiceResponse();
      if (unclearCount >= 2) {
        twiml.say("It seems I'm having trouble understanding you.", {
          voice: "Polly.Joanna",
        });
        twiml.say("Would you like to leave a voicemail instead?", {
          voice: "Polly.Joanna",
        });
        twiml.record({
          action: "/voicemail-decision",
          method: "POST",
          timeout: 3,
          maxLength: 5,
          trim: "trim-silence",
          playBeep: true,
          recordingChannels: "mono",
        });
        return res.type("text/xml").send(twiml.toString());
      }

      twiml.say(
        "I'm sorry, I didn't catch that. Could you please say it again?",
        {
          voice: "Polly.Joanna",
        }
      );
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

    sessionMap.set(callSid, {
      ...sessionMap.get(callSid),
      lastUserText: userText,
    });
    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ Error in transcription:", error);
    return res.type("text/xml").send(redirectToVoicemail().toString());
  }
};
