import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { NextResponse } from "next/server"

// London travel guide system prompt
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

Remember to be conversational, informative, and enthusiastic about helping users discover London!`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    // Extract the user's message
    const userMessages = messages
      .filter((msg: any) => msg.role === "user")
      .map((msg: any) => msg.content)
      .join("\n")

    // Get the last few messages for context (limit to 5 for efficiency)
    const recentMessages = messages.slice(-5)
    const conversationContext = recentMessages
      .map((msg: any) => `${msg.role === "user" ? "User" : "Guide"}: ${msg.content}`)
      .join("\n")

    // Combine the conversation context with the user's query
    const prompt = `Previous conversation:\n${conversationContext}\n\nUser's latest query: ${messages[messages.length - 1].content}\n\nProvide a helpful response as the London travel guide.`

    // Generate response using Gemini
    const { text } = await generateText({
      model: google("gemini-1.5-pro-latest"),
      prompt: prompt,
      system: SYSTEM_PROMPT,
      maxTokens: 500,
    })
    console.log('text-->',text)
    return NextResponse.json({ response: text })
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json({ error: "Failed to process your request" }, { status: 500 })
  }
}
