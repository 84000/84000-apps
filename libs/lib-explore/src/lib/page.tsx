'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, ArrowUp, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button, Card, H1, H5, Input, ScrollArea } from '@design-system';
import { config } from './config';
import { orchestratePipelineStep } from './orchestrate';
import { Typewriter } from 'react-simple-typewriter';
import type { FlowResult, Message } from './types';

export const ExplorePage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLinks, setSearchLinks] = useState<string[]>([]);
  const [isTypewriterDone, setIsTypewriterDone] = useState(false);
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

    setInput('');
    setIsSearching(false);
    setSearchLinks([]);
    setIsTypewriterDone(false);

    const userMessage: Message = { role: 'user', message: query };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    setTimeout(scrollToBottom, 100);

    try {
      const history = messages.map((msg) => ({
        role: msg.role,
        message: msg.message,
      }));

      console.log('[v0] Starting step-by-step orchestration pipeline');

      const assistantMessage: Message = {
        role: 'assistant',
        message: '',
        isProcessing: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const results: FlowResult = {};

      console.log('[v0] Executing step1...');
      const step1Result = await orchestratePipelineStep(
        query,
        history,
        'step1',
      );

      if (!step1Result.success) {
        throw new Error(step1Result.error || 'Failed to execute step1');
      }

      if (step1Result.data?.steps) {
        results.step1 = step1Result.data;
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              steps: step1Result.data?.steps,
              isProcessing: true,
            };
          }
          return updated;
        });

        setTimeout(() => {
          setIsSearching(true);
        }, 500);
      }

      console.log('[v0] Executing step2...');
      const step2Result = await orchestratePipelineStep(
        query,
        history,
        'step2',
        results,
      );

      if (!step2Result.success) {
        throw new Error(step2Result.error || 'Failed to execute step2');
      }

      if (step2Result.data?.links) {
        results.step2 = step2Result.data;
        const links = Array.isArray(step2Result.data.links)
          ? step2Result.data.links
          : [];
        setSearchLinks(links);

        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              links: links,
              isProcessing: true,
            };
          }
          return updated;
        });

        setTimeout(() => {
          setIsSearching(false);
        }, 1000);
      }

      console.log('[v0] Executing step3...');
      const step3Result = await orchestratePipelineStep(
        query,
        history,
        'step3',
        results,
      );

      if (!step3Result.success) {
        throw new Error(step3Result.error || 'Failed to execute step3');
      }

      if (step3Result.data?.answer) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === 'assistant') {
            updated[lastIndex] = {
              role: 'assistant',
              message: step3Result.data?.answer as string,
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
            message:
              'Sorry, I encountered an error while processing your request. Please try again.',
            isProcessing: false,
          };
        }
        return updated;
      });
      setIsSearching(false);
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

  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).origin;
      return `${domain}/favicon.ico`;
    } catch {
      return '/placeholder.svg?height=16&width=16';
    }
  };

  const showInitialInterface = messages.length === 0 && !isLoading;

  return (
    <div className="bg-background h-full text-foreground flex flex-col">
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
              <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
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
                        <div className="border-b border-border pb-4">
                          <h1 className="text-3xl font-normal text-foreground">
                            {message.message}
                          </h1>
                        </div>
                      )}

                      {isLastUserMessage && isLoading && !nextMessage && (
                        <div className="space-y-4">
                          <div className="text-muted-foreground">
                            <p className="text-sm">Thinking...</p>
                          </div>
                        </div>
                      )}

                      {/* Answer and References */}
                      {nextMessage && nextMessage.role === 'assistant' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Answer Column */}
                          <div className="lg:col-span-2">
                            {nextMessage.isProcessing && nextMessage.steps && (
                              <div className="border-l-4 border-red-500 pl-4 bg-red-50/50 dark:bg-red-950/20 rounded-r-lg mb-6">
                                <div className="space-y-4">
                                  <div className="text-red-600 dark:text-red-400">
                                    {!isTypewriterDone ? (
                                      <Typewriter
                                        words={[nextMessage.steps]}
                                        loop={1}
                                        cursor={false}
                                        typeSpeed={50}
                                        onLoopDone={() =>
                                          setIsTypewriterDone(true)
                                        }
                                      />
                                    ) : (
                                      nextMessage.steps
                                    )}
                                  </div>
                                  {isSearching && (
                                    <div className="text-red-600 dark:text-red-400 text-sm">
                                      Kicking off searches...
                                    </div>
                                  )}
                                  {searchLinks.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="text-xs text-muted-foreground">
                                        Searching through:
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {searchLinks.map((link, linkIndex) => (
                                          <button
                                            key={linkIndex}
                                            onClick={() =>
                                              window.open(link, '_blank')
                                            }
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-white text-gray-700 text-xs rounded-full border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                                          >
                                            <img
                                              src={
                                                getFaviconUrl(link) ||
                                                '/placeholder.svg'
                                              }
                                              alt=""
                                              className="w-3 h-3"
                                              onError={(e) => {
                                                e.currentTarget.src =
                                                  '/placeholder.svg?height=12&width=12';
                                              }}
                                            />
                                            <span className="truncate max-w-24">
                                              {extractDomain(link)}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {!nextMessage.isProcessing &&
                              nextMessage.message && (
                                <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6 prose-ul:space-y-2 prose-li:marker:text-muted-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
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
                                    {nextMessage.message}
                                  </ReactMarkdown>
                                </div>
                              )}
                          </div>

                          {/* References Column */}
                          <div className="lg:col-span-1">
                            {!nextMessage.isProcessing &&
                              nextMessage.references &&
                              nextMessage.references.length > 0 && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-muted-foreground">
                                      {nextMessage.references.length} sites
                                    </h3>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs text-muted-foreground"
                                    >
                                      Show all
                                    </Button>
                                  </div>

                                  <ScrollArea className="h-96">
                                    <div className="space-y-3 pr-4">
                                      {nextMessage.references.map(
                                        (ref, refIndex) => (
                                          <Card
                                            key={refIndex}
                                            className="p-4 hover:bg-accent/50 transition-colors"
                                          >
                                            <a
                                              href={ref}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="block group"
                                            >
                                              <div className="flex items-start gap-3">
                                                <img
                                                  src={
                                                    getFaviconUrl(ref) ||
                                                    '/placeholder.svg'
                                                  }
                                                  alt=""
                                                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                                                  onError={(e) => {
                                                    e.currentTarget.src =
                                                      '/placeholder.svg?height=16&width=16';
                                                  }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-medium text-sm text-primary group-hover:underline truncate">
                                                    {extractDomain(ref)}
                                                  </p>
                                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                    {ref}
                                                  </p>
                                                </div>
                                              </div>
                                            </a>
                                          </Card>
                                        ),
                                      )}
                                    </div>
                                  </ScrollArea>
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
            <div className="absolute sticky bottom-0 inset-0 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none" />
            <div className="relative border-t border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
              <div className="max-w-4xl mx-auto px-6 py-6 pb-8">
                <form
                  onSubmit={handleFormSubmit}
                  className="relative max-w-2xl mx-auto"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything"
                    className="w-full h-14 pl-6 pr-16 text-base bg-card/90 backdrop-blur-sm border-input/50 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:ring-2 focus:ring-primary/20"
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
