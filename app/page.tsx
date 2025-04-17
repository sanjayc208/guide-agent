"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"

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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [response, setResponse] = useState("")
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hello! I'm your London travel guide. How can I help you explore London today?" },
  ])
  const [isLoading, setIsLoading] = useState(false)

  const recognitionRef: any = useRef<typeof SpeechRecognition | null>(null)
  const synthRef:any = useRef<SpeechSynthesis | null>(null)
  const utteranceRef:any = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, response]);
  
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

        let pauseTimeout:any;

        recognitionRef.current.onresult = (event:any) => {
          const userTranscript = event.results[0][0].transcript
          console.log("Interim result:", userTranscript) // Log interim result
          setTranscript(userTranscript)

          // Clear any existing timeout
          if (pauseTimeout) clearTimeout(pauseTimeout)

          // Set a timeout to trigger API after 2 seconds of no speech
          pauseTimeout = setTimeout(() => {
            console.log("Final result:", userTranscript) // Log final result
            setMessages((prev) => [...prev, { role: "user", content: userTranscript }])
            handleSendMessage(userTranscript)
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
  const handleSendMessage = async (message: string) => {
    try {
      setIsLoading(true);
      setResponse(""); // reset UI output
  
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [...messages, { role: "user", content: message }] }),
      });
  
      if (!res.ok || !res.body) {
        throw new Error("Failed to get response");
      }
  
      const decoder = new TextDecoder();
      const reader = res.body.getReader();
  
      let fullResponse = "";
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        const chunk = decoder.decode(value, { stream: true });
  
        // Split on newlines for NDJSON (one JSON object per line)
        const lines = chunk.split("\n").filter(line => line.trim() !== "");
  
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const content = json?.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setResponse(prev => prev + content); // LIVE update
            }
          } catch (err) {
            console.error("Streaming JSON parse error:", err, line);
          }
        }
      }
  
      setMessages(prev => [...prev, { role: "assistant", content: fullResponse }]);
      speakText(fullResponse);
  
    } catch (err) {
      console.error("Error during stream:", err);
      const errorMessage = "Oops! Something went wrong. Try again.";
      setMessages(prev => [...prev, { role: "assistant", content: errorMessage }]);
      speakText(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  

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
      const sentences = text.split(/(?<=[.!?])\s+/); // Split text into sentences
      sentences.forEach((sentence, index) => {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.rate = 1; // Normal speech rate
        utterance.pitch = 1; // Normal pitch
        utterance.volume = 1; // Full volume

        // Select a UK English voice
        const voices = synthRef.current?.getVoices() || [];
        const ukVoice = voices.find((voice:any) => voice.lang === "en-GB" && voice.voiceURI === 'Google UK English Female');
        if (ukVoice) {
          utterance.voice = ukVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          if (index === sentences.length - 1) {
            setIsSpeaking(false);
          }
        };
        
        synthRef.current.speak(utterance);
      });
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex flex-col items-center p-4">
      <header className="w-full max-w-md text-center mb-6">
        <h1 className="text-3xl font-bold text-blue-800 mb-2">London Travel Guide</h1>
        <p className="text-gray-600">Ask me anything about London!</p>
      </header>

      <Card className="w-full max-w-md mb-6 bg-white shadow-lg">
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
                {msg.content}
              </div>
            ))}

            {/* {response && (
              <div className="bg-gray-100 p-3 rounded-lg max-w-[80%] mr-auto text-black">
                {response}
              </div>
            )} */}
            
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

      <div className="w-full max-w-md flex justify-center space-x-4">
        <Button
          onClick={toggleListening}
          className={cn(
            "rounded-full w-16 h-16 flex items-center justify-center",
            isListening ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600",
          )}
          disabled={isLoading}
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </Button>

        <Button
          onClick={toggleSpeech}
          className={cn(
            "rounded-full w-16 h-16 flex items-center justify-center",
            isSpeaking ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600",
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
