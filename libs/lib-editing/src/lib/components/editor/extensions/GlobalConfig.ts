import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    globalConfig: {
      /**
       * Enable or disable debug mode
       * @example editor.commands.setDebugMode(true)
       */
      setDebug: (enabled: boolean) => ReturnType;

      /**
       * Check if debug mode is enabled
       * @example editor.isDebug()
       */
      isDebug: () => ReturnType;
    };
  }

  interface Storage {
    globalConfig: {
      debug: boolean;
    };
  }
}

export const GlobalConfig = Extension.create({
  name: 'globalConfig',

  addStorage() {
    return {
      debug: false,
    };
  },

  addCommands() {
    return {
      setDebug:
        (enabled) =>
        ({ editor }) => {
          this.storage.debug = enabled;
          // Force re-render if needed
          editor.view.updateState(editor.state);
          return true;
        },

      isDebug: () => () => {
        return this.storage.debug;
      },
    };
  },
});
