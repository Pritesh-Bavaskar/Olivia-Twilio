const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { VoiceResponse } = require("twilio").twiml;
const { getGPTResponse } = require("../services/openai");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sessionMap = new Map();

const holdMessages = [
  "One moment, please.",
  "Let me check that.",
  "Hang on a sec.",
  "Checking now.",
  "Just a moment.",
];

const redirectToVoicemail = () => {
  const twiml = new VoiceResponse();
  twiml.redirect("/twilio-voicemail");
  return twiml;
};

module.exports = {
  sessionMap,
  holdMessages,
  openai,
  redirectToVoicemail,
};
