'use client';

import { useRef, useEffect, memo } from 'react';
import AnimatedIcon from './AnimatedIcon';
import MarkdownRenderer from './MarkdownRenderer';

function VoiceChat({
  messages = [],
  onStartRecording,
  onStopRecording,
  onFileUpload,
  onReplayLast,
  onStopSpeaking,
  isRecording = false,
  isLoading = false,
  isSpeaking = false,
  isEmpty = true,
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-black rounded-lg shadow-lg flex flex-col min-h-[420px] md:min-h-[520px] lg:h-[560px] xl:h-[600px] text-white">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-semibold">Voice Chat</h2>
      </div>

      {isEmpty && messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 space-y-6">
          <AnimatedIcon isActive={isRecording || isSpeaking} />
          <div className="text-center space-y-1">
            <p className="text-lg font-medium">
              {isRecording ? 'Recording...' : isSpeaking ? 'Speaking...' : 'Start voice chat'}
            </p>
            <p className="text-sm text-gray-400">
              {isRecording
                ? 'Speak your message, then stop recording to send.'
                : isSpeaking
                ? 'The agent is speaking the response.'
                : 'Record a voice message or upload an audio file to start.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-2`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-white">{msg.content}</p>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
              </div>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => onReplayLast && onReplayLast(msg.content)}
                  disabled={isSpeaking}
                  className="p-2 text-gray-400 hover:text-blue-400 disabled:opacity-50 transition-colors"
                  title="Replay audio"
                >
                  🔊
                </button>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-lg px-4 py-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="p-4 border-t border-gray-800 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={isLoading || isSpeaking}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
          </button>

          <label className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center">
            📁 Upload
            <input
              type="file"
              accept="audio/*"
              onChange={onFileUpload}
              className="hidden"
              disabled={isLoading || isSpeaking}
            />
          </label>
        </div>

        {messages.length > 0 && (
          <div className="flex gap-2">
            {messages.filter(m => m.role === 'assistant').length > 0 && (
              <button
                onClick={() => {
                  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
                  if (lastAssistantMsg && onReplayLast) {
                    onReplayLast(lastAssistantMsg.content);
                  }
                }}
                disabled={isSpeaking || isLoading}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔊 Replay Last Response
              </button>
            )}
            {isSpeaking && (
              <button
                onClick={onStopSpeaking}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                ⏹ Stop Speaking
              </button>
            )}
          </div>
        )}

        {isRecording && (
          <div className="text-center text-red-400 font-medium animate-pulse">
            🎤 Recording...
          </div>
        )}

        {isSpeaking && !isRecording && (
          <div className="text-center text-blue-400 font-medium animate-pulse">
            🔊 Speaking...
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(VoiceChat);

