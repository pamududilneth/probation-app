import React from 'react';

const ORDER = [
  { key: 'hr_division', label: 'HR Division' },
  { key: 'employee', label: 'Employee' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'sbu_hr', label: 'SBU HR' },
];

/**
 * Shows the whole approval chain at a glance: who's assigned to each
 * section, which sections are done/in-progress/not-started, and a plain-
 * English summary of who still needs to act. Purely presentational — no
 * fetching, no state.
 */
export default function WorkflowCapsule({ sections = [], assignments = [] }) {
  const statusFor = (key) => sections.find((s) => s.section_key === key)?.status || 'not_started';
  const ownerFor = (key) => assignments.find((a) => a.role === key);

  const completedCount = ORDER.filter((o) => statusFor(o.key) === 'completed').length;
  const remaining = ORDER.filter((o) => statusFor(o.key) !== 'completed');

  return (
    <div className="workflow-capsule">
      <div className="workflow-capsule-steps">
        {ORDER.map((o, i) => {
          const status = statusFor(o.key);
          const owner = ownerFor(o.key);
          return (
            <React.Fragment key={o.key}>
              <div className={`wf-step wf-step--${status}`}>
                <span className="wf-step-dot" />   
                <div className="wf-step-text">
                  <span className="wf-step-label">{o.label}</span>
                  <span className="wf-step-owner">
                    {owner ? (owner.display_name || owner.email) : 'Unassigned'}
                  </span>
                </div>
              </div>
              {i < ORDER.length - 1 && (
                <div className={`wf-connector ${status === 'completed' ? 'wf-connector--done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="wf-summary">
        {remaining.length === 0
          ? 'All sections complete.'
          : `${completedCount} of ${ORDER.length} sections completed — waiting on: ` +
            remaining
              .map((r) => {
                const owner = ownerFor(r.key);
                return owner ? `${r.label} (${owner.display_name || owner.email})` : r.label;
              })
              .join(', ')}
      </div>
    </div>
  );
}