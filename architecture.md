```mermaid
flowchart TD
    subgraph Frontend [Frontend (Browser)]
        User[User]
        MicInput[Microphone Input]
        Location[Geolocation API]
    end

    subgraph VoiceProcessing [Voice Processing]
        STT[Speech-to-Text (STT)]
        LLM[Language Model (LLM)]
        TTS[Text-to-Speech (TTS)]
    end

    subgraph Backend [Backend/API Server]
        APIServer[LLM Proxy / API Layer]
    end

    User --> MicInput
    User --> Location
    MicInput --> STT
    STT --> APIServer
    Location --> APIServer
    APIServer --> LLM
    LLM --> TTS
    TTS --> User
```