"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, MicOff, Volume2, VolumeX, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"
import { toast } from "react-fox-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ChatBox from "@/components/chat-box"

// Dynamically import the Map component with no SSR
const MapComponent = dynamic(() => import("@/components/map"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>
  ),
})

// Declare SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: { new (): SpeechRecognition; prototype: SpeechRecognition }
    webkitSpeechRecognition: { new (): SpeechRecognition; prototype: SpeechRecognition }
  }

  interface SpeechRecognition {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    abort(): void
    onresult: ((event: any) => void) | null
    onend: (() => void) | null
  }
}

export default function LondonTravelGuide() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [poi, setPoi] = useState([])
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const [response, setResponse] = useState("")
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: `Hey there! 👋 I'm your friendly AI Agent, ready to explore the neighborhood with you! ☕🍔🏥
Looking for a cozy café, a tasty restaurant, or the nearest hospital? Just ask, and I’ll find the best spots within 1 km of where you are. Let’s discover what’s around you! 🌍✨` },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [location, setLocation] = useState<any>(null)
  const [radius, setRadius] = useState(1000) // Default radius is 1000m

  const recognitionRef: any = useRef<SpeechRecognition | null>(null)
  const synthRef: any = useRef<SpeechSynthesis | null>(null)
  const utteranceRef: any = useRef<SpeechSynthesisUtterance | null>(null)

  // Add a ref to store the latest location
  const locationRef = useRef<any>(null)
  const radiusRef = useRef<any>(null)

  // Add a ref to store the latest location
  const latLong = useRef<any>({ lat: 0, lng: 0 })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, response])

  useEffect(() => {
    if (location) {
      locationRef.current = location
      console.log(`Location updated: ${location.city}, ${location.state}, ${location.country}`)
    }
    if (radius) {
      radiusRef.current = radius
      console.log(`Radius updated: ${radius}m`)
    }
  }, [location,radius])

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Speech Recognition setup
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = "en-US"

        let pauseTimeout: any

        recognitionRef.current.onresult = (event: any) => {
          const userTranscript = event.results[0][0].transcript
          console.log("Interim result:", userTranscript) // Log interim result
          setTranscript(userTranscript)

          // Clear any existing timeout
          if (pauseTimeout) clearTimeout(pauseTimeout)

          // Set a timeout to trigger API after 2 seconds of no speech
          pauseTimeout = setTimeout(() => {
            console.log("Final result:", userTranscript) // Log final result
            setMessages((prev) => [...prev, { role: "user", content: userTranscript }])
            handleSendMessage(userTranscript, locationRef.current, radiusRef.current) // Use locationRef.current
            recognitionRef.current?.stop() // Stop listening until toggled again
            setIsListening(false)
          }, 900)
        }

        recognitionRef.current.onend = () => {
          console.log("Speech recognition ended") // Log when recognition ends
          if (isListening) {
            recognitionRef.current?.start() // Restart listening if still toggled on
          }
        }
      }

      // Speech Synthesis setup
      if ("speechSynthesis" in window) {
        synthRef.current = window.speechSynthesis
      }
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (synthRef.current && utteranceRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  // Handle sending message to API
  const handleSendMessage = async (message: string, location: any, radius:any, voice = true) => {
    try {
      setIsLoading(true)
      setResponse("") // reset UI output
      if (!voice) {
        setMessages((prev) => [...prev, { role: "user", content: message }])
      }
      const res = await fetch("/api/chat2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [...messages, { role: "user", content: message }], location: location, radius: radius }),
      })

      if (!res.ok || !res.body) {
        throw new Error("Failed to get response")
      }

      const responseText = await res.json();
      setPoi(responseText.poi)
      setMessages((prev) => [...prev, { role: "assistant", content: responseText.content }])
      speakText(responseText.content)
    } catch (err) {
      console.error("Error during stream:", err)
      const errorMessage = "Oops! Something went wrong. Try again."
      setMessages((prev) => [...prev, { role: "assistant", content: errorMessage }])
      speakText(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle location change
  const handleLocationChange = (locationData: { city: string; state: string; country: string, lat: string, lon: string }) => {
    setLocation({ city: locationData.city, state: locationData.state, country: locationData.country, lat: locationData.lat, lon: locationData.lon })

    console.log(`Location on handleLocation Change: ${locationData.city}, ${locationData.state}, ${locationData.country}`)
  }

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      setIsListening(false)
    } else {
      if (synthRef.current) {
        synthRef.current.cancel()
        setIsSpeaking(false)
      }

      if (recognitionRef.current) {
        recognitionRef.current.start()
        setIsListening(true)
      }
    }
  }

  // Break text into sentences and add a small pause between each sentence
  const speakText = (text: string) => {
    if (synthRef.current) {
      const sentences = text.split(/(?<=[.!?])\s+/) // Split text into sentences
      sentences.forEach((sentence, index) => {
        const utterance = new SpeechSynthesisUtterance(sentence)
        utterance.rate = 1 // Normal speech rate
        utterance.pitch = 1 // Normal pitch
        utterance.volume = 1 // Full volume

        // Select a UK English voice
        const voices = synthRef.current?.getVoices() || []
        const ukVoice = voices.find(
          (voice: any) => voice.lang === "en-GB" && voice.voiceURI === "Google UK English Female",
        )
        if (ukVoice) {
          utterance.voice = ukVoice
        }

        utterance.onstart = () => {
          setIsSpeaking(true)
        }

        utterance.onend = () => {
          if (index === sentences.length - 1) {
            setIsSpeaking(false)
          }
        }

        synthRef.current.speak(utterance)
      })
    }
  }

  // Toggle speech
  const toggleSpeech = () => {
    if (isSpeaking && synthRef.current) {
      synthRef.current.cancel()
      setIsSpeaking(false)
    } else if (!isSpeaking && response) {
      speakText(response)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-200 to-red-200 flex flex-col items-center p-4">
      <header className="w-full max-w-2xl text-center mb-6">
        <h1 className="text-3xl font-bold text-primary mb-2">Travel Guide</h1>
        <p className="text-gray-600">I can help you find places within a {radius}m radius</p>
      </header>

      {/* Dropdown for radius selection */}
      <div className="mb-4">
        <Select value={radius.toString()} onValueChange={(value) => setRadius(Number(value))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select Radius" />
          </SelectTrigger>
          <SelectContent className="absolute z-[500]">
            <SelectItem value="100">100m</SelectItem>
            <SelectItem value="200">200m</SelectItem>
            <SelectItem value="500">500m</SelectItem>
            <SelectItem value="1000">1Km</SelectItem>
            <SelectItem value="2000">2Km</SelectItem>
            <SelectItem value="3000">3Km</SelectItem>
            <SelectItem value="5000">5Km</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Map Component */}
      <Card className="w-full max-w-2xl mb-6 bg-white shadow-lg">
        <CardContent className="p-4">
          <div className="h-[300px] rounded-lg overflow-hidden">
            <MapComponent onLocationChange={handleLocationChange} radius={Number(radius)} poi={poi}/>
          </div>
          {location && (
            <div className="mt-2 text-sm flex items-center text-gray-600">
              <MapPin className="w-4 h-4 mr-1" />
              <span>
                {location.city}, {location.state}, {location.country}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl mb-6 bg-white shadow-lg">
        <CardContent className="p-4">
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  "p-3 rounded-lg max-w-[80%] text-black",
                  msg.role === "user" ? "bg-blue-100 ml-auto" : "bg-gray-100 mr-auto",
                )}
              >
                { msg.role === "user" ? msg.content : <pre className="text-wrap font-sans">{msg.content}</pre> }
              </div>
            ))}

            {isLoading && (
              <div className="bg-gray-100 p-3 rounded-lg max-w-[80%] mr-auto">
                <div className="flex space-x-2">
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </CardContent>
      </Card>

      {/* Chat Box Component */}
      <div className="mt-4 w-full max-w-2xl">
        <ChatBox onSendMessage={(message) => handleSendMessage(message, locationRef.current, radiusRef.current, false)} />
      </div>

      <div className="w-full max-w-2xl flex justify-center space-x-4 mt-6">
        <Button
          onClick={toggleListening}
          className={cn(
            "rounded-full w-16 h-16 flex items-center justify-center",
            isListening ? "bg-red-500 hover:bg-red-600" : "bg-primary",
          )}
          disabled={isLoading}
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </Button>

        <Button
          onClick={toggleSpeech}
          className={cn(
            "rounded-full w-16 h-16 flex items-center justify-center",
            isSpeaking ? "bg-red-500 hover:bg-red-600" : "bg-primary",
          )}
          disabled={!response || isLoading}
        >
          {isSpeaking ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </Button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        {isListening ? (
          <p className="animate-pulse">Listening...</p>
        ) : isSpeaking ? (
          <p>Speaking...</p>
        ) : (
          <p>Press the microphone button to ask a question</p>
        )}
      </div>
    </div>
  )
}
