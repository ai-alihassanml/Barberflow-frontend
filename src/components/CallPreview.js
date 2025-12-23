'use client';

import { useRef, useEffect, memo, useState, useCallback } from 'react';
import SpeakingAnimation, { useSpeakingAnimation } from './SpeakingAnimation';
import MarkdownRenderer from './MarkdownRenderer';
import useConversationState from '../hooks/useConversationState';
import { createVAD, VAD_PRESETS } from '../utils/voiceActivityDetection';

function CallPreview({
  messages = [],
  onStartCall,
  onStopCall,
  onVoiceInput,
  onInterruptSpeaking,
  isRecording = false,
  isProcessing = false,
  isSpeaking = false,
  conversationalMode = false,
}) {
  const messagesEndRef = useRef(null);
  const vadRef = useRef(null);
  const audioStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Conversation state management
  const conversation = useConversationState({
    autoReturnToListening: true,
    errorTimeout: 5000,
    sessionTimeout: 300000, // 5 minutes
  });

  // Speaking animation state
  const { animationType, isActive: animationActive, intensity } = useSpeakingAnimation(
    conversation.currentState
  );

  // Local state
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [vadError, setVadError] = useState(null);
  
  // Ref to store the latest startListening function to avoid dependency issues
  const startListeningRef = useRef(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial start listening when conversation mode is enabled
  useEffect(() => {
    if (conversationalMode && conversation.mode === 'conversational' && conversation.currentState === 'listening') {
      if (startListeningRef.current) {
        startListeningRef.current();
      }
    }
  }, [conversationalMode, conversation.mode, conversation.currentState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  /**
   * Process audio input and send to backend
   */
  const processAudioInput = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    try {
      // Ensure we're in processing state (should already be from speech detection)
      if (conversation.currentState !== 'processing') {
        conversation.startProcessing();
      }

      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: audioChunksRef.current[0]?.type || 'audio/webm' 
      });

      // Clear chunks for next recording (but keep MediaRecorder running)
      audioChunksRef.current = [];

      // Send to parent component for processing
      if (onVoiceInput) {
        await onVoiceInput(audioBlob);
      }

      // Note: MediaRecorder continues recording in the background
      // VAD continues detecting speech
      // We'll transition to speaking state when parent starts speaking

    } catch (error) {
      console.error('Failed to process audio input:', error);
      conversation.setError(error);
      // On error, return to listening state
      if (conversation.mode === 'conversational') {
        conversation.startListening();
      }
    }
  }, [conversation, onVoiceInput]);

  /**
   * Initialize voice activity detection
   */
  const initializeVAD = useCallback(async (stream) => {
    try {
      vadRef.current = await createVAD(stream, {
        ...VAD_PRESETS.normal,
        onSpeechStart: () => {
          console.log('Speech started');
          // Only detect speech if we're in listening state
          if (conversation.currentState === 'listening') {
            conversation.onSpeechDetected();
          }
        },
        onSpeechEnd: async (duration) => {
          console.log('Speech ended, duration:', duration);
          // Only process if we're in processing state (speech was detected)
          // and we have audio chunks
          if (conversation.currentState === 'processing' && audioChunksRef.current.length > 0) {
            await processAudioInput();
          } else if (conversation.currentState === 'listening') {
            // If we're still in listening state, it means speech was too short or invalid
            // Just clear chunks and continue listening
            audioChunksRef.current = [];
          }
        },
        onVolumeChange: (volume) => {
          setVolumeLevel(volume);
        },
        onError: (error) => {
          console.error('VAD error:', error);
          setVadError(error.message);
          conversation.setError(error);
        },
      });

      vadRef.current.start();
      setVadError(null);
    } catch (error) {
      console.error('Failed to initialize VAD:', error);
      setVadError(error.message);
      conversation.setError(error);
    }
  }, [conversation, processAudioInput]);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback(async () => {
    try {
      if (!audioStreamRef.current) {
        audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      }

      // Initialize MediaRecorder for continuous recording
      if (!mediaRecorderRef.current) {
        const options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          delete options.mimeType;
        }

        mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current, options);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
      }

      // Start or resume recording (keep it running continuously)
      if (mediaRecorderRef.current.state === 'inactive') {
        mediaRecorderRef.current.start(100); // Collect data every 100ms
        console.log('MediaRecorder started');
      } else if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        console.log('MediaRecorder resumed');
      }

      // Initialize or restart VAD if needed
      if (!vadRef.current) {
        await initializeVAD(audioStreamRef.current);
      } else if (!vadRef.current.isActive) {
        // Restart VAD if it was stopped
        vadRef.current.start();
        console.log('VAD restarted');
      }

    } catch (error) {
      console.error('Failed to start listening:', error);
      conversation.setError(error);
    }
  }, [initializeVAD, conversation]);
  
  // Update ref whenever startListening changes
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    // Stop VAD
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Stop audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Clear audio chunks
    audioChunksRef.current = [];
    setVolumeLevel(0);
    setVadError(null);
  }, []);

  /**
   * Handle conversation start/stop
   */
  const handleConversationToggle = useCallback(async () => {
    if (conversation.mode === 'conversational') {
      // End conversation
      conversation.endConversation();
      cleanup();
      if (onStopCall) {
        onStopCall();
      }
    } else {
      // Start conversation
      conversation.startConversation();
      if (onStartCall) {
        onStartCall();
      }
      // Start listening will be triggered by the useEffect that watches conversation.currentState
    }
  }, [conversation, onStartCall, onStopCall, cleanup]);

  /**
   * Handle speaking interruption
   */
  const handleInterrupt = useCallback(() => {
    if (conversation.canInterrupt()) {
      conversation.interruptSpeaking();
      if (onInterruptSpeaking) {
        onInterruptSpeaking();
      }
    }
  }, [conversation, onInterruptSpeaking]);

  // Sync speaking state from parent component
  useEffect(() => {
    if (isSpeaking && conversation.currentState !== 'speaking') {
      // Parent component started speaking
      conversation.startSpeaking();
    } else if (!isSpeaking && conversation.currentState === 'speaking') {
      // Parent component finished speaking
      conversation.finishSpeaking();
    }
  }, [isSpeaking, conversation]);

  // Handle conversation state changes - restart listening when returning to listening state
  useEffect(() => {
    if (conversation.currentState === 'listening' && conversation.mode === 'conversational') {
      // Auto-restart listening after speaking or when entering listening state
      const timeoutId = setTimeout(() => {
        if (startListeningRef.current) {
          startListeningRef.current();
        }
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [conversation.currentState, conversation.mode]);

  // Get status text based on current state
  const getStatusText = () => {
    if (vadError) return 'Microphone error occurred';
    if (conversation.error) return `Error: ${conversation.error}`;
    
    switch (conversation.currentState) {
      case 'listening':
        return 'Listening... Speak naturally';
      case 'processing':
        return 'Processing your message...';
      case 'speaking':
        return 'Agent is responding...';
      case 'interrupted':
        return 'Response interrupted';
      case 'error':
        return 'An error occurred';
      default:
        return conversation.mode === 'conversational' 
          ? 'Conversation ready' 
          : 'Start a conversation with your agent';
    }
  };

  const getSubtitleText = () => {
    if (vadError) return 'Please check your microphone permissions and try again.';
    if (conversation.error) return 'Click to retry or end the conversation.';
    
    switch (conversation.currentState) {
      case 'listening':
        return 'I can hear you. Speak when ready, I\'ll respond automatically.';
      case 'processing':
        return 'Analyzing your message and preparing response...';
      case 'speaking':
        return 'You can interrupt me by speaking at any time.';
      case 'interrupted':
        return 'Ready for your next message.';
      default:
        return conversation.mode === 'conversational'
          ? 'Conversation is active. Click to end.'
          : 'Click to start a natural conversation with voice responses.';
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-black rounded-lg shadow-lg flex flex-col min-h-[420px] md:min-h-[520px] lg:h-[560px] xl:h-[600px] text-white">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {conversation.mode === 'conversational' ? 'Live Conversation' : 'Call Preview'}
          </h2>
          {conversation.mode === 'conversational' && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">Live</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 space-y-6">
        {/* Enhanced Speaking Animation */}
        <div className="relative">
          <SpeakingAnimation
            type={animationType}
            isActive={animationActive}
            intensity={intensity}
            size="w-32 h-32"
          />
          
          {/* Volume indicator for listening state */}
          {conversation.currentState === 'listening' && volumeLevel > 0 && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="w-24 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-400 transition-all duration-100"
                  style={{ width: `${Math.min(volumeLevel, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Text */}
        <div className="text-center space-y-1">
          <p className="text-lg font-medium">
            {getStatusText()}
          </p>
          <p className="text-sm text-gray-400">
            {getSubtitleText()}
          </p>
          
          {/* Conversation Stats */}
          {conversation.mode === 'conversational' && conversation.exchangeCount > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {conversation.exchangeCount} exchange{conversation.exchangeCount !== 1 ? 's' : ''} • 
              Session: {Math.floor((Date.now() - conversation.startTime) / 1000)}s
            </p>
          )}
        </div>

        {/* Messages Display */}
        {messages.length > 0 && (
          <div className="w-full max-h-40 overflow-y-auto bg-black/40 rounded-lg p-3 text-sm space-y-2">
            {messages.map((msg, idx) => (
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
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-white">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-800 space-y-2">
        <div className="flex gap-2">
          {/* Main conversation toggle */}
          <button
            type="button"
            onClick={handleConversationToggle}
            disabled={isProcessing && conversation.mode !== 'conversational'}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              conversation.mode === 'conversational'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {conversation.mode === 'conversational' ? 'End Conversation' : 'Start Conversation'}
          </button>

          {/* Interrupt button (only show when speaking) */}
          {conversation.currentState === 'speaking' && (
            <button
              type="button"
              onClick={handleInterrupt}
              className="px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              title="Interrupt response"
            >
              ⏸
            </button>
          )}
        </div>

        {/* Error display */}
        {(vadError || conversation.error) && (
          <div className="text-xs text-center text-red-400 bg-red-900/20 rounded p-2">
            {vadError || conversation.error}
            <button
              onClick={() => {
                setVadError(null);
                conversation.clearError();
              }}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CallPreview);

