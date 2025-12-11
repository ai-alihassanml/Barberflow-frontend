'use client';

import { useState, useRef, useEffect } from 'react';
import { sendChatMessage, streamChatMessage, transcribeAudio, voiceChat } from '@/lib/api';

export default function Home() {
  const [textMessages, setTextMessages] = useState([]);
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [callMessages, setCallMessages] = useState([]);
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [isCallProcessing, setIsCallProcessing] = useState(false);

  const textMessagesEndRef = useRef(null);
  const voiceMessagesEndRef = useRef(null);
  const callMessagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const callMediaRecorderRef = useRef(null);
  const callAudioChunksRef = useRef([]);
  const callStreamRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  const scrollToBottom = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom(textMessagesEndRef);
  }, [textMessages]);

  useEffect(() => {
    scrollToBottom(voiceMessagesEndRef);
  }, [voiceMessages]);

  useEffect(() => {
    scrollToBottom(callMessagesEndRef);
  }, [callMessages]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleTextSubmit = async (e) => {
    if (e) {
      e.preventDefault();
    }
    if (!textInput.trim() || isTextLoading) return;

    const userMessage = { role: 'user', content: textInput };
    const newMessages = [...textMessages, userMessage];
    setTextMessages(newMessages);
    setTextInput('');
    setIsTextLoading(true);
    setError(null);

    try {
      let fullResponse = '';
      
      // Use streaming for better UX
      for await (const data of streamChatMessage(textInput, textMessages)) {
        if (data.type === 'token') {
          fullResponse += data.token;
          setTextMessages([...newMessages, { role: 'assistant', content: fullResponse }]);
        } else if (data.type === 'complete') {
          fullResponse = data.message;
          setTextMessages([...newMessages, { role: 'assistant', content: fullResponse }]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to send message');
      setTextMessages(newMessages);
    } finally {
      setIsTextLoading(false);
    }
  };

  // Convert audio blob to WAV format
  const convertToWav = async (audioBlob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const wav = audioBufferToWav(audioBuffer);
      return new Blob([wav], { type: 'audio/wav' });
    } catch (err) {
      console.error('Audio conversion error:', err);
      // If conversion fails, return original blob and let backend handle it
      // Some backends can handle WebM/OGG formats
      throw new Error('Could not convert audio format. Please try uploading a WAV file.');
    }
  };

  // Helper function to convert AudioBuffer to WAV
  const audioBufferToWav = (buffer) => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    // Write WAV header
    const setUint16 = (data) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    const setUint32 = (data) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    // RIFF identifier
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // File length - 8
    setUint32(0x45564157); // "WAVE"

    // Format chunk identifier
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // Format chunk length
    setUint16(1); // Sample format (raw)
    setUint16(numOfChan); // Number of channels
    setUint32(buffer.sampleRate); // Sample rate
    setUint32(buffer.sampleRate * 2 * numOfChan); // Byte rate
    setUint16(numOfChan * 2); // Block align
    setUint16(16); // Bits per sample

    // Data chunk identifier
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4); // Data chunk length

    // Get interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    // Interleave
    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return bufferArray;
  };

  const startRecording = async () => {
    try {
      // Stop any ongoing speech when starting to record
      stopSpeaking();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to use WAV-compatible mime type, fallback to default
      const options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        delete options.mimeType;
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          if (audioChunksRef.current.length === 0) {
            setError('No audio recorded. Please try again.');
            stream.getTracks().forEach(track => track.stop());
            return;
          }

          const audioBlob = new Blob(audioChunksRef.current, { 
            type: audioChunksRef.current[0]?.type || 'audio/webm' 
          });

          // Check if audio is too small (likely empty or very short)
          if (audioBlob.size < 1000) {
            setError('Recording too short. Please record for at least 1 second.');
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          // Convert to WAV format for backend compatibility
          let wavBlob;
          try {
            wavBlob = await convertToWav(audioBlob);
          } catch (convertErr) {
            // If conversion fails, try sending as-is (some backends might accept it)
            console.warn('WAV conversion failed, trying original format:', convertErr);
            wavBlob = audioBlob;
          }
          
          await handleVoiceSubmit(wavBlob);
        } catch (err) {
          setError('Failed to process recording: ' + err.message);
        } finally {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to access microphone: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Text-to-speech function
  const speakText = (text) => {
    // Cancel any ongoing speech
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
    }

    if (!text || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    setIsSpeaking(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice settings
    utterance.rate = 1.0; // Speech rate (0.1 to 10)
    utterance.pitch = 1.0; // Pitch (0 to 2)
    utterance.volume = 1.0; // Volume (0 to 1)
    
    // Try to use a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.includes('en') && (voice.name.includes('Natural') || voice.name.includes('Neural'))
    ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    }
  };

  // Load voices when available
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Some browsers load voices asynchronously
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          return;
        }
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const handleCallSubmit = async (audioBlob) => {
    setIsCallProcessing(true);
    setError(null);

    try {
      let wavBlob;
      try {
        wavBlob = await convertToWav(audioBlob);
      } catch (convertErr) {
        console.warn('WAV conversion failed for call, using original format:', convertErr);
        wavBlob = audioBlob;
      }

      const audioFile = new File([wavBlob], 'call-recording.wav', { type: 'audio/wav' });
      const result = await voiceChat(audioFile);

      setCallMessages(prev => [
        ...prev,
        { role: 'user', content: result.transcript },
        { role: 'assistant', content: result.reply }
      ]);

      if (result.reply) {
        setTimeout(() => {
          speakText(result.reply);
        }, 300);
      }
    } catch (err) {
      setError(err.message || 'Failed to process call audio');
    } finally {
      setIsCallProcessing(false);
    }
  };

  const startCall = async () => {
    if (isCallRecording || isCallProcessing) return;

    try {
      stopSpeaking();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        delete options.mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      callMediaRecorderRef.current = mediaRecorder;
      callStreamRef.current = stream;
      callAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          callAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          if (callAudioChunksRef.current.length === 0) {
            setError('No audio recorded. Please try again.');
            return;
          }

          const audioBlob = new Blob(callAudioChunksRef.current, {
            type: callAudioChunksRef.current[0]?.type || 'audio/webm',
          });

          if (audioBlob.size < 1000) {
            setError('Call was too short. Please speak for at least 1 second.');
            return;
          }

          await handleCallSubmit(audioBlob);
        } catch (err) {
          setError('Failed to process call audio: ' + err.message);
        } finally {
          if (callStreamRef.current) {
            callStreamRef.current.getTracks().forEach((track) => track.stop());
            callStreamRef.current = null;
          }
          callMediaRecorderRef.current = null;
          callAudioChunksRef.current = [];
          setIsCallRecording(false);
        }
      };

      mediaRecorder.start();
      setIsCallRecording(true);
    } catch (err) {
      setError('Failed to start call: ' + err.message);
    }
  };

  const stopCall = () => {
    if (callMediaRecorderRef.current && isCallRecording) {
      callMediaRecorderRef.current.stop();
    }
  };

  const handleVoiceSubmit = async (audioBlob) => {
    setIsVoiceLoading(true);
    setError(null);

    try {
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      const result = await voiceChat(audioFile);

      setVoiceMessages(prev => [
        ...prev,
        { role: 'user', content: result.transcript },
        { role: 'assistant', content: result.reply }
      ]);

      // Automatically speak the assistant's response
      if (result.reply) {
        // Small delay to ensure UI updates first
        setTimeout(() => {
          speakText(result.reply);
        }, 300);
      }
    } catch (err) {
      setError(err.message || 'Failed to process voice message');
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsVoiceLoading(true);
    setError(null);

    try {
      let audioFile = file;
      
      // If file is not WAV, try to convert it
      if (!file.name.toLowerCase().endsWith('.wav') && !file.type.includes('wav')) {
        try {
          audioFile = await convertToWav(file);
          audioFile = new File([audioFile], file.name.replace(/\.[^/.]+$/, '.wav'), { 
            type: 'audio/wav' 
          });
        } catch (convertErr) {
          // If conversion fails, try sending original file
          console.warn('Could not convert audio to WAV, sending original:', convertErr);
        }
      }
      
      const result = await voiceChat(audioFile);
      setVoiceMessages(prev => [
        ...prev,
        { role: 'user', content: result.transcript },
        { role: 'assistant', content: result.reply }
      ]);

      // Automatically speak the assistant's response
      if (result.reply) {
        // Small delay to ensure UI updates first
        setTimeout(() => {
          speakText(result.reply);
        }, 300);
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to process audio file';
      setError(errorMessage);
      console.error('Voice chat error:', err);
    } finally {
      setIsVoiceLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          Barber Booking Agent
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {/* Text Chat Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col min-h-[420px] md:min-h-[520px] lg:h-[560px] xl:h-[600px]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Text Chat
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {textMessages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  Start a conversation by typing a message below
                </div>
              )}
              
              {textMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {isTextLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={textMessagesEndRef} />
            </div>

            <form onSubmit={handleTextSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2 items-end">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none max-h-32"
                  disabled={isTextLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isTextLoading && textInput.trim()) {
                        handleTextSubmit();
                      }
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isTextLoading || !textInput.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Press Enter to send, Shift+Enter for a new line
              </p>
            </form>
          </div>

          {/* Voice Chat Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col min-h-[420px] md:min-h-[520px] lg:h-[560px] xl:h-[600px]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Voice Chat
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {voiceMessages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                  Record a voice message or upload an audio file to start
                </div>
              )}
              
              {voiceMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-2`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => speakText(msg.content)}
                      disabled={isSpeaking}
                      className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
                      title="Replay audio"
                    >
                      🔊
                    </button>
                  )}
                </div>
              ))}
              
              {isVoiceLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={voiceMessagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isVoiceLoading || isSpeaking}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
                </button>
                
                <label className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center">
                  📁 Upload
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isVoiceLoading || isSpeaking}
                  />
                </label>
              </div>
              
              {/* Replay and Stop Speaking Controls */}
              {voiceMessages.length > 0 && (
                <div className="flex gap-2">
                  {voiceMessages.filter(m => m.role === 'assistant').length > 0 && (
                    <button
                      onClick={() => {
                        const lastAssistantMsg = [...voiceMessages].reverse().find(m => m.role === 'assistant');
                        if (lastAssistantMsg) {
                          speakText(lastAssistantMsg.content);
                        }
                      }}
                      disabled={isSpeaking || isVoiceLoading}
                      className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🔊 Replay Last Response
                    </button>
                  )}
                  {isSpeaking && (
                    <button
                      onClick={stopSpeaking}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                      ⏹ Stop Speaking
                    </button>
                  )}
                </div>
              )}
              
              {isRecording && (
                <div className="text-center text-red-500 font-medium animate-pulse">
                  🎤 Recording...
                </div>
              )}
              
              {isSpeaking && !isRecording && (
                <div className="text-center text-blue-500 font-medium animate-pulse">
                  🔊 Speaking...
                </div>
              )}
            </div>
          </div>

          {/* Call Preview Section */}
          <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-black rounded-lg shadow-lg flex flex-col min-h-[420px] md:min-h-[520px] lg:h-[560px] xl:h-[600px] text-white">
            <div className="p-4 border-b border-gray-800">
              <h2 className="text-xl font-semibold">
                Call Preview
              </h2>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 space-y-6">
              <div className="flex items-center justify-center w-28 h-28 rounded-full border border-dashed border-gray-700 bg-gray-900/60">
                <div className={`flex space-x-1 ${isCallRecording || isCallProcessing ? 'animate-pulse' : ''}`}>
                  <span className="w-1.5 h-6 rounded-full bg-blue-400"></span>
                  <span className="w-1.5 h-4 rounded-full bg-blue-500"></span>
                  <span className="w-1.5 h-8 rounded-full bg-blue-400"></span>
                  <span className="w-1.5 h-5 rounded-full bg-blue-500"></span>
                  <span className="w-1.5 h-7 rounded-full bg-blue-400"></span>
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-lg font-medium">
                  {isCallRecording || isCallProcessing ? 'Call in progress' : 'Preview your agent'}
                </p>
                <p className="text-sm text-gray-400">
                  {isCallRecording || isCallProcessing
                    ? 'Speak naturally, then end the call to hear your barber agent respond.'
                    : 'Start a live test call to speak to your agent as you configure and iterate.'}
                </p>
              </div>

              {callMessages.length > 0 && (
                <div className="w-full max-h-40 overflow-y-auto bg-black/40 rounded-lg p-3 text-sm space-y-2">
                  {callMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          msg.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={callMessagesEndRef} />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-800 space-y-2">
              <button
                type="button"
                onClick={isCallRecording ? stopCall : startCall}
                disabled={isCallProcessing}
                className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
                  isCallRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isCallRecording ? 'End Call' : 'Start Call'}
              </button>
              {isCallProcessing && (
                <p className="text-xs text-center text-gray-400">
                  Processing call...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
