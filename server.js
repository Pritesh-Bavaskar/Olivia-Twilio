require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilioRoutes = require("./src/routes/twilioRoutes");

const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use("/", twilioRoutes);

app.use((err, req, res, next) => {
  console.error("🔥 Uncaught Error:", err);
  const { VoiceResponse } = require("twilio").twiml;
  const twiml = new VoiceResponse();
  twiml.say("Sorry, something went wrong on our end. Please try again later.", {
    voice: "Polly.Joanna",
  });
  twiml.hangup();
  res.type("text/xml").status(200).send(twiml.toString());
});

app.listen(port, () => {
  console.log(
    `🚀 Olivia AI Voice Server is running on http://localhost:${port}`
  );
});
