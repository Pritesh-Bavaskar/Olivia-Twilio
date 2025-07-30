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
  `<speak><prosody rate="medium" pitch="+1st">Hmm, <break time="300ms"/> let me check..</prosody></speak>`,
  `<speak><prosody rate="medium" pitch="+1st">That’s a great question. <break time="400ms"/> Let me take a look.</prosody></speak>`,
  `<speak><prosody rate="medium" pitch="+1st">Sure! <break time="300ms"/> Happy to help.</prosody></speak>`,
  `<speak><prosody rate="medium" pitch="+1st">Alright, <break time="300ms"/> just a sec while I check that for you.</prosody></speak>`,
  `<speak><prosody rate="medium" pitch="+1st">Give me a moment, <break time="300ms"/> I’m checking that now.</prosody></speak>`,
  `<speak><prosody rate="medium" pitch="+1st">Okay, <break time="300ms"/> let me see what I can find.</prosody></speak>`,
  `<speak><prosody rate="medium" pitch="+1st">Got it — <break time="300ms"/> just a moment.</prosody></speak>`,
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
