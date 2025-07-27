const { VoiceResponse } = require("twilio").twiml;

exports.handleTwilioWebhook = (req, res) => {
  console.log("✅ Received call from Twilio");
  const twiml = new VoiceResponse();

  twiml.say("Hi, this is Olivia from ReserveIQ. I just wanted to follow up on your demo with us. Are you available for a quick moment to confirm everything went smoothly?", {
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
