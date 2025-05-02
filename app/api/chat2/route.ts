// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fetchNearbyPOIs, POI } from '@/lib/poi';
import Together from 'together-ai';
const openai = new Together();

// Initialize OpenAI/OpenRouter client
// const openai = new OpenAI({
//   baseURL: 'https://openrouter.ai/api/v1',
//   apiKey: process.env.OPEN_ROUTER_API_KEY,
//   defaultHeaders: {
//     'HTTP-Referer': '<YOUR_SITE_URL>',
//     'X-Title': '<YOUR_SITE_NAME>',
//   },
// });

// const openai = new OpenAI({
//     baseURL: 'http://localhost:11434/v1/',
//     apiKey: 'ollama',
// })

export async function POST(req: Request) {
    try {
        const { messages, location, radius } = await req.json();
        const { lat, lon } = location;

        const userLoc = location.city || `${lat.toFixed(4)},${lon.toFixed(4)}`;

        const systemPrompt = `
You are a friendly travel assistant for ${userLoc}.  
Your job is to help users discover nearby points of interest (POIs)—restaurants, cafes, parks, museums, shops, nightlife, etc.

Rules:
1. If the user’s request names a specific category (“restaurants”, “cafes”, “parks”, “museums”, “shops”, “nightlife”, etc.), you SHOULD call the getNearbyPOIs tool with that category.
2. If the user uses a general phrase like “interesting places”, “attractive places”, “things to do”, “places to visit”, or “any good spots,” you MUST first ask:
   > “Sure! Which type of place are you interested in?  
   > For example: restaurants, cafes, parks, museums, shops, nightlife spots, or something else.”
   and await their reply—do NOT call the tool yet.
3. If the user asks general questions (“what can you do?”, “how can you help?”, “hi”, etc.), simply reply politely, e.g. “Hi there! I can help you find nearby restaurants, cafes, parks, and more—just tell me what you’re looking for.”
4. NEVER make up place names or details. ONLY suggest real POIs returned by the tool.
5. Keep your tone friendly, concise, and helpful.
`;
//         const systemPrompt = `
// You are a travel assistant for ${userLoc}.

// Your job is to help users find nearby places like restaurants, cafes, parks, etc.

// Rules:
// 1. ONLY call the "getNearbyPOIs" tool if the user explicitly asks for a type of place (e.g., "restaurants", "cafes", "parks", etc.)
// 2. DO NOT call the tool if the user asks general questions like "what can you do", "how can you help me", or greetings like "hi".
// 3. In those general cases, just reply politely and briefly, saying you can help find places nearby.

// NEVER make up place names.
// NEVER suggest places unless you get the real data from the tool.
// Keep your tone friendly and helpful.
// Respond concisely.`;
        console.log('User location:', userLoc);
        // First request: let model choose if it needs POIs via tool
        const initial = await openai.chat.completions.create({
            model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', //'meta-llama/llama-3.2-1b-instruct:free',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            tools: [{
                "type": "function",
                "function": {
                    name: 'getNearbyPOIs',
                    description: 'Fetch points of interest around lat/lon with given category',
                    parameters: {
                        type: 'object',
                        properties: {
                            lat: { type: 'number', description: 'Latitude', default: '19.151850' },
                            lon: { type: 'number', description: 'Longitude', default: '72.937088' },
                            category: { type: 'string', description: 'Filter category (restaurant, fast_food, cafe, park, food_court, ice_cream, pub, nightclub, cinema, biergarten, theatre, bicycle_rental, bus_station etc.)' },
                            radius: { type: 'number', description: 'Search radius in meters', default: radius || 1000 },
                        },
                        required: ['lat', 'lon', 'category'],
                    },
                }
            }],
            tool_choice: 'auto',
        });
        console.log('Initial response:', initial);
        const choice = initial.choices[0].message;
        console.log('Initial choice:', choice);
        const toolCall = choice?.tool_calls?.[0];
        console.log('Tool call:', toolCall);

        if (!toolCall || !JSON.parse(toolCall?.function?.arguments).category) {
            // No tool call, meaning it's just a normal answer
            return NextResponse.json({
                role: "assistant",
                content: choice?.content,
            }, { status: 200 });
        }

        // If the model invoked our tool
        if (toolCall?.function.name === 'getNearbyPOIs') {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            const filtered: POI[] = await fetchNearbyPOIs(lat, lon, radius, args.category);
            console.log('Fetched POIs:', filtered);
            // const filtered = pois.filter(p => p.category === args.category).slice(0, 10);
            // console.log('Filtered POIs:', filtered);

            const systemPromptRes = `
You are a friendly AI Agent that recommends ${args.category}places nearby.
You will be given a list of ${args.category} places in JSON format.
You cannot give details or directions or address about the places but only the name and distance from the user location.
If no places are found, say so politely but also tell the user that would like to search for specific places like restaurant, cafe, pub, fast food, museum, park.

Include the distance in meters from the user location which is currently set to ${lat}, ${lon} and to the list of each object has lat: and lon: as key calculate and mention it in meters or Killometers.
Never read lattitude and longitude or any unecessary information from the JSON. this is just for user who want to know places nearby.
Dont include ** or * the response is for voice conversation.`;

            const toolPrompt = `
Here is the list of ${args.category} places:
${JSON.stringify(filtered, null, 2)}
`;
            //   Second request: provide tool output back to the model
            const final = await openai.chat.completions.create({
                model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', //'meta-llama/llama-3.2-1b-instruct:free',
                messages: [
                    { role: "system", content: systemPromptRes },
                    { role: "tool", content: toolPrompt }
                ],
            });

            return NextResponse.json({
                role: "assistant",
                content: final.choices[0]?.message?.content ?? 'No content available',
                poi: filtered,
            }, { status: 200 });

            // Stream back to client
            //   const encoder = new TextEncoder();
            //   return new Response(
            //     new ReadableStream({
            //       async start(controller) {
            //         for await (const chunk of final) {
            //           controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
            //         }
            //         controller.close();
            //       },
            //     }),
            //     { headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }
            //   );
        }

        // Otherwise return initial response
        return NextResponse.json(initial, { status: 200 });

    } catch (err) {
        console.error('API error:', err);
        return NextResponse.error();
    }
}
