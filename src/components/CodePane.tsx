import Editor, { type OnMount } from '@monaco-editor/react';

interface CodePaneProps {
  value: string;
  language: 'javascript' | 'sql';
  readOnly?: boolean;
  onChange: (value: string) => void;
  onPaste?: () => void;
  onKeystroke?: () => void;
  onEditorReady?: OnMount;
}

export function CodePane({ value, language, readOnly, onChange, onPaste, onKeystroke, onEditorReady }: CodePaneProps) {
  const handleMount: OnMount = (editor, monaco) => {
    editor.onDidPaste(() => onPaste?.());
    editor.onKeyDown(() => onKeystroke?.());
    onEditorReady?.(editor, monaco);
  };

  return (
    <Editor
      value={value}
      language={language}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      theme="vs-light"
      options={{
        readOnly: readOnly ?? false,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
      }}
    />
  );
}
