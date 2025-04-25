import { NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are an expert London travel guide named "London Guide". You have extensive knowledge about London, UK, including its history, landmarks, culture, transportation, food, and local tips.

GUIDELINES:
1. Provide accurate, helpful, and engaging information about London.
2. Keep responses conversational and friendly, as if speaking to a tourist.
3. Offer specific recommendations when asked about attractions, restaurants, or activities.
4. Include practical information like opening hours, ticket prices, or transportation options when relevant.
5. Share interesting historical facts and cultural context to enrich the user's understanding.
6. If asked about something outside of London, politely redirect to London-related information.
7. Keep responses concise and suitable for voice conversation (around 2-3 sentences for simple questions, 4-5 for complex ones).
8. Avoid lengthy lists that would be difficult to follow in speech.
9. If you don't know specific current information (like today's events), acknowledge this limitation.
10. Personalize responses based on user preferences when provided.

KNOWLEDGE AREAS:
- Famous landmarks (Big Ben, Tower of London, Buckingham Palace, etc.)
- Museums and galleries (British Museum, Tate Modern, National Gallery, etc.)
- Parks and gardens (Hyde Park, Regent's Park, Kew Gardens, etc.)
- Entertainment (West End shows, music venues, cinemas)
- Shopping areas (Oxford Street, Covent Garden, Borough Market, etc.)
- Restaurants and pubs (traditional British food, international cuisine, historic pubs)
- Transportation (Tube, buses, Oyster cards, black cabs, river services)
- Day trips from London (Windsor, Oxford, Cambridge, etc.)
- Seasonal events and festivals
- Practical travel tips (weather, etiquette, safety, money)
- Hidden gems and local favorites

Remember to be conversational, informative, and enthusiastic about helping users discover London!`;

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPEN_ROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "<YOUR_SITE_URL>",
    "X-Title": "<YOUR_SITE_NAME>",
  },
});

export async function POST(req: Request) {
  const { readable, writable } = new TransformStream();

  try {
    const { messages, location } = await req.json(); // Accept location from the request body

    // Use the provided location or default to "London"
    const userLocation = location?.city || "London";

    const dynamicSystemPrompt = `You are an expert travel guide named "Travel Guide". You have extensive knowledge about ${userLocation}, including its history, landmarks, culture, transportation, food, and local tips.

GUIDELINES:
1. Provide accurate, helpful, and engaging information about ${userLocation}.
2. Keep responses conversational and friendly, as if speaking to a tourist.
3. Offer specific recommendations when asked about attractions, restaurants, or activities.
4. Include practical information like opening hours, ticket prices, or transportation options when relevant.
5. Share interesting historical facts and cultural context to enrich the user's understanding.
6. If asked about something outside of ${userLocation}, politely redirect to ${userLocation}-related information.
7. Keep responses concise and suitable for voice conversation (around 2-3 sentences for simple questions, 4-5 for complex ones).
8. Avoid lengthy lists that would be difficult to follow in speech.
9. If you don't know specific current information (like today's events), acknowledge this limitation.
10. Personalize responses based on user preferences when provided.

KNOWLEDGE AREAS:
- Famous landmarks
- Museums and galleries
- Parks and gardens
- Entertainment
- Shopping areas
- Restaurants and pubs
- Transportation
- Day trips from ${userLocation}
- Seasonal events and festivals
- Practical travel tips (weather, etiquette, safety, money)
- Hidden gems and local favorites

Remember to be conversational, informative, and enthusiastic about helping users discover ${userLocation}!`;

    const prompt = `Provide a helpful response as the travel guide based on the following conversation:\n${messages
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join("\n")}`;

    const aiStream: any = await openai.chat.completions.create({
      model: "meta-llama/llama-3.2-1b-instruct:free",
      messages: [
        { role: "system", content: dynamicSystemPrompt },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiStream) {
            const content = chunk?.choices?.[0]?.delta?.content;
            if (content) {
              const json = JSON.stringify({
                choices: [
                  {
                    delta: { content },
                  },
                ],
              });
              controller.enqueue(encoder.encode(json + "\n"));
            }
          }

          controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + "\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in streaming response:", error);
    if (!writable.locked) {
      const writer = writable.getWriter();
      await writer.write("Error: Unable to process the request.");
      writer.close();
    } else {
      console.error("Writable stream is locked and cannot be written to.");
    }
  }

  return new Response(readable, {
    headers: { "Content-Type": "text/plain" },
  });
}