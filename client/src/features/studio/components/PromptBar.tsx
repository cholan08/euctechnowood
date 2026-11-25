import { useEffect, useRef, useState } from 'react';
import type { AssistRequest } from '@shared/types';
import { assist } from '../../../api/studio';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  id: string;
  /** Read by screen readers; the visible label is the field's own. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  /** What the text is about, so AI help can fit its suggestions (the part, its finish, the room). */
  context: Omit<AssistRequest, 'text'>;
  /** A taller box for longer notes. */
  multiline?: boolean;
  /** When set, an arrow button (and Enter) uses the text right away. */
  onSubmit?: () => void;
  submitDisabled?: boolean;
  submitTitle?: string;
}

/**
 * A prompt bar: staff type the details in their own words (any language), and
 * "AI help" turns them into three clear English options to pick from. Empty, it
 * suggests ideas instead. Only the text left in the bar is used.
 */
export function PromptBar({ id, label, value, onChange, placeholder, maxLength, context, multiline, onSubmit, submitDisabled, submitTitle }: Props) {
  const [ideas, setIdeas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Only the latest request may answer; an older one that arrives late is ignored.
  const asked = useRef(0);
  useEffect(() => () => void asked.current++, []);

  async function help() {
    const ticket = ++asked.current;
    setLoading(true);
    setError('');
    try {
      const answer = await assist({ ...context, text: value });
      if (ticket === asked.current) setIdeas(answer.suggestions);
    } catch (err) {
      if (ticket === asked.current) setError(err instanceof Error ? err.message : 'AI help is not available right now.');
    } finally {
      if (ticket === asked.current) setLoading(false);
    }
  }

  function pick(idea: string) {
    onChange(idea.slice(0, maxLength));
    setIdeas([]);
  }

  const field = {
    id,
    value,
    maxLength,
    placeholder,
    'aria-label': label,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };

  return (
    <div className="pbar">
      <div className={`pbar-row${multiline ? ' multi' : ''}`}>
        {multiline ? (
          <textarea rows={3} {...field} />
        ) : (
          <input
            type="text"
            {...field}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSubmit) {
                e.preventDefault();
                if (!submitDisabled) onSubmit();
              }
            }}
          />
        )}
        <button
          type="button"
          className="pbar-ai"
          onClick={help}
          disabled={loading}
          title={value.trim() ? 'AI help: turn your words into clear options (any language)' : 'AI help: suggest ideas'}
        >
          {loading ? <span className="spinner" /> : <Icon name="wand" size={14} />} AI help
        </button>
        {onSubmit && (
          <button type="button" className="btn btn-sm pbar-go" disabled={submitDisabled} onClick={onSubmit} title={submitTitle}>
            <Icon name="arrow" size={15} />
            <span className="sr-only">{submitTitle ?? 'Use this'}</span>
          </button>
        )}
      </div>

      {error && <p className="pbar-error">{error}</p>}

      {ideas.length > 0 && (
        <div className="pbar-ideas" role="group" aria-label="AI help suggestions">
          {ideas.map((idea) => (
            <button key={idea} type="button" className="pbar-idea" onClick={() => pick(idea)} title="Use this">
              <Icon name="sparkle" size={12} />
              <span>{idea}</span>
            </button>
          ))}
          <button type="button" className="link pbar-dismiss" onClick={() => setIdeas([])}>
            <Icon name="x" size={11} /> Close
          </button>
        </div>
      )}
    </div>
  );
}
