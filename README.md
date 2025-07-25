# Olivia Twilio Integration

A Node.js application for integrating with Twilio services.

## Prerequisites

- Node.js (v14 or later)
- npm (comes with Node.js)
- A Twilio account (for Twilio API credentials)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your Twilio credentials:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   ```

## Available Scripts

- `npm start` - Start the application
- `npm run dev` - Start the application in development mode with nodemon
- `npm test` - Run tests (to be implemented)

## Project Structure

- `index.js` - Main application entry point
- `routes/` - API routes (to be implemented)
- `controllers/` - Business logic (to be implemented)
- `config/` - Configuration files (to be implemented)
- `.env` - Environment variables (not version controlled)

## License

ISC
