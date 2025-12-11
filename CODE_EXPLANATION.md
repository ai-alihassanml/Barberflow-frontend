# Code Explanation: Speech-to-Text and Text-to-Speech Flow

## Overview

This document explains where **Speech-to-Text** and **Text-to-Speech** happen in your application.

---

## 🔄 Complete Voice Chat Flow

### **1. Speech-to-Text (STT) - Happens in BACKEND** ✅

**Location:** Backend (FastAPI server at `http://127.0.0.1:8000`)

**Flow:**
```
Frontend (Records Audio) 
    ↓
Sends Audio File to Backend
    ↓
Backend Processes Audio (Speech Recognition)
    ↓
Returns Text Transcript
```

**Frontend Code:**
- **File:** `src/app/page.js`
- **Function:** `startRecording()` (lines 151-213)
  - Uses browser's `MediaRecorder` API to record audio
  - Converts audio to WAV format
  - Sends audio file to backend via `handleVoiceSubmit()`

- **File:** `src/lib/api.js`
- **Function:** `voiceChat()` (lines 95-119)
  - Sends audio file to `/voice/chat` endpoint
  - Backend does the speech recognition

**Backend Code (Your FastAPI):**
```python
@app.post("/voice/chat")
async def voice_chat(file: UploadFile = File(...)):
    # 1. Receives audio file from frontend
    raw = await file.read()
    
    # 2. Uses speech_recognition library (BACKEND)
    recognizer = sr.Recognizer()
    with sr.AudioFile(io.BytesIO(raw)) as source:
        audio = recognizer.record(source)
    
    # 3. Converts speech to text using Google Speech API (BACKEND)
    transcript = recognizer.recognize_google(audio)
    
    # 4. Sends transcript to LLM and gets response
    result = await agent.ainvoke(inputs)
    
    # 5. Returns both transcript and reply
    return {"transcript": transcript, "reply": ai_message}
```

**Key Point:** The actual speech-to-text conversion happens in the **BACKEND** using Python's `speech_recognition` library with Google's Speech API.

---

### **2. Text-to-Speech (TTS) - Happens in FRONTEND** ✅

**Location:** Frontend (Browser)

**Flow:**
```
Backend Returns Text Response
    ↓
Frontend Receives Text
    ↓
Frontend Converts Text to Speech (Browser API)
    ↓
Browser Speaks the Text
```

**Frontend Code:**
- **File:** `src/app/page.js`
- **Function:** `speakText()` (lines 226-269)
  - Uses browser's `SpeechSynthesis` API (Web Speech API)
  - Converts text to speech **entirely in the browser**
  - No backend call needed

**Code Details:**
```javascript
const speakText = (text) => {
  // Uses browser's built-in Speech Synthesis API
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Configure voice settings
  utterance.rate = 1.0;  // Speed
  utterance.pitch = 1.0;  // Pitch
  utterance.volume = 1.0; // Volume
  
  // Select best available voice
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = preferredVoice;
  
  // Speak the text (happens in browser)
  window.speechSynthesis.speak(utterance);
};
```

**Key Point:** Text-to-speech happens **entirely in the FRONTEND** using the browser's built-in Web Speech API. No backend is involved.

---

## 📊 Summary Table

| Feature | Location | Technology Used |
|---------|----------|----------------|
| **Speech-to-Text** | **BACKEND** | Python `speech_recognition` + Google Speech API |
| **Text-to-Speech** | **FRONTEND** | Browser Web Speech API (`SpeechSynthesis`) |
| **Audio Recording** | **FRONTEND** | Browser `MediaRecorder` API |
| **Audio Format Conversion** | **FRONTEND** | Web Audio API (converts to WAV) |
| **LLM Chat** | **BACKEND** | Your LangChain agent |

---

## 🔍 Detailed Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User clicks "Start Recording"                            │
│     ↓                                                         │
│  2. MediaRecorder records audio (WebM format)                │
│     ↓                                                         │
│  3. Convert audio to WAV format                              │
│     ↓                                                         │
│  4. Send audio file to backend                              │
│     ────────────────────────────────────────────────────────│
│                                                               │
│  8. Receive text response from backend                       │
│     ↓                                                         │
│  9. Display text in chat UI                                  │
│     ↓                                                         │
│  10. Use SpeechSynthesis API to speak text                   │
│      (Text-to-Speech happens HERE in browser)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          ↕ HTTP Request
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  5. Receive audio file                                        │
│     ↓                                                         │
│  6. Use speech_recognition to convert audio to text          │
│     (Speech-to-Text happens HERE in backend)                 │
│     ↓                                                         │
│  7. Send transcript to LLM, get response                    │
│     ↓                                                         │
│  8. Return {"transcript": "...", "reply": "..."}            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Why This Architecture?

### **Speech-to-Text in Backend:**
- ✅ More accurate (Google Speech API is powerful)
- ✅ Consistent across all browsers
- ✅ Can use advanced models
- ✅ Handles different languages better

### **Text-to-Speech in Frontend:**
- ✅ No server load (browser does it)
- ✅ Instant response (no network delay)
- ✅ Works offline (once page is loaded)
- ✅ Free (no API costs)
- ✅ Better user experience (immediate feedback)

---

## 🎯 Key Functions Reference

### Frontend Functions:

1. **`startRecording()`** - Records audio using browser API
2. **`convertToWav()`** - Converts audio format (frontend)
3. **`handleVoiceSubmit()`** - Sends audio to backend, receives response
4. **`speakText()`** - Converts text to speech (frontend, browser API)
5. **`voiceChat()`** (in api.js) - API call to backend

### Backend Endpoints:

1. **`POST /voice/chat`** - Receives audio, does STT, returns transcript + reply
2. **`POST /voice/transcribe`** - Just does STT, returns transcript only

---

## 🔧 Technologies Used

**Frontend:**
- `MediaRecorder` API - Audio recording
- `Web Audio API` - Audio format conversion
- `SpeechSynthesis` API - Text-to-speech
- `fetch()` - HTTP requests to backend

**Backend:**
- `speech_recognition` (Python) - Speech-to-text
- `Google Speech API` - Actual STT service
- `LangChain` - LLM agent
- `FastAPI` - Web framework

---

## ✅ Quick Answer

**Q: Where does Speech-to-Text happen?**  
**A: BACKEND** - Python `speech_recognition` library processes audio

**Q: Where does Text-to-Speech happen?**  
**A: FRONTEND** - Browser's `SpeechSynthesis` API speaks the text

