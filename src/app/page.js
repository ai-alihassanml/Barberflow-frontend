'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { streamChatMessage, voiceChat } from '@/lib/api';
import TextChat from '@/components/TextChat';
import VoiceChat from '@/components/VoiceChat';
import CallPreview from '@/components/CallPreview';
import { cleanMarkdownForSpeech, formatForSpeech } from '@/utils/textProcessor';

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
  const [isCallSpeaking, setIsCallSpeaking] = useState(false);
  const [conversationalMode, setConversationalMode] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const callMediaRecorderRef = useRef(null);
  const callAudioChunksRef = useRef([]);
  const callStreamRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Convert audio blob to WAV format
  const convertToWav = useCallback(async (audioBlob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const wav = audioBufferToWav(audioBuffer);
      return new Blob([wav], { type: 'audio/wav' });
    } catch (err) {
      console.error('Audio conversion error:', err);
      throw new Error('Could not convert audio format. Please try uploading a WAV file.');
    }
  }, []);

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

  // Text-to-speech function
  const speakText = useCallback((text) => {
    // Cancel any ongoing speech
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
    }

    if (!text || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    setIsSpeaking(true);
    
    // Clean markdown syntax and format for natural speech
    const cleanedText = cleanMarkdownForSpeech(text);
    const speechFormattedText = formatForSpeech(cleanedText);
    
    // Use the cleaned text for speech synthesis
    const finalText = speechFormattedText || cleanedText || text;
    
    const utterance = new SpeechSynthesisUtterance(finalText);
    
    // Configure voice settings
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
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
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    }
  }, []);

  // Load voices when available
  useEffect(() => {
    if ('speechSynthesis' in window) {
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

  // Text chat handlers
  const handleTextSubmit = useCallback(async (e) => {
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
  }, [textInput, textMessages, isTextLoading]);

  // Voice chat handlers
  const startRecording = useCallback(async () => {
    try {
      stopSpeaking();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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

          if (audioBlob.size < 1000) {
            setError('Recording too short. Please record for at least 1 second.');
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          let wavBlob;
          try {
            wavBlob = await convertToWav(audioBlob);
          } catch (convertErr) {
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
  }, [stopSpeaking, convertToWav]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleVoiceSubmit = useCallback(async (audioBlob) => {
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

      if (result.reply) {
        setTimeout(() => {
          speakText(result.reply);
        }, 300);
      }
    } catch (err) {
      setError(err.message || 'Failed to process voice message');
    } finally {
      setIsVoiceLoading(false);
    }
  }, [speakText]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsVoiceLoading(true);
    setError(null);

    try {
      let audioFile = file;
      
      if (!file.name.toLowerCase().endsWith('.wav') && !file.type.includes('wav')) {
        try {
          const wavBlob = await convertToWav(file);
          audioFile = new File([wavBlob], file.name.replace(/\.[^/.]+$/, '.wav'), { 
            type: 'audio/wav' 
          });
        } catch (convertErr) {
          console.warn('Could not convert audio to WAV, sending original:', convertErr);
        }
      }
      
      const result = await voiceChat(audioFile);
      setVoiceMessages(prev => [
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
      const errorMessage = err.message || 'Failed to process audio file';
      setError(errorMessage);
      console.error('Voice chat error:', err);
    } finally {
      setIsVoiceLoading(false);
      e.target.value = '';
    }
  }, [convertToWav, speakText]);

  const handleReplayLast = useCallback((content) => {
    if (content) {
      speakText(content);
    }
  }, [speakText]);

  // Enhanced speakText with interruption support for calls
  const speakTextWithInterruption = useCallback((text, onComplete, onInterrupt) => {
    // Cancel any ongoing speech
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
    }

    if (!text || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      if (onComplete) onComplete();
      return;
    }

    setIsCallSpeaking(true);
    
    // Clean markdown syntax and format for natural speech
    const cleanedText = cleanMarkdownForSpeech(text);
    const speechFormattedText = formatForSpeech(cleanedText);
    
    // Use the cleaned text for speech synthesis
    const finalText = speechFormattedText || cleanedText || text;
    
    const utterance = new SpeechSynthesisUtterance(finalText);
    
    // Configure voice settings
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to use a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.includes('en') && (voice.name.includes('Natural') || voice.name.includes('Neural'))
    ) || voices.find(voice => voice.lang.includes('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      setIsCallSpeaking(false);
      speechSynthesisRef.current = null;
      if (onComplete) onComplete();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsCallSpeaking(false);
      speechSynthesisRef.current = null;
      if (onComplete) onComplete();
    };

    // Store reference for interruption
    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);

    // Return interrupt function
    return () => {
      window.speechSynthesis.cancel();
      setIsCallSpeaking(false);
      speechSynthesisRef.current = null;
      if (onInterrupt) onInterrupt();
    };
  }, [cleanMarkdownForSpeech, formatForSpeech]);

  // Call preview handlers
  const handleCallSubmit = useCallback(async (audioBlob) => {
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
      const result = await voiceChat(audioFile, callMessages);

      setCallMessages(prev => [
        ...prev,
        { role: 'user', content: result.transcript },
        { role: 'assistant', content: result.reply }
      ]);

      setIsCallProcessing(false);

      if (result.reply && conversationalMode) {
        // In conversational mode, speak immediately
        setTimeout(() => {
          speakTextWithInterruption(result.reply, () => {
            // Speech completed, ready for next input
            console.log('Call response speech completed');
            setIsCallSpeaking(false);
            // The conversation state will automatically return to listening
            // via the CallPreview component's useEffect
          }, () => {
            // Speech interrupted
            setIsCallSpeaking(false);
          });
        }, 300);
      } else {
        setIsCallProcessing(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to process call audio');
      setIsCallProcessing(false);
    }
  }, [convertToWav, speakTextWithInterruption, conversationalMode, callMessages]);

  // Handle voice input from conversational call
  const handleCallVoiceInput = useCallback(async (audioBlob) => {
    await handleCallSubmit(audioBlob);
  }, [handleCallSubmit]);

  const startCall = useCallback(async () => {
    if (isCallRecording || isCallProcessing) return;

    try {
      stopSpeaking();
      setConversationalMode(true);
      setIsCallRecording(true);
      setError(null);

      console.log('Starting conversational call mode');
    } catch (err) {
      setError('Failed to start call: ' + err.message);
      setConversationalMode(false);
      setIsCallRecording(false);
    }
  }, [isCallRecording, isCallProcessing, stopSpeaking]);

  const stopCall = useCallback(() => {
    try {
      // Stop any ongoing speech
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
        setIsCallSpeaking(false);
        speechSynthesisRef.current = null;
      }

      // Clean up call state
      setConversationalMode(false);
      setIsCallRecording(false);
      setIsCallProcessing(false);
      setIsCallSpeaking(false);

      console.log('Stopped conversational call mode');
    } catch (err) {
      setError('Failed to stop call: ' + err.message);
    }
  }, []);

  // Handle interruption of call speech
  const handleCallInterrupt = useCallback(() => {
    if (speechSynthesisRef.current && isCallSpeaking) {
      window.speechSynthesis.cancel();
      setIsCallSpeaking(false);
      speechSynthesisRef.current = null;
      console.log('Call speech interrupted');
    }
  }, [isCallSpeaking]);

  // Memoized empty state checks
  const isTextChatEmpty = useMemo(() => textMessages.length === 0, [textMessages.length]);
  const isVoiceChatEmpty = useMemo(() => voiceMessages.length === 0, [voiceMessages.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          Barber Booking Agent
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900/20 dark:border-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <TextChat
            messages={textMessages}
            inputValue={textInput}
            onInputChange={setTextInput}
            onSubmit={handleTextSubmit}
            isLoading={isTextLoading}
            isEmpty={isTextChatEmpty}
          />

          <VoiceChat
            messages={voiceMessages}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onFileUpload={handleFileUpload}
            onReplayLast={handleReplayLast}
            onStopSpeaking={stopSpeaking}
            isRecording={isRecording}
            isLoading={isVoiceLoading}
            isSpeaking={isSpeaking}
            isEmpty={isVoiceChatEmpty}
          />

          <CallPreview
            messages={callMessages}
            onStartCall={startCall}
            onStopCall={stopCall}
            onVoiceInput={handleCallVoiceInput}
            onInterruptSpeaking={handleCallInterrupt}
            isRecording={isCallRecording}
            isProcessing={isCallProcessing}
            isSpeaking={isCallSpeaking}
            conversationalMode={conversationalMode}
          />
        </div>
      </div>
    </div>
  );
}
