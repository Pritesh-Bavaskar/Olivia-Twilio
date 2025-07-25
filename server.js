require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { getGPTResponse } = require("./openai");
const twilio = require("twilio");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { OpenAI } = require("openai");

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));

const VoiceResponse = twilio.twiml.VoiceResponse;
const sessionMap = new Map();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const holdMessages = [
  "One moment, please.",
  "Let me check that.",
  "Hang on a sec.",
  "Checking now.",
  "Just a moment.",
];

app.post("/twilio-webhook", (req, res) => {
  console.log("✅ Received call from Twilio");

  const twiml = new VoiceResponse();
  twiml.say("Hi, this is Olivia. How can I assist you today?", {
    voice: "Polly.Joanna",
  });

  twiml.record({
    action: "/twilio-recording",
    // method: "POST",
    // transcribe: true,
    // transcribeCallback: "/twilio-transcription",
    timeout: 3,
    maxLength: 10,
    trim: "trim-silence",
    playBeep: true,
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

app.post("/twilio-recording", async (req, res) => {
  const callSid = req.body.CallSid;
  const recordingUrl = req.body.RecordingUrl + ".wav";
  console.log("🎙️ Recording URL:", recordingUrl);
  // Say hold message, then redirect
  const twiml = new VoiceResponse();

  const randomHoldMessage =
    holdMessages[Math.floor(Math.random() * holdMessages.length)];
  twiml.say(randomHoldMessage, { voice: "Polly.Joanna" });
  twiml.redirect("/twilio-process");

  try {
    const response = await axios.get(recordingUrl, {
      responseType: "arraybuffer",
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    const tempPath = path.join(os.tmpdir(), `recording-${Date.now()}.mp3`);
    fs.writeFileSync(tempPath, response.data);
    console.log("✅ Saved recording to:", tempPath);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    fs.unlinkSync(tempPath);

    let userText = transcription.text.trim();
    console.log("🧠 Transcription:", userText);

    const isUnclear =
      !userText ||
      userText.length < 3 ||
      /^(uh|um|ah|er|hmm|\?+|\.{3,}|-+)$/i.test(userText);

    if (isUnclear) {
      const prevSession = sessionMap.get(callSid) || { unclearCount: 0 };
      const unclearCount = (prevSession.unclearCount || 0) + 1;

      sessionMap.set(callSid, {
        ...prevSession,
        unclearCount,
      });

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
      });
      return res.type("text/xml").send(twiml.toString());
    }

    // Save the transcription for next step
    sessionMap.set(callSid, {
      ...sessionMap.get(callSid),
      lastUserText: userText,
    });

    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ Error in transcription flow:", error);
    return res.type("text/xml").send(redirectToVoicemail().toString());
  }
});

app.post("/twilio-process", async (req, res) => {
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
});

app.post("/twilio-transcription", async (req, res) => {
  const userText = req.body.TranscriptionText;

  try {
    const reply = await getGPTResponse(userText);

    const twiml = new VoiceResponse();
    twiml.say(reply, { voice: "Polly.Joanna" });

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (error) {
    console.error("❌ GPT error:", error);
    return res.type("text/xml").send(redirectToVoicemail().toString());
  }
});

const redirectToVoicemail = () => {
  const twiml = new VoiceResponse();
  twiml.redirect("/twilio-voicemail");
  return twiml;
};

app.post("/voicemail-decision", async (req, res) => {
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
      `voicemail-decision-${Date.now()}.mp3`
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
      // twiml.say("Alright, please leave your message after the beep.", {
      //   voice: "Polly.Joanna",
      // });
      twiml.redirect("/twilio-voicemail");
    } else {
      const prevSession = sessionMap.get(callSid) || {};
      sessionMap.set(callSid, {
        ...prevSession,
        unclearCount: 0,
      });

      twiml.say("Okay, let's try again.", {
        voice: "Polly.Joanna",
      });
      twiml.record({
        action: "/twilio-recording",
        method: "POST",
        timeout: 3,
        maxLength: 10,
        trim: "trim-silence",
        playBeep: true,
      });

      sessionMap.set(callSid, {
        ...prevSession,
        unclearCount: 0,
      });
    }

    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("❌ Error in voicemail decision:", error);
    return res.type("text/xml").send(redirectToVoicemail().toString());
  }
});

app.post("/twilio-voicemail", (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say(
    "Alright, please leave your message after the beep. When you're done, just hang up.",
    {
      voice: "Polly.Joanna",
    }
  );

  twiml.record({
    maxLength: 60, // voicemail max duration
    action: "/voicemail-saved",
    trim: "trim-silence",
    playBeep: true,
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

app.post("/voicemail-saved", async (req, res) => {
  const recordingUrl = req.body.RecordingUrl + ".wav";
  const caller = req.body.From;

  console.log(`📩 Voicemail from ${caller}: ${recordingUrl}`);

  // You can store the URL in a DB or send to Slack/email here

  const twiml = new VoiceResponse();
  twiml.say("Thanks, your message has been saved. Goodbye!", {
    voice: "Polly.Joanna",
  });
  twiml.hangup();

  res.type("text/xml").send(twiml.toString());
});

app.listen(port, () => {
  console.log(
    `🚀 Olivia AI Voice Server is running on http://localhost:${port}`
  );
});
