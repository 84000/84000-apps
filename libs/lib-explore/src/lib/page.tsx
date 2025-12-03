'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, ArrowUp, ExternalLink, Loader2Icon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button, H1, H5, Input, ScrollArea } from '@design-system';
import { config } from './config';
import { orchestratePipelineStep } from './orchestrate';
import type { Message } from './types';

export const ExplorePage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchLinks, setSearchLinks] = useState<string[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 100);
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    setSearchLinks([]);
    setInput('');

    const userMessage: Message = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    setTimeout(scrollToBottom, 100);

    try {
      const history = messages.map((msg) => ({
        ...msg,
      }));

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        isProcessing: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const step1Result = await orchestratePipelineStep(
        query,
        history,
        'step1',
      );

      if (!step1Result.success) {
        throw new Error(step1Result.error || 'Failed to execute step1');
      }

      if (step1Result.data?.answer) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              role: 'assistant',
              content: step1Result.data?.answer as string,
              references: updated[lastIndex].links || searchLinks,
              steps: undefined,
              isTyping: false,
              isProcessing: false,
            };
          }
          return updated;
        });
      }
    } catch (error) {
      console.error('Error in step-by-step orchestration:', error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.role === 'assistant') {
          updated[lastIndex] = {
            role: 'assistant',
            content:
              'Sorry, I encountered an error while processing your request. Please try again.',
            isProcessing: false,
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(suggestion);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(input);
  };

  const showInitialInterface = messages.length === 0 && !isLoading;

  return (
    <div className="bg-background h-[calc(100vh-5rem)] text-foreground flex flex-col">
      {showInitialInterface && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-readable w-full">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-12">
                <H1 className="text-navy">Welcome to Explore Mode</H1>
                <H5 className="text-brick">Dive deep into 84000 resources</H5>
              </div>

              <div className="w-full max-w-2xl mb-8">
                <form onSubmit={handleFormSubmit} className="relative">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything"
                    className="w-full h-14 pl-6 pr-14 text-lg bg-card border-input rounded-full shadow-sm"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2 size-10 rounded-full"
                    disabled={!input.trim() || isLoading}
                  >
                    <ArrowUp />
                  </Button>
                </form>
              </div>

              <div className="space-y-3 w-full max-w-2xl">
                {config.suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start h-auto p-4 text-left text-muted-foreground hover:text-foreground rounded-lg"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isLoading}
                  >
                    <span className="mr-3">↗</span>
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(messages.length > 0 || isLoading) && (
        <div className="h-full flex flex-col">
          {/* Scrollable Chat History - Middle Section */}
          <div className="flex-grow overflow-hidden">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="max-w-prose mx-auto py-6">
                {messages.map((message, index) => {
                  const nextMessage = messages[index + 1];
                  const isLastUserMessage =
                    index === messages.length - 1 ||
                    (index === messages.length - 2 &&
                      messages[index + 1]?.role === 'assistant');

                  return (
                    <div key={index} className="space-y-6">
                      {/* Query Heading */}
                      {message.role === 'user' && (
                        <div className="w-full font-normal text-foreground bg-gray-100/50 p-4 rounded-2xl">
                          {message.content}
                        </div>
                      )}

                      {isLastUserMessage && isLoading && !nextMessage && (
                        <div className="space-y-4">
                          <div className="flex justify-end w-full text-muted-foreground animate-pulse">
                            <div className="flex gap-2">
                              <Loader2Icon className="animate-spin size-4 my-auto" />
                              Thinking...
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Answer and References */}
                      {nextMessage && nextMessage.role === 'assistant' && (
                        <div className="flex flex-col gap-8">
                          {/* Answer Column */}
                          <div>
                            {!nextMessage.isProcessing &&
                              nextMessage.content && (
                                <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6 prose-ul:space-y-2 prose-li:marker:text-muted-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline justify-self-end">
                                  <ReactMarkdown
                                    components={{
                                      a: ({ href, children }) => (
                                        <a
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline inline-flex items-center gap-1"
                                        >
                                          {children}
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      ),
                                      h1: ({ children }) => (
                                        <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">
                                          {children}
                                        </h1>
                                      ),
                                      h2: ({ children }) => (
                                        <h2 className="text-xl font-semibold text-foreground mb-3 mt-6">
                                          {children}
                                        </h2>
                                      ),
                                      h3: ({ children }) => (
                                        <h3 className="text-lg font-medium text-foreground mb-2 mt-4">
                                          {children}
                                        </h3>
                                      ),
                                      p: ({ children }) => (
                                        <p className="text-foreground mb-4 leading-relaxed">
                                          {children}
                                        </p>
                                      ),
                                      ul: ({ children }) => (
                                        <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
                                          {children}
                                        </ul>
                                      ),
                                      li: ({ children }) => (
                                        <li className="text-foreground leading-relaxed">
                                          {children}
                                        </li>
                                      ),
                                      strong: ({ children }) => (
                                        <strong className="font-semibold text-foreground">
                                          {children}
                                        </strong>
                                      ),
                                    }}
                                  >
                                    {nextMessage.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Fixed Input Section - Bottom */}
          <footer>
            {/* Blur gradient overlay */}
            <div className="absolute sticky bottom-0 border-t border-border/50 bg-background/80">
              <div className="max-w-4xl mx-auto px-6 py-6 pb-8">
                <form
                  onSubmit={handleFormSubmit}
                  className="relative max-w-prose mx-auto"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything"
                    className="w-full h-14 pl-6 pr-16 bg-card/90 backdrop-blur-sm border-input/50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2 size-10 rounded-full"
                    disabled={!input.trim() || isLoading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
};
