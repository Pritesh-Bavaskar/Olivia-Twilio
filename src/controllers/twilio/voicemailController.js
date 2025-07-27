const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { VoiceResponse } = require("twilio").twiml;
const {
  sessionMap,
  openai,
  redirectToVoicemail,
} = require("../twilioController");

exports.handleVoicemailDecision = async (req, res) => {
  const callSid = req.body.CallSid;
  const recordingUrl = req.body.RecordingUrl + ".wav";
  const twiml = new VoiceResponse();

  try {
    const response = await axios.get(recordingUrl, {
      responseType: "arraybuffer",
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    const tempPath = path.join(
      os.tmpdir(),
      `voicemail-decision-${Date.now()}.wav`
    );
    fs.writeFileSync(tempPath, response.data);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    fs.unlinkSync(tempPath);

    const answer = transcription.text.toLowerCase().trim();
    console.log("📨 Voicemail Decision:", answer);

    if (/^(yes|yeah|yup|sure|okay|ok)/i.test(answer)) {
      twiml.redirect("/twilio-voicemail");
    } else {
      const prevSession = sessionMap.get(callSid) || {};
      sessionMap.set(callSid, {
        ...prevSession,
        unclearCount: 0,
      });

      twiml.say("Okay, let's try again.", { voice: "Polly.Joanna" });
      twiml.record({
        action: "/twilio-recording",
        method: "POST",
        timeout: 3,
        maxLength: 10,
        trim: "trim-silence",
        playBeep: true,
        recordingChannels: "mono",
      });
    }

    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ Error in voicemail decision:", error);
    return res.type("text/xml").send(redirectToVoicemail().toString());
  }
};

exports.handleTwilioVoicemail = (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say(
    "Alright, please leave your message after the beep. When you're done, just hang up.",
    {
      voice: "Polly.Joanna",
    }
  );

  twiml.record({
    maxLength: 60,
    action: "/voicemail-saved",
    trim: "trim-silence",
    playBeep: true,
    recordingChannels: "mono",
  });

  res.type("text/xml").send(twiml.toString());
};

exports.handleVoicemailSaved = (req, res) => {
  const recordingUrl = req.body.RecordingUrl + ".wav";
  const caller = req.body.From;

  console.log(`📩 Voicemail from ${caller}: ${recordingUrl}`);

  const twiml = new VoiceResponse();
  twiml.say("Thanks, your message has been saved. Goodbye!", {
    voice: "Polly.Joanna",
  });
  twiml.hangup();

  res.type("text/xml").send(twiml.toString());
};
