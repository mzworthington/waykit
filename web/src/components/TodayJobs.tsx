import { useMemo, useState } from 'react';
import todayMd from '../../../docs/today-jobs.md?raw';
import { presentInlineMarkdown } from '../landing/presentInlineMarkdown';
import { parseTodayJobsMarkdown, type TodayJob } from '../landing/todayJobs';

export function TodayJobs({ showHeading = false }: { showHeading?: boolean }) {
  const jobs = useMemo(() => parseTodayJobsMarkdown(todayMd), []);
  const [activeId, setActiveId] = useState(jobs[0]?.id ?? '');
  const active = jobs.find((job) => job.id === activeId);
  const [copied, setCopied] = useState(false);

  if (jobs.length === 0) return null;

  return (
    <section
      id="today"
      className="today"
      aria-labelledby={showHeading ? 'today-heading' : undefined}
      aria-label={showHeading ? undefined : 'Jobs you can do today'}
    >
      {showHeading ? (
        <>
          <h2 id="today-heading">What do I use this for today?</h2>
          <p className="today-lead">
            Pick the job in front of you. Each card opens the steps and a command you can copy.
          </p>
        </>
      ) : null}
      <div role="group" aria-label="Job list">
        <ul className="job-grid" id="job-grid">
          {jobs.map((job) => {
            const selected = job.id === active?.id;
            return (
              <li key={job.id}>
                <button
                  type="button"
                  className="job-btn"
                  aria-pressed={selected}
                  aria-expanded={selected}
                  aria-controls={selected ? 'job-panel' : undefined}
                  onClick={() => {
                    setActiveId(selected ? '' : job.id);
                    setCopied(false);
                  }}
                >
                  <span className="job-btn-main">
                    <span className="job-title">{job.title}</span>
                    <span className="job-blurb">{job.blurb}</span>
                  </span>
                  <span className="job-cue">
                    <span className="job-cue-label">{selected ? 'Hide steps' : 'Show steps'}</span>
                    <JobCueIcon expanded={selected} />
                  </span>
                </button>
                {selected && active ? (
                  <JobPanel copied={copied} job={active} onCopied={setCopied} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function JobPanel({
  job,
  copied,
  onCopied
}: {
  job: TodayJob;
  copied: boolean;
  onCopied: (copied: boolean) => void;
}) {
  return (
    <div className="job-panel is-active" id="job-panel" role="region" aria-labelledby="job-panel-title">
      <h3 id="job-panel-title">{job.title}</h3>
      <p className="job-why">{job.why}</p>
      <ol>
        {job.steps.map((step) => (
          <li key={step}>{presentInlineMarkdown(step)}</li>
        ))}
      </ol>
      <p className="job-cmd">
        <span className="job-cmd-label">Start here:</span>
        <span className="job-cmd-row">
          <code title={job.cmd}>{job.cmd}</code>
          <button
            type="button"
            className="job-cmd-copy"
            data-copied={copied ? 'true' : undefined}
            aria-label={`Copy command: ${job.cmd}`}
            onClick={() => {
              void navigator.clipboard?.writeText(job.cmd).then(() => {
                onCopied(true);
                window.setTimeout(() => onCopied(false), 1500);
              });
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </p>
      <ul className="job-actions">
        {job.actions.map((action) => (
          <li key={action.href}>
            <a href={action.href}>{action.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobCueIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className="job-cue-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      data-expanded={expanded ? 'true' : undefined}
    >
      <path
        fill="currentColor"
        d="M3.2 5.3a.75.75 0 0 1 1.06 0L8 9.04l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L3.2 6.36a.75.75 0 0 1 0-1.06z"
      />
    </svg>
  );
}
