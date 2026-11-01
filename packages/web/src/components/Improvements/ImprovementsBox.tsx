import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../Button';
import { ApiError } from '../../services/apiBase';
import { submitImprovement } from '../../services/api';
import './ImprovementsBox.css';

const MAX_LENGTH = 2000;

function requestFormSubmit(form: HTMLFormElement) {
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
    return;
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

export function ImprovementsBox() {
  const location = useLocation();
  const noteId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const websiteRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !done) textRef.current?.focus();
  }, [open, done]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitImprovement({
        message: text,
        email: email.trim() || undefined,
        page_path: location.pathname.slice(0, 500) || '/',
        website: websiteRef.current?.value ?? '',
      });
      setMessage('');
      setEmail('');
      if (websiteRef.current) websiteRef.current.value = '';
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429
        ? 'Too many from this network. Wait a bit.'
        : "Couldn't save that.");
    } finally {
      setSending(false);
    }
  };

  const onTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (formRef.current) requestFormSubmit(formRef.current);
  };

  return (
    <div className={`impr ${open ? 'impr--open' : ''}`} ref={rootRef}>
      <div className="impr-bar">
        {open ? (
          <form ref={formRef} className="impr-form" onSubmit={onSubmit} aria-label="Improvements">
            <div className="impr-head">
              <span className="impr-kicker">Improvements</span>
              <Link to="/changelog" className="impr-link">Shipped</Link>
              <button type="button" className="impr-close" aria-label="Close improvements" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            {done ? (
              <p className="impr-thanks" role="status">In the queue.</p>
            ) : (
              <>
                <textarea
                  ref={textRef}
                  id={noteId}
                  className="impr-text"
                  value={message}
                  maxLength={MAX_LENGTH}
                  rows={3}
                  placeholder="How should Chartsuno be different?"
                  aria-label="How should Chartsuno be different?"
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={onTextKeyDown}
                />
                <div className="impr-hp" aria-hidden="true">
                  <label>
                    Website
                    <input ref={websiteRef} name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                  </label>
                </div>
                <div className="impr-actions">
                  <input
                    className="impr-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    maxLength={255}
                    value={email}
                    placeholder="Email, if you want a reply"
                    aria-label="Email, optional"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <Button type="submit" variant="primary" className="impr-send" disabled={!message.trim() || sending}>
                    {sending ? 'Sending' : 'Send'}
                  </Button>
                </div>
                {message.length > 0 && (
                  <p className="impr-count" aria-live="polite">{message.length}/{MAX_LENGTH}</p>
                )}
                {error && <p className="impr-error" role="alert">{error}</p>}
              </>
            )}
          </form>
        ) : (
          <>
            <button type="button" className="impr-open" aria-expanded={false} onClick={() => { setDone(false); setOpen(true); }}>
              <span className="impr-kicker">Improvements</span>
              <span className="impr-prompt">How should Chartsuno be different?</span>
            </button>
            <Link to="/changelog" className="impr-link">Shipped</Link>
          </>
        )}
      </div>
    </div>
  );
}
