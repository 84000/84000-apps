'use client';

import { useEffect, useRef, useState } from 'react';

export const usePaginationLoadTriggers = ({
  enabled = true,
  startCursor,
  endCursor,
  startIsLoading = false,
  endIsLoading = false,
}: {
  enabled?: boolean;
  startCursor?: string;
  endCursor?: string;
  startIsLoading?: boolean;
  endIsLoading?: boolean;
}) => {
  const loadMoreAtStartRef = useRef<HTMLDivElement>(null);
  const loadMoreAtEndRef = useRef<HTMLDivElement>(null);
  const startCursorRef = useRef(startCursor);
  const endCursorRef = useRef(endCursor);
  const startIsLoadingRef = useRef(startIsLoading);
  const endIsLoadingRef = useRef(endIsLoading);
  const startLoadArmedRef = useRef(true);
  const endLoadArmedRef = useRef(true);
  const startIsIntersectingRef = useRef(false);
  const endIsIntersectingRef = useRef(false);
  const [startLoadRequest, setStartLoadRequest] = useState(0);
  const [endLoadRequest, setEndLoadRequest] = useState(0);

  useEffect(() => {
    startCursorRef.current = startCursor;
  }, [startCursor]);

  useEffect(() => {
    endCursorRef.current = endCursor;
  }, [endCursor]);

  useEffect(() => {
    startIsLoadingRef.current = startIsLoading;

    if (!startIsLoading && !startIsIntersectingRef.current) {
      startLoadArmedRef.current = true;
    }
  }, [startIsLoading]);

  useEffect(() => {
    endIsLoadingRef.current = endIsLoading;

    if (!endIsLoading && !endIsIntersectingRef.current) {
      endLoadArmedRef.current = true;
    }
  }, [endIsLoading]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const startEl = loadMoreAtStartRef.current;
    const endEl = loadMoreAtEndRef.current;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === startEl) {
          startIsIntersectingRef.current = entry.isIntersecting;

          if (!entry.isIntersecting) {
            if (!startIsLoadingRef.current) {
              startLoadArmedRef.current = true;
            }
            continue;
          }

          if (startIsLoadingRef.current || !startCursorRef.current) {
            continue;
          }

          if (!startLoadArmedRef.current) {
            continue;
          }

          startLoadArmedRef.current = false;
          setStartLoadRequest((current) => current + 1);
          continue;
        }

        if (entry.target === endEl) {
          endIsIntersectingRef.current = entry.isIntersecting;

          if (!entry.isIntersecting) {
            if (!endIsLoadingRef.current) {
              endLoadArmedRef.current = true;
            }
            continue;
          }

          if (endIsLoadingRef.current || !endCursorRef.current) {
            continue;
          }

          if (!endLoadArmedRef.current) {
            continue;
          }

          endLoadArmedRef.current = false;
          setEndLoadRequest((current) => current + 1);
        }
      }
    });

    if (startEl) {
      observer.observe(startEl);
    }

    if (endEl) {
      observer.observe(endEl);
    }

    return () => observer.disconnect();
  }, [enabled]);

  return {
    loadMoreAtStartRef,
    loadMoreAtEndRef,
    startLoadRequest,
    endLoadRequest,
  };
};
