import React from 'react';
import './ProbationProgressReview.css';
import WorkflowCapsule from './WorkflowCapsule';

const FACTORS = [
  { id: 'job_knowledge', title: 'Job Knowledge', desc: 'Understanding of all aspects of the work; resourcefulness in handling assignments.' },
  { id: 'quality_of_work', title: 'Quality of Work', desc: 'Accuracy, neatness and thoroughness. Ability to achieve standards with economy of time and materials.' },
  { id: 'responsibility', title: 'Responsibility', desc: 'Willingness to accept and expand responsibility.' },
  { id: 'dependability', title: 'Dependability', desc: 'Follows instructions, exercises good judgment. Reliability and trustworthiness.' },
  { id: 'courtesy', title: 'Courtesy', desc: 'Friendliness, politeness, and respect for clients and colleagues.' },
  { id: 'personal_tidiness', title: 'Personal Tidiness', desc: 'Grooming, personal hygiene, and cleanliness.' },
  { id: 'relationships', title: 'Relationships', desc: 'Ability to work with and through others. Cooperativeness and concern for them.' },
  { id: 'attendance', title: 'Attendance & Punctuality', desc: 'Reporting to work on time and being available when required. Regularity in attendance.' },
  { id: 'initiative', title: 'Initiative', desc: 'Ability to take appropriate action on own initiative. Strong sense of environment.' },
  { id: 'company_property', title: 'Concern for Company Property', desc: 'Proper use of office equipment and materials; minimizes wastage and damage.' },
  { id: 'overall_eval', title: 'Overall Evaluation', desc: "Consider all relevant factors above regarding the employee's performance during the assessment period." },
];

const RAIL_SECTIONS = [
  { id: 'hr_division', role: 'hr_division', label: 'HR Division', step: 'Section 1' },
  { id: 'employee', role: 'employee', label: 'Employee', step: 'Section 2' },
  { id: 'supervisor', role: 'supervisor', label: 'Supervisor', step: 'Section 3' },
  { id: 'sbu_hr', role: 'sbu_hr', label: 'SBU HR', step: 'Section 4' },
];

const STATUS_LABEL = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed' };

const Field = ({ id, label, type = 'text', placeholder, min, value, disabled, onChange }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <input
      type={type}
      id={id}
      min={min}
      placeholder={placeholder}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const FieldTextArea = ({ id, label, placeholder, value, disabled, onChange }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <textarea
      id={id}
      placeholder={placeholder}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const RadioPill = ({ group, value, checked, disabled, onChange, children }) => (
  <label className="pill">
    <input type="radio" name={group} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
    {children}
  </label>
);

const SectionActions = ({ show, saving, exporting, onSaveDraft, onSubmitSection, onExport }) => (
  <div className="section-actions">
    <button className="btn-ghost" disabled={exporting} onClick={onExport}>
      {exporting ? 'Exporting…' : '📄 Export as Word Document'}
    </button>
    {show && (
      <>
        <button className="btn-ghost" disabled={saving} onClick={onSaveDraft}>Save Draft</button>
        <button className="btn-primary" disabled={saving} onClick={onSubmitSection}>
          {saving ? 'Submitting…' : 'Submit Section'}
        </button>
      </>
    )}
  </div>
);

const LockNote = ({ editable, status, isCurrentTurn, sectionLabel }) => {
  if (editable) return null;
  if (status === 'completed') return <p className="lock-note lock-note--done">✓ Submitted — read-only.</p>;
  return <p className="lock-note">Only the assigned {sectionLabel} (or Admin) can edit this section.</p>;
};

const SectionHead = ({ badge, role, name, owner }) => (
  <div className="section-head">
    <div className="section-badge">{badge}</div>
    <div className="section-headtext">
      <div className="section-role">{role}</div>
      <h2 className="section-name">{name}</h2>
    </div>
    {owner && <span className="owner-chip">{owner.display_name || owner.email}</span>}
  </div>
);

export default function ProbationProgressReview({
  data,
  onFieldChange,
  myRole,
  currentStep,
  formStatus,
  sectionEditable,
  sectionStatus,
  assignments = [],
  sections = [],
  onSaveDraft,
  onSubmitSection,
  onExport,
  saving,
  exporting,
  error,
  onBack,
}) {
  const get = (id) => data[id] ?? '';
  const set = (id) => (value) => onFieldChange(id, value);
  const assignedTo = (role) => assignments.find((a) => a.role === role);

  return (
    <div className="probation-app">
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-eyebrow">Human Resources · Performance Documentation</span>
          <span className="topbar-title">Probation Progress Review</span>
        </div>
        <div className="topbar-right">
          <span className="status-pill">
            {formStatus === 'completed' ? 'Workflow complete' : `Currently with: ${RAIL_SECTIONS.find(s => s.id === currentStep)?.label || currentStep}`}
          </span>
          <button className="icon-btn" onClick={onBack}>← Back</button>
          <button className="icon-btn" disabled={exporting} onClick={onExport}>
            {exporting ? 'Exporting…' : '📄 Export as Word'}
          </button>
          <button className="icon-btn" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="shell">
        <nav className="rail">
          {RAIL_SECTIONS.map((s) => {
            const status = sectionStatus(s.id);
            return (
              <a key={s.id} className="rail-item" data-role={s.id} href={`#sec-${s.id}`}>
                <span className={`rail-dot rail-dot--${status}`} />
                <span className="rail-label">{s.label}<small>{STATUS_LABEL[status]}</small></span>
              </a>
            );
          })}
        </nav>

        <main>
          <div className="doc-header">
            <h1 className="doc-title">Probation Progress Review</h1>
            <p className="doc-sub">
              You're viewing this as <strong>{myRole === 'admin' ? 'Admin' : RAIL_SECTIONS.find(s => s.id === myRole)?.label}</strong>.
              Sections outside your role are shown read-only for context.
            </p>
            <WorkflowCapsule sections={sections} assignments={assignments} />
            <div className="id-row">
              <Field id="fullName" label="Full Name" placeholder="Employee's full name"
                value={get('fullName')} disabled={!sectionEditable('hr_division')} onChange={set('fullName')} />
              <Field id="epfTop" label="EPF Number" placeholder="e.g. EPF-0042"
                value={get('epfTop')} disabled={!sectionEditable('hr_division')} onChange={set('epfTop')} />
            </div>
          </div>

          {/* SECTION 1: HR DIVISION */}
          <section className="section" data-role="hr_division" id="sec-hr_division">
            <SectionHead badge="1" role="To be filled by the HR Division" name="Employment & Review Details" owner={assignedTo('hr_division')} />
            <div className="section-body">
              <LockNote editable={sectionEditable('hr_division')} status={sectionStatus('hr_division')}
                isCurrentTurn={currentStep === 'hr_division'} sectionLabel="HR Division" />

              <div className="grid-2 row-gap">
                <Field id="probEndDate" label="Projected Probationary End Date" type="date"
                  value={get('probEndDate')} disabled={!sectionEditable('hr_division')} onChange={set('probEndDate')} />
                <div className="field">
                  <label>Review Interval</label>
                  <div className="pill-group">
                    <RadioPill group="interval" value="6" checked={get('interval') === '6'} disabled={!sectionEditable('hr_division')} onChange={set('interval')}>6 Months</RadioPill>
                    <RadioPill group="interval" value="12" checked={get('interval') === '12'} disabled={!sectionEditable('hr_division')} onChange={set('interval')}>12 Months</RadioPill>
                    <RadioPill group="interval" value="end" checked={get('interval') === 'end'} disabled={!sectionEditable('hr_division')} onChange={set('interval')}>Probationary Period End</RadioPill>
                    <label className="pill">
                      <input type="radio" name="interval" checked={get('interval') === 'other'}
                        disabled={!sectionEditable('hr_division')} onChange={() => set('interval')('other')} />
                      <input type="text" className="inline-input" placeholder="Specify"
                        value={get('intervalOther')} disabled={!sectionEditable('hr_division')}
                        onChange={(e) => set('intervalOther')(e.target.value)} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid-3 row-gap">
                <Field id="epfNum" label="EPF Number" value={get('epfNum')} disabled={!sectionEditable('hr_division')} onChange={set('epfNum')} />
                <Field id="dept" label="Department" value={get('dept')} disabled={!sectionEditable('hr_division')} onChange={set('dept')} />
                <Field id="designation" label="Designation" value={get('designation')} disabled={!sectionEditable('hr_division')} onChange={set('designation')} />
                <Field id="empDate" label="Employment Date" type="date" value={get('empDate')} disabled={!sectionEditable('hr_division')} onChange={set('empDate')} />
                <Field id="supName" label="Supervisor's Name" value={get('supName')} disabled={!sectionEditable('hr_division')} onChange={set('supName')} />
                <Field id="supTitle" label="Supervisor's Title" value={get('supTitle')} disabled={!sectionEditable('hr_division')} onChange={set('supTitle')} />
              </div>

              <div className="subpanel">
                <p className="subpanel-title">Leave Records — Leave Balance</p>
                <div className="grid-5">
                  <Field id="leaveAwol" label="Absent w/o leave" type="number" min="0" value={get('leaveAwol')} disabled={!sectionEditable('hr_division')} onChange={set('leaveAwol')} />
                  <Field id="leaveNoPay" label="No Pay" type="number" min="0" value={get('leaveNoPay')} disabled={!sectionEditable('hr_division')} onChange={set('leaveNoPay')} />
                  <Field id="leaveAnnual" label="Annual" type="number" min="0" value={get('leaveAnnual')} disabled={!sectionEditable('hr_division')} onChange={set('leaveAnnual')} />
                  <Field id="leaveCasual" label="Casual" type="number" min="0" value={get('leaveCasual')} disabled={!sectionEditable('hr_division')} onChange={set('leaveCasual')} />
                  <Field id="leaveMedical" label="Medical" type="number" min="0" value={get('leaveMedical')} disabled={!sectionEditable('hr_division')} onChange={set('leaveMedical')} />
                </div>
              </div>

              <SectionActions show={sectionEditable('hr_division')} saving={saving} exporting={exporting}
                onSaveDraft={() => onSaveDraft('hr_division')} onSubmitSection={() => onSubmitSection('hr_division')} onExport={onExport} />
            </div>
          </section>

          {/* SECTION 2: EMPLOYEE */}
          <section className="section" data-role="employee" id="sec-employee">
            <SectionHead badge="2" role="To be filled by the Employee" name="Self-Development & Reflection" owner={assignedTo('employee')} />
            <div className="section-body">
              <LockNote editable={sectionEditable('employee')} status={sectionStatus('employee')}
                isCurrentTurn={currentStep === 'employee'} sectionLabel="Employee" />

              <div className="stack row-gap">
                <FieldTextArea id="devPlan" label="Employee Development Plan — Professional Development Goals"
                  placeholder="Outline the goals you're working toward this review period..."
                  value={get('devPlan')} disabled={!sectionEditable('employee')} onChange={set('devPlan')} />
                <FieldTextArea id="devSteps" label="Steps taken to enhance job performance and professional development"
                  placeholder="Courses, mentoring, on-the-job learning, etc."
                  value={get('devSteps')} disabled={!sectionEditable('employee')} onChange={set('devSteps')} />
              </div>
              <div className="sig-row">
                <Field id="empSig" label="Employee Signature" placeholder="Type full name to sign" value={get('empSig')} disabled={!sectionEditable('employee')} onChange={set('empSig')} />
                <Field id="empSigDate" label="Date" type="date" value={get('empSigDate')} disabled={!sectionEditable('employee')} onChange={set('empSigDate')} />
              </div>

              <SectionActions show={sectionEditable('employee')} saving={saving} exporting={exporting}
                onSaveDraft={() => onSaveDraft('employee')} onSubmitSection={() => onSubmitSection('employee')} onExport={onExport} />
            </div>
          </section>

          {/* SECTION 3: SUPERVISOR */}
          <section className="section" data-role="supervisor" id="sec-supervisor">
            <SectionHead badge="3" role="To be filled by the Supervisor / Divisional Head" name="Performance Evaluation & Outcome" owner={assignedTo('supervisor')} />
            <div className="section-body">
              <LockNote editable={sectionEditable('supervisor')} status={sectionStatus('supervisor')}
                isCurrentTurn={currentStep === 'supervisor'} sectionLabel="Supervisor" />

              <div className="legend">
                <span><i style={{ background: 'var(--grade-a)' }} /> A — Exceptional</span>
                <span><i style={{ background: 'var(--grade-b)' }} /> B — Good</span>
                <span><i style={{ background: 'var(--grade-c)' }} /> C — Satisfactory</span>
                <span><i style={{ background: 'var(--grade-d)' }} /> D — Unsatisfactory</span>
              </div>

              <div className="table-scroll">
                <table className="eval-table">
                  <thead>
                    <tr>
                      <th style={{ width: '34%' }}>Factor</th>
                      <th>A</th><th>B</th><th>C</th><th>D</th>
                      <th style={{ width: '34%' }}>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FACTORS.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <p className="factor-title">{f.title}</p>
                          <p className="factor-desc">{f.desc}</p>
                        </td>
                        {['A', 'B', 'C', 'D'].map((g) => (
                          <td className="grade-cell" data-grade={g} key={g}>
                            <input
                              type="radio" className="grade-radio" name={`grade_${f.id}`}
                              checked={get(`grade_${f.id}`) === g}
                              disabled={!sectionEditable('supervisor')}
                              onChange={() => set(`grade_${f.id}`)(g)}
                            />
                          </td>
                        ))}
                        <td>
                          <textarea
                            placeholder="Notes..." value={get(`comment_${f.id}`)}
                            disabled={!sectionEditable('supervisor')}
                            onChange={(e) => set(`comment_${f.id}`)(e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="stack row-gap">
                <FieldTextArea id="overallProgress" label="Comments on Overall Progress (progress toward meeting Performance Plan)"
                  value={get('overallProgress')} disabled={!sectionEditable('supervisor')} onChange={set('overallProgress')} />
                <FieldTextArea id="strengths" label="What are the employee's strengths?"
                  value={get('strengths')} disabled={!sectionEditable('supervisor')} onChange={set('strengths')} />
                <FieldTextArea id="improvements" label="What areas does the employee need to improve?"
                  value={get('improvements')} disabled={!sectionEditable('supervisor')} onChange={set('improvements')} />
              </div>

              <div className="subpanel row-gap">
                <p className="subpanel-title">Overall Result of Review</p>
                <label className="result-card">
                  <input type="radio" name="overallResult" checked={get('overallResult') === 'contributor'}
                    disabled={!sectionEditable('supervisor')} onChange={() => set('overallResult')('contributor')} />
                  <div><strong>Contributor</strong><p>Performance shows consistent achievement toward meeting established performance expectations.</p></div>
                </label>
                <label className="result-card">
                  <input type="radio" name="overallResult" checked={get('overallResult') === 'extended'}
                    disabled={!sectionEditable('supervisor')} onChange={() => set('overallResult')('extended')} />
                  <div>
                    <strong>Probationary Period Extended</strong>
                    <p>The probationary period is extended for poor conduct and/or performance reasons until{' '}
                      <input type="date" className="inline-input inline-date" value={get('extendedUntil')}
                        disabled={!sectionEditable('supervisor')} onChange={(e) => set('extendedUntil')(e.target.value)} />
                    </p>
                  </div>
                </label>
                <label className="result-card">
                  <input type="radio" name="overallResult" checked={get('overallResult') === 'not-suitable'}
                    disabled={!sectionEditable('supervisor')} onChange={() => set('overallResult')('not-suitable')} />
                  <div><strong>Not Suitable for Employment</strong><p>Performance and/or conduct shows deficiencies which interfere with the attainment of performance expectations.</p></div>
                </label>
              </div>

              <div className="field row-gap">
                <FieldTextArea id="assistSteps" label="Steps taken to assist the employee to enhance job performance and professional development"
                  value={get('assistSteps')} disabled={!sectionEditable('supervisor')} onChange={set('assistSteps')} />
              </div>

              <div className="sig-row row-gap">
                <Field id="supSig" label="Supervisor Signature" placeholder="Type full name to sign" value={get('supSig')} disabled={!sectionEditable('supervisor')} onChange={set('supSig')} />
                <Field id="supSigDate" label="Date" type="date" value={get('supSigDate')} disabled={!sectionEditable('supervisor')} onChange={set('supSigDate')} />
              </div>

              <div className="approval-box">
                <p className="approval-title">Head of the Department <span className="tag">Approval</span></p>
                <div className="pill-group row-gap">
                  <RadioPill group="hodDecision" value="confirm" checked={get('hodDecision') === 'confirm'} disabled={!sectionEditable('supervisor')} onChange={set('hodDecision')}>Confirm</RadioPill>
                  <label className="pill">
                    <input type="radio" name="hodDecision" checked={get('hodDecision') === 'extend'}
                      disabled={!sectionEditable('supervisor')} onChange={() => set('hodDecision')('extend')} />
                    Extend Probation by
                    <input type="text" className="inline-input" placeholder="duration" style={{ width: 80, marginLeft: 6 }}
                      value={get('hodExtendDuration')} disabled={!sectionEditable('supervisor')}
                      onChange={(e) => set('hodExtendDuration')(e.target.value)} />
                  </label>
                  <RadioPill group="hodDecision" value="not-suitable" checked={get('hodDecision') === 'not-suitable'} disabled={!sectionEditable('supervisor')} onChange={set('hodDecision')}>Not Suitable for Employment</RadioPill>
                </div>
                <div className="sig-row" style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 2 }}>
                  <Field id="hodSig" label="Signature" value={get('hodSig')} disabled={!sectionEditable('supervisor')} onChange={set('hodSig')} />
                  <Field id="hodSigDate" label="Date" type="date" value={get('hodSigDate')} disabled={!sectionEditable('supervisor')} onChange={set('hodSigDate')} />
                </div>
              </div>

              <div className="approval-box">
                <p className="approval-title">Chief Executive Officer <span className="tag">Approval</span></p>
                <div className="pill-group row-gap">
                  <RadioPill group="ceoDecision" value="confirm" checked={get('ceoDecision') === 'confirm'} disabled={!sectionEditable('supervisor')} onChange={set('ceoDecision')}>Confirm</RadioPill>
                  <label className="pill">
                    <input type="radio" name="ceoDecision" checked={get('ceoDecision') === 'extend'}
                      disabled={!sectionEditable('supervisor')} onChange={() => set('ceoDecision')('extend')} />
                    Extend Probation by
                    <input type="text" className="inline-input" placeholder="duration" style={{ width: 80, marginLeft: 6 }}
                      value={get('ceoExtendDuration')} disabled={!sectionEditable('supervisor')}
                      onChange={(e) => set('ceoExtendDuration')(e.target.value)} />
                  </label>
                  <RadioPill group="ceoDecision" value="not-suitable" checked={get('ceoDecision') === 'not-suitable'} disabled={!sectionEditable('supervisor')} onChange={set('ceoDecision')}>Not Suitable for Employment</RadioPill>
                </div>
                <div className="sig-row" style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 2 }}>
                  <Field id="ceoSig" label="CEO Signature" value={get('ceoSig')} disabled={!sectionEditable('supervisor')} onChange={set('ceoSig')} />
                  <Field id="ceoSigDate" label="Date" type="date" value={get('ceoSigDate')} disabled={!sectionEditable('supervisor')} onChange={set('ceoSigDate')} />
                </div>
              </div>

              <SectionActions show={sectionEditable('supervisor')} saving={saving} exporting={exporting}
                onSaveDraft={() => onSaveDraft('supervisor')} onSubmitSection={() => onSubmitSection('supervisor')} onExport={onExport} />
            </div>
          </section>

          {/* SECTION 4: SBU HR */}
          <section className="section" data-role="sbu_hr" id="sec-sbu_hr">
            <SectionHead badge="4" role="To be filled by the SBU HR Division" name="Final HR Comments" owner={assignedTo('sbu_hr')} />
            <div className="section-body">
              <LockNote editable={sectionEditable('sbu_hr')} status={sectionStatus('sbu_hr')}
                isCurrentTurn={currentStep === 'sbu_hr'} sectionLabel="SBU HR" />

              <div className="field row-gap">
                <FieldTextArea id="sbuComments" label="Comments on overall appraisal"
                  value={get('sbuComments')} disabled={!sectionEditable('sbu_hr')} onChange={set('sbuComments')} />
              </div>
              <div className="sig-row">
                <Field id="sbuSig" label="Signature" value={get('sbuSig')} disabled={!sectionEditable('sbu_hr')} onChange={set('sbuSig')} />
                <Field id="sbuSigDate" label="Date" type="date" value={get('sbuSigDate')} disabled={!sectionEditable('sbu_hr')} onChange={set('sbuSigDate')} />
              </div>

              <SectionActions show={sectionEditable('sbu_hr')} saving={saving} exporting={exporting}
                onSaveDraft={() => onSaveDraft('sbu_hr')} onSubmitSection={() => onSubmitSection('sbu_hr')} onExport={onExport} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}