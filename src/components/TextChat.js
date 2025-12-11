'use client';

import { useRef, useEffect, memo } from 'react';
import AnimatedIcon from './AnimatedIcon';
import MarkdownRenderer from './MarkdownRenderer';

function TextChat({
  messages = [],
  inputValue = '',
  onInputChange,
  onSubmit,
  isLoading = false,
  isEmpty = true,
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-gradient-to-b from-gray-900 via-gray-900 to-black rounded-lg shadow-lg flex flex-col min-h-[420px] md:min-h-[520px] lg:h-[560px] xl:h-[600px] text-white">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-semibold">Text Chat</h2>
      </div>

      {isEmpty && messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 space-y-6">
          <AnimatedIcon />
          <div className="text-center space-y-1">
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm text-gray-400">
              Type a message below to begin chatting with your barber agent.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
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

      <form onSubmit={onSubmit} className="p-4 border-t border-gray-800">
        <div className="flex gap-2 items-end">
          <textarea
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white resize-none max-h-32 placeholder-gray-500"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && inputValue.trim()) {
                  onSubmit(e);
                }
              }
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Press Enter to send, Shift+Enter for a new line
        </p>
      </form>
    </div>
  );
}

export default memo(TextChat);

