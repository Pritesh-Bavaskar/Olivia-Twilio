const { VoiceResponse } = require("twilio").twiml;

exports.handleTwilioWebhook = (req, res) => {
  console.log("✅ Received call from Twilio");
  const twiml = new VoiceResponse();

  twiml.say( `<speak>
     <prosody rate="medium" pitch="+1st">
       Hi there! <break time="300ms"/> This is Olivia from ReserveIQ. <break time="400ms"/> How can I help you today?
     </prosody>
   </speak>`, {
    voice: "Polly.Joanna",
  });

  twiml.record({
    action: "/twilio-recording",
    timeout: 3,
    maxLength: 10,
    trim: "trim-silence",
    playBeep: true,
    recordingChannels: "mono",
  });

  res.type("text/xml").send(twiml.toString());
};
