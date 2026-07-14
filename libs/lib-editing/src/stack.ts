// Spike (DEV-706): editor-per-passage stack. Deliberately not exported from
// the main barrel — its Yjs/y-prosemirror imports must stay out of the
// production apps' server bundles until the model is adopted.
export * from './lib/components/stack';
