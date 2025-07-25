const express = require("express");
const router = express.Router();

const {
  handleTwilioWebhook,
  handleRecording,
  handleProcess,
  handleVoicemailDecision,
  handleTwilioVoicemail,
  handleVoicemailSaved,
} = require("../controllers/twilio");

// Route bindings
router.post("/twilio-webhook", handleTwilioWebhook);
router.post("/twilio-recording", handleRecording);
router.post("/twilio-process", handleProcess);
router.post("/voicemail-decision", handleVoicemailDecision);
router.post("/twilio-voicemail", handleTwilioVoicemail);
router.post("/voicemail-saved", handleVoicemailSaved);

module.exports = router;
