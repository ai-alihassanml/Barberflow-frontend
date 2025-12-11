'use client';

import { useRef, useEffect, memo } from 'react';
import AnimatedIcon from './AnimatedIcon';

function CallPreview({
  messages = [],
  onStartCall,
  onStopCall,
  isRecording = false,
  isProcessing = false,
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-black rounded-lg shadow-lg flex flex-col min-h-[420px] md:min-h-[520px] lg:h-[560px] xl:h-[600px] text-white">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-semibold">Call Preview</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 space-y-6">
        <AnimatedIcon isActive={isRecording || isProcessing} />

        <div className="text-center space-y-1">
          <p className="text-lg font-medium">
            {isRecording || isProcessing ? 'Call in progress' : 'Preview your agent'}
          </p>
          <p className="text-sm text-gray-400">
            {isRecording || isProcessing
              ? 'Speak naturally, then end the call to hear your barber agent respond.'
              : 'Start a live test call to speak to your agent as you configure and iterate.'}
          </p>
        </div>

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
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-800 space-y-2">
        <button
          type="button"
          onClick={isRecording ? onStopCall : onStartCall}
          disabled={isProcessing}
          className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRecording ? 'End Call' : 'Start Call'}
        </button>
        {isProcessing && (
          <p className="text-xs text-center text-gray-400">
            Processing call...
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(CallPreview);

