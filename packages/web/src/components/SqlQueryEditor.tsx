import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import './SqlQueryEditor.css';

interface SqlQueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SqlQueryEditor({ value, onChange, placeholder }: SqlQueryEditorProps) {
  return (
    <div className="sql-editor">
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'SELECT column1, column2 FROM table_name'}
        extensions={[sql({ dialect: PostgreSQL })]}
        theme="dark"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          autocompletion: false,
        }}
        height="160px"
      />
    </div>
  );
}
