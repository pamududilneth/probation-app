import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchForm, saveSection, exportFormDocx } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ProbationProgressReview from '../components/ProbationProgressReview';

export default function FormPage() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { role: myGlobalRole } = useAuth();

  const [form, setForm] = useState(null);
  const [buffer, setBuffer] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchForm(formId)
      .then((f) => {
        setForm(f);
        setBuffer(f.data || {});
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Could not load this form'))
      .finally(() => setLoading(false));
  }, [formId]);

  useEffect(load, [load]);

  const handleFieldChange = (id, value) => {
    setBuffer((prev) => ({ ...prev, [id]: value }));
  };

  const isAdmin = form?.my_role === 'admin';

  const sectionEditable = (sectionKey) => {
    if (!form) return false;
    if (form.status !== 'in_progress') return isAdmin;
    if (isAdmin) return true;
    if (form.my_role !== sectionKey) return false;
    const section = form.sections.find((s) => s.section_key === sectionKey);
    return section?.status !== 'completed';
  };

  const sectionStatus = (sectionKey) =>
    form?.sections.find((s) => s.section_key === sectionKey)?.status || 'not_started';

  const handleSave = async (sectionKey, { submit }) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveSection(formId, sectionKey, buffer, submit);
      setForm(updated);
      setBuffer(updated.data || {});
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not save this section');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const { blob, filename } = await exportFormDocx(formId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('Could not export this form to Word right now.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (error && !form) return <div style={{ padding: 40, color: '#C0392B' }}>{error}</div>;
  if (!form) return null;

  return (
    <ProbationProgressReview
      data={buffer}
      onFieldChange={handleFieldChange}
      myRole={form.my_role}
      currentStep={form.current_step}
      formStatus={form.status}
      sectionEditable={sectionEditable}
      sectionStatus={sectionStatus}
      assignments={form.assignments}
      sections={form.sections}
      onSaveDraft={(sectionKey) => handleSave(sectionKey, { submit: false })}
      onSubmitSection={(sectionKey) => handleSave(sectionKey, { submit: true })}
      onExport={handleExport}
      saving={saving}
      exporting={exporting}
      error={error}
      onBack={() => navigate(-1)}
    />
  );
}