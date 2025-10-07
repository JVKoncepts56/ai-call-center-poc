# AI Call Center POC

An AI-powered call center proof of concept that integrates Twilio for phone calls, OpenAI for conversational AI, and Supabase for data storage.

## Features

- **Automated Call Handling**: Receives and processes incoming calls via Twilio
- **AI-Powered Conversations**: Uses OpenAI's GPT models to generate intelligent responses
- **Knowledge Base Integration**: Responds based on customizable knowledge base content
- **Call Logging**: Stores call data and conversation history in Supabase
- **Admin API**: Endpoints to manage knowledge base and retrieve call logs

## Project Structure

```
/
├── src/
│   ├── routes/           # Express route handlers
│   │   ├── voice.js      # Twilio voice webhook
│   │   ├── status.js     # Twilio status webhook
│   │   └── admin.js      # Admin endpoints
│   ├── services/         # Third-party integrations
│   │   ├── openai.js     # OpenAI API integration
│   │   └── supabase.js   # Supabase database integration
│   └── utils/            # Helper utilities
│       ├── validators.js # Input validation
│       └── logger.js     # Logging utility
├── config/               # Configuration files
├── knowledge-base.txt    # Knowledge base content
├── .env.example          # Environment variables template
├── server.js             # Main Express server
└── package.json
```

## Prerequisites

- Node.js (v16 or higher)
- Twilio account with a phone number
- OpenAI API key
- Supabase project

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Server Configuration
PORT=3000
```

### 3. Set Up Supabase Database

Create the following tables in your Supabase project:

**call_logs table:**
```sql
CREATE TABLE call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL,
  duration INTEGER,
  transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**conversation_messages table:**
```sql
CREATE TABLE conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (call_sid) REFERENCES call_logs(call_sid)
);
```

### 4. Configure Knowledge Base

Edit `knowledge-base.txt` to add your company information, FAQs, products, services, etc. The AI will use this information to answer customer questions.

### 5. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or the PORT you specified).

### 6. Configure Twilio Webhooks

1. Log in to your Twilio Console
2. Go to your phone number settings
3. Configure webhooks:
   - **Voice & Fax > A Call Comes In**: `https://your-domain.com/webhook/voice` (POST)
   - **Voice & Fax > Call Status Changes**: `https://your-domain.com/webhook/status` (POST)

**Note**: For local development, use a tunneling service like [ngrok](https://ngrok.com/):
```bash
ngrok http 3000
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status.

### Twilio Webhooks

#### Voice Webhook
```
POST /webhook/voice
```
Handles incoming calls and processes speech input.

#### Status Webhook
```
POST /webhook/status
```
Receives call status updates from Twilio.

### Admin Endpoints

#### Update Knowledge Base
```
POST /admin/knowledge-base
Content-Type: application/json

{
  "content": "Your knowledge base content here..."
}
```

#### Get Knowledge Base
```
GET /admin/knowledge-base
```

#### Get Call Logs
```
GET /admin/calls?status=completed&limit=50
```

Query parameters:
- `status` (optional): Filter by call status
- `limit` (optional): Limit number of results

## Usage

1. Call your Twilio phone number
2. The AI will greet you and ask how it can help
3. Speak your question or request
4. The AI will respond based on the knowledge base
5. Continue the conversation as needed
6. The call and conversation will be logged in Supabase

## Development

### Run in Development Mode
```bash
npm run dev
```

### Environment Variables Validation
The application validates required environment variables on startup. Ensure all variables in `.env.example` are set.

## Technologies Used

- **Express.js**: Web framework
- **Twilio**: Voice communication platform
- **OpenAI**: GPT-4 for conversational AI, Whisper for speech-to-text
- **Supabase**: PostgreSQL database and real-time subscriptions
- **Node.js**: Runtime environment

## Troubleshooting

### Twilio Signature Validation Fails
- Ensure your webhook URLs match exactly (including https://)
- Verify `TWILIO_AUTH_TOKEN` is correct
- Check that ngrok or your server is properly forwarding requests

### OpenAI API Errors
- Verify `OPENAI_API_KEY` is valid
- Check your OpenAI account has sufficient credits
- Review rate limits on your OpenAI account

### Supabase Connection Issues
- Confirm `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Ensure database tables are created with correct schema
- Check Supabase project is active and not paused

## Security Notes

- Never commit your `.env` file to version control
- Use environment-specific credentials
- Implement authentication for admin endpoints in production
- Enable Twilio signature validation in production
- Use HTTPS for all webhook endpoints

## Future Enhancements

- Add authentication/authorization for admin endpoints
- Implement conversation analytics and insights
- Add support for multiple languages
- Create a web dashboard for monitoring calls
- Add sentiment analysis for customer interactions
- Implement call transfer to human agents
- Add SMS support alongside voice calls

## License

ISC
