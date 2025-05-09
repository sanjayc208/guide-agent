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
        //old prompt commented
//         const systemPrompt = `
//         1. If the user’s request names a specific category (restaurant, fast_food, cafe, park, food_court, ice_cream, pub, nightclub, cinema, biergarten, theatre, bicycle_rental, bus_station , airport, pharmacy, bank) you SHOULD call the getNearbyPOIs tool with that category.
// 2. If the user uses a general phrase like “interesting places”, “attractive places”, “things to do”, “places to visit”, or “any good spots,” you MUST first ask:
//    > “Sure! Which type of place are you interested in?  
//    > For example: restaurants, cafes, parks, museums, shops, nightlife spots, or something else.”
//    and await their reply—do NOT call the tool yet.
// 3. If the user asks general questions (“what can you do?”, “how can you help?”, “hi”, etc.), simply reply politely, e.g. “Hi there! I can help you find nearby restaurants, cafes, parks, and more—just tell me what you’re looking for.”
// 4. NEVER make up place names or details. ONLY suggest real POIs returned by the tool.
// 5. Keep your tone friendly, concise, and helpful.
// `;

        const systemPrompt = `
You are a friendly travel AI assistant for ${userLoc}.  
Your job is to help users discover nearby points of interest (POIs)—restaurants, cafes, parks, museums, shops, nightlife, etc.

Rules:

1. If the user asks general or greeting questions (e.g., “what can you do?”, “how can you help?”, “hi”, “hello”, “hey there”), you MUST NOT search for places.  
   Instead, respond politely and helpfully. For example:  
   → “Hi there! I can help you find nearby restaurants, cafes, parks, and more—just tell me what you’re looking for.”

2. If the user *asks whether you can* search for places (e.g., "Can you show interesting places?", "Do you find attractions?", "Can you search parks for me?"), you MUST respond politely and confirm your ability.  
   For example:  
   → “Sure! I can definitely help you with that. Just let me know what kind of place you're looking for—restaurants, parks, tourist attractions, or something else?”

   You must NOT call getNearbyPOIs yet. Wait for a clear category.

3. If the user’s request names a specific category (restaurant, fast_food, cafe, park, food_court, ice_cream, pub, nightclub, cinema, biergarten, theatre, bicycle_rental, bus_station, airport, pharmacy, bank, parking, parking_space, marketplace, place_of_worship, taxi), you SHOULD call the getNearbyPOIs tool with that category.

4. from the user's request get the exact keyword from the user and pass it to the tool which should be something to do with places only.

5. If the user uses general phrases like:
   - “interesting places”
   - “attractive places”
   - “attractions”
   - “tourist attractions”
   - “places to visit”
   - “things to see”
   - or other vague tourism-related requests  
   → You MUST call getNearbyPOIs with:  
   → category = "tourism=attraction"

6. When calling getNearbyPOIs:

   Here are some valid Overpass category mappings exmples (you must only choose from these if the user asks for a specific category else understand and create a category from the user request which will match with the examples given below):

    - amenity=restaurant
    - cusine=indian
    - amenity=fast_food
    - amenity=cafe
    - amenity=pub
    - amenity=ice_cream
    - amenity=food_court
    - amenity=parking
    - amenity=bank
    - amenity=pharmacy
    - amenity=bus_station
    - amenity=bicycle_rental
    - tourism=attraction
    - tourism=museum
    - tourism=viewpoint
    - tourism=zoo
    - tourism=theme_park
    - tourism=artwork

    If the user gives a vague or tourism-related term like "interesting places", "attractions", "places to visit", etc., use:
    → 'category = "tourism=attraction"'


7. NEVER make up place names or details. ONLY suggest real POIs returned by the tool.

8. Keep your tone friendly, concise, and helpful.

9. If the user makes a request that is clearly outside your capabilities—such as:
   - finding a lost object (e.g., "find my car"),
   - buying something (e.g., "buy candy for me"),
   - performing physical actions in the real world,
   - accessing private data (e.g., "what did I do yesterday?")
   
   → You MUST politely decline, explain your limitation, and, if appropriate, suggest how you can still help.
   
   Example responses:
   - “I can’t track or locate your car, but I can help you find nearby parking spots.”
   - “I can’t buy items, but I can show you where to find candy or snacks near you.”
`

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
            temperature: 0.1,
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
                            category: { type: 'string', description: 'Filter category (restaurant, fast_food, cafe, park, food_court, ice_cream, pub, nightclub, cinema, biergarten, theatre, bicycle_rental, bus_station , airport)' },
                            radius: { type: 'number', description: 'Search radius in meters', default: radius || 1000 },
                            keyword:  { type: 'string', description: 'The exact term the user asked for' },
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
            let filtered: POI[] = await fetchNearbyPOIs(lat, lon, radius, args.category);
            const seen = new Set();

            //For demo purpose, filter out POIs with empty names
            filtered = filtered.filter(item => {
                const name = item.name?.trim();
                if (!name || seen.has(name)) return false;
                seen.add(name);
                return true;
            });
            console.log('Fetched POIs:', filtered);
            // const filtered = pois.filter(p => p.category === args.category).slice(0, 10);
            // console.log('Filtered POIs:', filtered);

            const systemPromptRes = `
You are a friendly AI Agent that recommends ${args.keyword || args.category.split("=")[1]} nearby.
You will be given a list of ${args.keyword || args.category.split("=")[1]} places in JSON format.
You cannot give details or directions or address about the places but only the name and distance from the user location.
Also mention the no of places found in the list.

Include the distance in meters from the user location which is currently set to ${lat}, ${lon} and to the list of each object has lat: and lon: as key calculate and mention it in meters or Killometers.
Never read lattitude and longitude or any unecessary information from the JSON. this is just for user who want to know places nearby.
Dont include ** or * the response is for voice conversation.

- Use a friendly and conversational tone. if you find any places say i found (no of places) ${args.keyword || args.category.split("=")[1]} nearby.
- if no places are found or the list is empty, say so politely that could not find any ${args.keyword || args.category.split("=")[1]} but also tell the user that would like to search for specific places like restaurant, cafe, pub, fast food, etc.
- Give the list in pointer format.`;

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
