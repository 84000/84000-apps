'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import {
  useBlockEditor,
  useDefaultExtensions,
  useTranslationExtensions,
} from '@lib-editing';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  Button,
} from '@design-system';
import { EditorView, basicSetup } from 'codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { ViewUpdate } from '@codemirror/view';

type EditorType = 'block' | 'translation';

const DOC_TYPES: Record<EditorType, string> = {
  block: 'doc',
  translation: 'translation',
};

const STARTER_JSON = JSON.stringify(
  { type: DOC_TYPES['translation'], content: [] },
  null,
  2,
);

const JsonCompareEditor = ({
  json: jsonData,
  editorType,
}: {
  json: object | null;
  editorType: EditorType;
}) => {
  const { extensions: blockExtensions } = useDefaultExtensions();
  const { extensions: translationExtensions } = useTranslationExtensions();

  const extensions =
    editorType === 'translation' ? translationExtensions : blockExtensions;

  const { editor } = useBlockEditor({
    extensions,
    content: { type: DOC_TYPES[editorType], content: [] },
    isEditable: false,
  });

  useEffect(() => {
    if (editor && jsonData) {
      editor.commands.setContent(jsonData);
    }
  }, [editor, jsonData]);

  return (
    <div className="relative flex flex-col flex-1 h-full overflow-auto">
      <EditorContent className="flex-1 px-8" editor={editor} />
    </div>
  );
};

const useCodeMirror = ({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (value: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        basicSetup,
        json(),
        linter(jsonParseLinter()),
        updateListener,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, viewRef };
};

export const JsonComparePage = () => {
  const [parsedJson, setParsedJson] = useState<object | null>(() => {
    try {
      return JSON.parse(STARTER_JSON);
    } catch {
      return null;
    }
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [editorType, setEditorType] = useState<EditorType>('translation');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleChange = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(value);
        setParsedJson(parsed);
        setParseError(null);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : 'Invalid JSON',
        );
      }
    }, 300);
  }, []);

  const { containerRef, viewRef } = useCodeMirror({
    initialValue: STARTER_JSON,
    onChange: handleChange,
  });

  const switchEditorType = useCallback(
    (newType: EditorType) => {
      if (newType === editorType) return;
      setEditorType(newType);

      const view = viewRef.current;
      if (!view) return;

      const currentText = view.state.doc.toString();
      try {
        const parsed = JSON.parse(currentText);
        parsed.type = DOC_TYPES[newType];
        const updated = JSON.stringify(parsed, null, 2);
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: updated },
        });
      } catch {
        // JSON is invalid — just switch the editor type without modifying text
      }
    },
    [editorType, viewRef],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="px-6 py-2 border-b border-border flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Editor type:</span>
        <Button
          variant={editorType === 'translation' ? 'default' : 'outline'}
          size="sm"
          onClick={() => switchEditorType('translation')}
        >
          Translation
        </Button>
        <Button
          variant={editorType === 'block' ? 'default' : 'outline'}
          size="sm"
          onClick={() => switchEditorType('block')}
        >
          Block
        </Button>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={20}>
          <div className="flex flex-col h-full bg-white">
            <div ref={containerRef} className="flex-1 overflow-hidden" />
            {parseError && (
              <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-t border-destructive/20">
                {parseError}
              </div>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="border-l border-r border-border" />
        <ResizablePanel defaultSize={50} minSize={20}>
          {editorType === 'block' ? (
            <JsonCompareEditor
              key="block"
              json={parsedJson}
              editorType="block"
            />
          ) : (
            <JsonCompareEditor
              key="translation"
              json={parsedJson}
              editorType="translation"
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
