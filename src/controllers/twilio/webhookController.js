const { VoiceResponse } = require("twilio").twiml;

exports.handleTwilioWebhook = (req, res) => {
  console.log("✅ Received call from Twilio");
  const twiml = new VoiceResponse();

  twiml.say("Hi, this is Olivia. How can I assist you today?", {
    voice: "Polly.Joanna",
  });

  twiml.record({
    action: "/twilio-recording",
    timeout: 3,
    maxLength: 10,
    trim: "trim-silence",
    playBeep: true,
  });

  res.type("text/xml").send(twiml.toString());
};
