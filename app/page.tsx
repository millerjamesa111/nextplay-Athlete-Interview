'use client';

import React, { useState, useEffect } from 'react';
import { supabase, Submission, Rep } from '@/lib/supabase';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/system-prompt';
import {
  DEFAULT_PARENT_PRECALL_PROMPT,
  DEFAULT_PARENT_POSTCALL_PROMPT,
  DEFAULT_BOOKING_PROMPT,
  DEFAULT_PARENT_REFERENCE,
} from '@/lib/parent-prompts';

// ============================================
// STYLES
// ============================================

const styles = {
  colors: {
    bg: '#0a0f1a',
    bgCard: '#111827',
    bgHover: '#1f2937',
    accent: '#22c55e',
    accentDim: '#166534',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#60a5fa',
    text: '#f9fafb',
    textMuted: '#9ca3af',
    border: '#374151',
  }
};

const card: React.CSSProperties = { backgroundColor: styles.colors.bgCard, borderRadius: '12px', border: `1px solid ${styles.colors.border}` };
const labelStyle: React.CSSProperties = { display: 'block', color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
const textareaStyle: React.CSSProperties = { width: '100%', minHeight: '300px', padding: '16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', fontFamily: "'Space Mono', monospace", lineHeight: '1.6', resize: 'vertical', outline: 'none', boxSizing: 'border-box' };
const ghostBtn: React.CSSProperties = { padding: '8px 16px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, fontSize: '13px', cursor: 'pointer' };
const primaryBtn = (disabled = false): React.CSSProperties => ({ padding: '12px 20px', backgroundColor: disabled ? styles.colors.border : styles.colors.accent, color: disabled ? styles.colors.textMuted : '#000', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: disabled ? 'not-allowed' : 'pointer' });
const tabBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '12px', backgroundColor: active ? styles.colors.bgHover : 'transparent', border: 'none', color: active ? styles.colors.text : styles.colors.textMuted, fontWeight: '600', cursor: 'pointer', fontSize: '14px' });
const navBtn = (active: boolean): React.CSSProperties => ({ padding: '10px 20px', backgroundColor: active ? styles.colors.accent : 'transparent', color: active ? '#000' : styles.colors.text, border: active ? 'none' : `1px solid ${styles.colors.border}`, borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' });
const preStyle: React.CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: "'Space Mono', monospace", fontSize: '13px', lineHeight: '1.6', color: styles.colors.textMuted, margin: 0 };

// ============================================
// SMALL COMPONENTS (stateless — safe outside main)
// ============================================

const GradeBadge = ({ grade }: { grade: string | null }) => {
  const getGradeColor = (g: string | null) => {
    if (!g) return { bg: '#374151', text: '#9ca3af' };
    const letter = g.charAt(0).toUpperCase();
    if (letter === 'A') return { bg: '#166534', text: '#22c55e' };
    if (letter === 'B') return { bg: '#854d0e', text: '#facc15' };
    if (letter === 'C') return { bg: '#9a3412', text: '#fb923c' };
    if (letter === 'D' || letter === 'F') return { bg: '#991b1b', text: '#fca5a5' };
    return { bg: '#374151', text: '#9ca3af' };
  };
  const colors = getGradeColor(grade);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '4px 12px', borderRadius: '6px', backgroundColor: colors.bg,
      color: colors.text, fontWeight: '700', fontSize: '14px',
      fontFamily: "'Space Mono', monospace", letterSpacing: '0.5px',
    }}>
      {grade || '—'}
    </span>
  );
};

const TypeBadge = ({ type }: { type: 'athlete' | 'parent' }) => (
  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', backgroundColor: type === 'parent' ? 'rgba(96,165,250,0.15)' : 'rgba(34,197,94,0.12)', color: type === 'parent' ? styles.colors.info : styles.colors.accent }}>
    {type === 'parent' ? 'Parent Call' : 'Athlete'}
  </span>
);

const BUCKETS = ['PULL FORWARD', 'DOUBLE-BOOK', 'BOOK AS NORMAL'] as const;
const bucketColor = (b: string | null) =>
  b === 'PULL FORWARD' ? { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' }
  : b === 'DOUBLE-BOOK' ? { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' }
  : b === 'BOOK AS NORMAL' ? { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af' }
  : { bg: 'rgba(55,65,81,0.4)', text: '#6b7280' };

const BucketBadge = ({ bucket }: { bucket: string | null }) => {
  const c = bucketColor(bucket);
  return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', backgroundColor: c.bg, color: c.text, whiteSpace: 'nowrap' }}>{bucket || 'NOT SCORED'}</span>;
};

const LinkButtons = ({ transcriptUrl, recordingUrl, label }: { transcriptUrl: string | null; recordingUrl: string | null; label?: string }) => {
  const linkStyle = (enabled: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: `1px solid ${enabled ? styles.colors.accent : styles.colors.border}`, color: enabled ? styles.colors.accent : '#6b7280', backgroundColor: enabled ? 'rgba(34,197,94,0.08)' : 'transparent', cursor: enabled ? 'pointer' : 'default' });
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      {label && <span style={{ color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '4px' }}>{label}</span>}
      {transcriptUrl ? <a href={transcriptUrl} target="_blank" rel="noopener noreferrer" style={linkStyle(true)}>📄 Transcript</a> : <span style={linkStyle(false)}>📄 No transcript link</span>}
      {recordingUrl ? <a href={recordingUrl} target="_blank" rel="noopener noreferrer" style={linkStyle(true)}>🎥 Recording</a> : <span style={linkStyle(false)}>🎥 No recording link</span>}
    </div>
  );
};

const Banner = ({ tone, children }: { tone: 'warning' | 'info' | 'success'; children: React.ReactNode }) => {
  const c = tone === 'warning' ? styles.colors.warning : tone === 'info' ? styles.colors.info : styles.colors.accent;
  return <div style={{ padding: '12px 16px', borderRadius: '8px', border: `1px solid ${c}`, backgroundColor: `${c}1a`, color: c, fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>{children}</div>;
};

const Spinner = ({ label = 'Analyzing transcript...' }: { label?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px' }}>
    <div style={{
      width: '48px', height: '48px', border: `3px solid ${styles.colors.border}`,
      borderTopColor: styles.colors.accent, borderRadius: '50%', animation: 'spin 1s linear infinite',
    }} />
    <p style={{ color: styles.colors.textMuted, fontSize: '14px' }}>{label}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const isFormHeading = (line: string) => line.includes('FORM OUTPUT') || line.includes('Form Output');

const MarkdownRenderer = ({ content }: { content: string }) => {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let listItems: string[] = [];
    let inList = false;

    const processInlineStyles = (line: string) => {
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f9fafb;">$1</strong>');
      line = line.replace(/__(.+?)__/g, '<strong style="color:#f9fafb;">$1</strong>');
      line = line.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
      line = line.replace(/`([^`]+)`/g, '<code style="background:#1f2937;padding:2px 6px;border-radius:4px;font-size:13px;">$1</code>');
      return line;
    };

    const parseFormField = (line: string): { question: string; answer: string } | null => {
      const match = line.match(/^([^:]+\??)\s*:\s*(.+)$/);
      if (match && match[2].trim().length > 0) {
        return { question: match[1].replace(/\*\*/g, '').trim(), answer: match[2].replace(/\*\*/g, '').trim() };
      }
      return null;
    };

    let inFormSection = false;
    const seenQuestions = new Set<string>();

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ margin: '12px 0', paddingLeft: '24px' }}>
            {listItems.map((item, i) => {
              const formMatch = parseFormField(item);
              if (formMatch) {
                return (
                  <li key={i} style={{ marginBottom: '10px', color: '#f9fafb', listStyle: 'none', marginLeft: '-24px' }}>
                    <span style={{ color: '#9ca3af', fontWeight: '600', fontSize: '13px' }}>{formMatch.question}:</span>
                    <span style={{ color: '#22c55e', fontWeight: '500', marginLeft: '8px', fontSize: '15px' }}>{formMatch.answer}</span>
                  </li>
                );
              }
              return <li key={i} style={{ marginBottom: '8px', color: '#f9fafb' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(item) }} />;
            })}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(2);
        elements.push(
          <div key={`table-${elements.length}`} style={{ overflowX: 'auto', margin: '16px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  {headerRow.split('|').filter(c => c.trim()).map((cell, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #374151', color: '#9ca3af', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {cell.trim().replace(/\*\*/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, i) => (
                  <tr key={i}>
                    {row.split('|').filter(c => c.trim()).map((cell, j) => (
                      <td key={j} style={{ padding: '10px 12px', borderBottom: '1px solid #374151', color: '#f9fafb' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(cell.trim()) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          const code = codeContent.join('\n');
          elements.push(
            <div key={`code-${elements.length}`} style={{ position: 'relative', margin: '16px 0' }}>
              <button
                onClick={(e) => { navigator.clipboard.writeText(code); const el = e.currentTarget; el.textContent = '✓ Copied'; setTimeout(() => { el.textContent = '📋 Copy'; }, 1000); }}
                style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 10px', fontSize: '12px', backgroundColor: styles.colors.bgHover, color: styles.colors.text, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', cursor: 'pointer' }}>📋 Copy</button>
              <pre style={{ backgroundColor: '#0a0f1a', padding: '16px', paddingTop: '40px', borderRadius: '8px', overflow: 'auto', margin: 0, fontSize: '13px', lineHeight: '1.5', color: '#f9fafb', whiteSpace: 'pre-wrap' }}>{code}</pre>
            </div>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          flushList(); flushTable(); inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) { codeContent.push(line); continue; }
      if (line.includes('|') && line.trim().startsWith('|')) { flushList(); if (!inTable) inTable = true; tableRows.push(line); continue; } else if (inTable) { flushTable(); }
      // Headings: entering a FORM OUTPUT heading turns form mode on; any other heading turns it off
      if (line.startsWith('### ')) {
        flushList();
        inFormSection = isFormHeading(line);
        elements.push(<h3 key={`h3-${elements.length}`} style={{ color: '#22c55e', fontSize: '16px', fontWeight: '700', margin: '28px 0 12px 0', borderBottom: '1px solid #374151', paddingBottom: '8px' }}>{line.replace('### ', '').replace(/\*\*/g, '')}</h3>);
        continue;
      }
      if (line.startsWith('## ')) { flushList(); inFormSection = isFormHeading(line); elements.push(<h2 key={`h2-${elements.length}`} style={{ color: '#f9fafb', fontSize: '20px', fontWeight: '800', margin: '28px 0 16px 0' }}>{line.replace('## ', '').replace(/\*\*/g, '')}</h2>); continue; }
      if (line.startsWith('# ')) { flushList(); inFormSection = isFormHeading(line); elements.push(<h1 key={`h1-${elements.length}`} style={{ color: '#f9fafb', fontSize: '24px', fontWeight: '800', margin: '32px 0 16px 0' }}>{line.replace('# ', '').replace(/\*\*/g, '')}</h1>); continue; }
      if (line.startsWith('> ')) { flushList(); elements.push(<blockquote key={`quote-${elements.length}`} style={{ borderLeft: '3px solid #22c55e', paddingLeft: '16px', margin: '12px 0', color: '#d1d5db', fontStyle: 'italic' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(line.replace('> ', '')) }} />); continue; }
      if (line.match(/^[-*] /)) { inList = true; listItems.push(line.replace(/^[-*] /, '')); continue; } else if (inList && line.trim() === '') { flushList(); continue; } else if (inList) { flushList(); }
      if (line.match(/^---+$/)) { inFormSection = false; elements.push(<hr key={`hr-${elements.length}`} style={{ border: 'none', borderTop: '1px solid #374151', margin: '24px 0' }} />); continue; }
      if (line.trim() === '') continue;
      if (isFormHeading(line)) inFormSection = true;
      if (inFormSection) {
        // Split on ": " if present, otherwise on the first "? " (questions end in ?)
        let splitIndex = line.indexOf(': ');
        let sepLen = 2;
        if (splitIndex < 0) {
          const qMatch = line.indexOf('? ');
          if (qMatch >= 0) { splitIndex = qMatch + 1; sepLen = 1; } // keep the ? on the question, skip only the space
        }
        if (splitIndex > 0) {
          const question = line.substring(0, splitIndex).replace(/\*\*/g, '').trim();
          const answer = line.substring(splitIndex + sepLen).replace(/\*\*/g, '').trim();
          if (seenQuestions.has(question.toLowerCase())) { continue; }
          seenQuestions.add(question.toLowerCase());
          if (answer.length > 0) {
            elements.push(
              <div key={`field-${elements.length}`} style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ color: '#f9fafb', fontWeight: '600', fontSize: '14px' }}>{question}</span>
                <span
                  onClick={(e) => {
                    navigator.clipboard.writeText(answer);
                    const el = e.currentTarget;
                    const prev = el.textContent;
                    el.textContent = '✓ Copied';
                    setTimeout(() => { el.textContent = prev; }, 1000);
                  }}
                  title="Click to copy"
                  style={{ color: '#ef4444', fontSize: '14px', fontWeight: '400', cursor: 'pointer', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.08)', userSelect: 'all' }}
                >
                  {answer}
                </span>
              </div>
            );
          }
          continue;
        }
        continue;
      }
      elements.push(<p key={`p-${elements.length}`} style={{ margin: '12px 0', lineHeight: '1.7', color: '#f9fafb', fontSize: '15px' }} dangerouslySetInnerHTML={{ __html: processInlineStyles(line) }} />);
    }
    flushList(); flushTable();
    return elements;
  };
  return <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>{renderMarkdown(content)}</div>;
};

// ============================================
// TYPES
// ============================================

type CallType = 'athlete' | 'parent';

interface LocalSubmission {
  id: string;
  repName: string;
  repCode: string;
  athleteName: string;
  grade: string | null;
  output: string;
  transcript: string;
  timestamp: string;
  interviewDate: string | null;
  flagged: boolean;
  transcriptHeader: string | null;
  // v8
  callType: CallType;
  athleteSubmissionId: string | null;
  transcriptUrl: string | null;
  recordingUrl: string | null;
  parentName: string | null;
  outcome: string | null;
  paymentType: string | null;
  athleteContext: string | null;
  prepOutput: string | null;
  bookingPriority: string | null;
  bookingOutput: string | null;
}

interface TrendsReport {
  patterns: Array<{ issue: string; count: number; percentage: number; description: string; examples: string[]; }>;
  recommendation: string;
  totalCalls: number;
}

type DetailTab = 'results' | 'transcript' | 'brief' | 'athlete';

const PROMPTS: { key: string; label: string; description: string; fallback: string }[] = [
  { key: 'system_prompt', label: 'Athlete Interview — Grader', description: 'How athlete interview transcripts are analyzed and graded.', fallback: DEFAULT_SYSTEM_PROMPT },
  { key: 'parent_precall_prompt', label: 'Parent Call — Pre-Call Brief', description: 'The brief built from the athlete interview before the parent call.', fallback: DEFAULT_PARENT_PRECALL_PROMPT },
  { key: 'parent_postcall_prompt', label: 'Parent Call — Post-Call Grader', description: 'How parent-call transcripts are graded, plus the form output and 30-day handoff. Keep the Grade / Outcome / Payment Type header lines — the app reads them.', fallback: DEFAULT_PARENT_POSTCALL_PROMPT },
  { key: 'booking_prompt', label: 'Booking Priority', description: 'Pull Forward / Double-Book / Book as Normal scoring from the athlete interview. Keep the "📅 BOOKING PRIORITY:" line — the app reads it.', fallback: DEFAULT_BOOKING_PROMPT },
  { key: 'parent_reference', label: 'Parent Call — Reference Library', description: 'Posture frame, scripts, resistance logic and signals. Added to both parent-call prompts.', fallback: DEFAULT_PARENT_REFERENCE },
];

// ============================================
// PARSERS (pure)
// ============================================

const extractGrade = (text: string) => {
  const gradeMatch = text.match(/\*\*Grade:\s*([A-F][+\-]*)\*\*/i) || text.match(/Grade:\s*\**\s*([A-F][+\-]*)/i);
  return gradeMatch ? gradeMatch[1].toUpperCase() : null;
};

const normalizeOutcome = (raw: string | null): string | null => {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes('30')) return 'Enrolled – 30 Day';
  if (r.includes('no enroll') || r.includes('not enroll')) return 'No Enrollment';
  if (r.includes('follow')) return 'Follow-up Booked';
  if (r.includes('enrolled')) return 'Enrolled – Full Program';
  return raw.replace(/\*/g, '').trim();
};

const extractOutcome = (text: string) => {
  const m = text.match(/\*\*Outcome:\*\*\s*([^\n]+)/i) || text.match(/Outcome:\s*([^\n]+)/i);
  return normalizeOutcome(m ? m[1] : null);
};

const extractPaymentType = (text: string) => {
  const m = text.match(/\*\*Payment Type:\*\*\s*([^\n]+)/i) || text.match(/Payment Type:\s*([^\n]+)/i);
  return m ? m[1].replace(/\*/g, '').trim() : null;
};

// No enrollment AND no booked follow-up → ceiling is A- (enforced here, not trusted to the model)
const capGradeForOutcome = (grade: string | null, outcome: string | null) => {
  if (!grade) return grade;
  if (outcome === 'No Enrollment' && /^A(\+{1,2})?$/.test(grade)) return 'A-';
  return grade;
};

const needsRecurringReminder = (outcome: string | null, paymentType: string | null) =>
  !!outcome && outcome.startsWith('Enrolled') && !!paymentType && !/full\s*pay|none/i.test(paymentType);

const extractBucket = (text: string): string | null => {
  const m = text.match(/BOOKING PRIORITY:\s*\**\s*\[?\s*(PULL FORWARD|DOUBLE[- ]BOOK|BOOK AS NORMAL)/i);
  if (!m) return null;
  const b = m[1].toUpperCase().replace('DOUBLE BOOK', 'DOUBLE-BOOK');
  return b;
};

const extractSection = (text: string, heading: string) => {
  const idx = text.indexOf(heading);
  if (idx < 0) return '';
  const after = text.slice(text.indexOf('\n', idx) + 1);
  const end = after.search(/\n#{1,3} /);
  return (end >= 0 ? after.slice(0, end) : after).trim();
};

const extractTranscriptHeader = (transcript: string): string => transcript.split('\n')[0].trim();

const extractAthleteName = (text: string) => {
  const nameMatch = text.match(/Athlete Interview\s*[–-]\s*(\w+)/i) || text.match(/Athlete's Name:\s*([^\n]+)/i);
  return nameMatch ? nameMatch[1].trim() : 'Unknown';
};

const extractAthleteNameFromHeader = (header: string): string => {
  const match = header.match(/Athlete Interview with (.+?)\s*[-(]/i);
  return match ? match[1].trim() : '';
};

const extractParentName = (header: string, output: string): string | null => {
  const h = header.match(/Parent Call With (.+?)\s*[-(]/i);
  if (h) return h[1].trim();
  const o = output.match(/Parent Call\s*[–-]\s*([^\n*]+)/i);
  return o ? o[1].trim() : null;
};

const extractFormAnswer = (output: string, question: RegExp) => {
  const m = output.match(new RegExp(question.source + '[^:\\n]*:\\s*([^\\n]+)', 'i'));
  const a = m ? m[1].replace(/\*\*/g, '').trim() : '';
  return a && !/not discussed/i.test(a) ? a : '';
};

const extractInterviewDate = (transcript: string) => {
  const patterns = [/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}(?:\s+[A-Z]{2,4})?)/i, /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i, /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i, /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/i];
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      try {
        const dateStr = match[1].replace(/\//g, '-').replace(/\s+[A-Z]{2,4}$/i, '');
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
      } catch { /* continue */ }
      return match[1];
    }
  }
  return null;
};

const fmtDate = (sub: LocalSubmission) => sub.interviewDate && !isNaN(new Date(sub.interviewDate).getTime()) ? new Date(sub.interviewDate).toLocaleDateString() : new Date(sub.timestamp).toLocaleDateString();

const cleanUrl = (u: string) => { const t = u.trim(); return t ? t : null; };

// ============================================
// MAIN APP
// ============================================

export default function NextPlayCoachingApp() {
  const [view, setView] = useState<'rep' | 'mySubmissions' | 'admin'>('rep');
  const [adminTab, setAdminTab] = useState<'submissions' | 'booking' | 'reps' | 'instructions' | 'objections' | 'trends'>('submissions');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingOutput, setStreamingOutput] = useState('');
  const [result, setResult] = useState<LocalSubmission | { error: string } | null>(null);
  const [submissions, setSubmissions] = useState<LocalSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<LocalSubmission | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterRep, setFilterRep] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterType, setFilterType] = useState<'all' | CallType>('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [prompts, setPrompts] = useState<Record<string, string>>(() => Object.fromEntries(PROMPTS.map(p => [p.key, p.fallback])));
  const [editingPromptKey, setEditingPromptKey] = useState('system_prompt');
  const [promptSaved, setPromptSaved] = useState(false);
  const [objectionDoc, setObjectionDoc] = useState('');
  const [objectionSaved, setObjectionSaved] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsReport, setTrendsReport] = useState<TrendsReport | null>(null);
  const [trendsRep, setTrendsRep] = useState('all');
  const [trendsDateRange, setTrendsDateRange] = useState('30');
  const [detailTab, setDetailTab] = useState<DetailTab>('results');
  const [repCode, setRepCode] = useState('');
  const [reps, setReps] = useState<Record<string, Rep>>({});
  const [showAddRep, setShowAddRep] = useState(false);
  const [newRepName, setNewRepName] = useState('');
  const [newRepCode, setNewRepCode] = useState('');
  const [editingRep, setEditingRep] = useState<string | null>(null);
  const [viewRepCode, setViewRepCode] = useState('');
  const [isViewLoggedIn, setIsViewLoggedIn] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [adminPw, setAdminPw] = useState('');
  // v8: parent calls
  const [submitType, setSubmitType] = useState<CallType>('athlete');
  const [familySearch, setFamilySearch] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [noAthleteOnFile, setNoAthleteOnFile] = useState(false);
  const [familyTab, setFamilyTab] = useState<'brief' | 'athlete' | 'upload'>('brief');
  const [prepLoadingId, setPrepLoadingId] = useState<string | null>(null);
  const [prepStreaming, setPrepStreaming] = useState('');
  const [linkTranscript, setLinkTranscript] = useState('');
  const [linkRecording, setLinkRecording] = useState('');
  const [editLinksId, setEditLinksId] = useState<string | null>(null);
  const [editLinkT, setEditLinkT] = useState('');
  const [editLinkR, setEditLinkR] = useState('');
  // v8: booking priority
  const [bookingRunningIds, setBookingRunningIds] = useState<string[]>([]);
  const [bookingBatchLeft, setBookingBatchLeft] = useState(0);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [hideBooked, setHideBooked] = useState(true);

  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'nextplay';

  useEffect(() => { loadSubmissions(); loadSettings(); loadReps(); }, []);

  const normalizeRepName = (name: string) => name ? name.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

  const dbToLocal = (db: Submission): LocalSubmission => ({
    id: db.id, repName: db.rep_name, repCode: '', athleteName: db.athlete_name,
    grade: db.grade, output: db.output, transcript: db.transcript, timestamp: db.created_at,
    interviewDate: db.interview_date, flagged: db.flagged, transcriptHeader: db.transcript_header,
    callType: db.call_type === 'parent' ? 'parent' : 'athlete',
    athleteSubmissionId: db.athlete_submission_id || null,
    transcriptUrl: db.transcript_url || null, recordingUrl: db.recording_url || null,
    parentName: db.parent_name || null, outcome: db.outcome || null, paymentType: db.payment_type || null,
    athleteContext: db.athlete_context || null, prepOutput: db.prep_output || null,
    bookingPriority: db.booking_priority || null, bookingOutput: db.booking_output || null,
  });

  const patchLocal = (id: string, patch: Partial<LocalSubmission>) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
    setSelectedSubmission(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
    setResult(prev => prev && !('error' in prev) && prev.id === id ? { ...prev, ...patch } : prev);
  };

  const loadSubmissions = async () => {
    const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: false });
    if (data && !error) setSubmissions(data.map(dbToLocal));
  };

  const loadReps = async () => {
    const { data, error } = await supabase.from('reps').select('*').order('created_at', { ascending: true });
    if (data && !error) {
      const repsMap: Record<string, Rep> = {};
      data.forEach((rep: Rep) => { repsMap[rep.rep_code] = rep; });
      setReps(repsMap);
    }
  };

  const loadSettings = async () => {
    const keys = [...PROMPTS.map(p => p.key), 'objection_doc'];
    const { data } = await supabase.from('settings').select('key, value').in('key', keys);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
      setPrompts(prev => {
        const next = { ...prev };
        PROMPTS.forEach(p => { if (map[p.key]) next[p.key] = map[p.key]; });
        return next;
      });
      if (map.objection_doc) setObjectionDoc(map.objection_doc);
    }
  };

  const savePrompt = async (key: string, value: string) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
    await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setPromptSaved(true); setTimeout(() => setPromptSaved(false), 2000);
  };

  const resetPrompt = async (key: string) => {
    const def = PROMPTS.find(p => p.key === key)?.fallback || '';
    await savePrompt(key, def);
  };

  const saveObjectionDoc = async (doc: string) => {
    setObjectionDoc(doc);
    await supabase.from('settings').upsert({ key: 'objection_doc', value: doc, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setObjectionSaved(true); setTimeout(() => setObjectionSaved(false), 2000);
  };

  const validateRepCode = (code: string): Rep | null => {
    const normalized = code.trim().toLowerCase();
    return reps[normalized] && reps[normalized].active ? reps[normalized] : null;
  };

  const checkDuplicate = async (header: string): Promise<boolean> => {
    const { data } = await supabase.from('submissions').select('id').eq('transcript_header', header).limit(1);
    return !!(data && data.length > 0);
  };

  const saveSubmission = async (submission: LocalSubmission) => {
    const rep = validateRepCode(submission.repCode);
    const { data, error } = await supabase.from('submissions').insert({
      rep_name: submission.repName, athlete_name: submission.athleteName, grade: submission.grade,
      output: submission.output, transcript: submission.transcript, interview_date: submission.interviewDate,
      flagged: submission.flagged, transcript_header: submission.transcriptHeader, rep_id: rep?.id || null,
      call_type: submission.callType, athlete_submission_id: submission.athleteSubmissionId,
      transcript_url: submission.transcriptUrl, recording_url: submission.recordingUrl,
      parent_name: submission.parentName, outcome: submission.outcome, payment_type: submission.paymentType,
      athlete_context: submission.athleteContext,
    }).select().single();
    if (!error && data) {
      const savedSubmission = { ...submission, id: data.id };
      setSubmissions(prev => [savedSubmission, ...prev]);
      return savedSubmission;
    }
    if (error) console.error('Save failed:', error);
    return null;
  };

  const deleteSubmission = async (id: string) => {
    await supabase.from('submissions').delete().eq('id', id);
    setSubmissions(prev => prev.filter(s => s.id !== id));
    setSelectedSubmission(null);
  };

  const toggleSelectSubmission = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const toggleSelectAll = () => {
    const filteredIds = filteredSubmissions.map(s => s.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    if (allSelected) setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    else setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const deleteSelectedSubmissions = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) await supabase.from('submissions').delete().eq('id', id);
    setSubmissions(prev => prev.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  };

  const downloadSelectedSubmissions = () => {
    if (selectedIds.length === 0) return;
    const selected = submissions.filter(s => selectedIds.includes(s.id));
    let content = `# Next Play Coaching Analysis Export\n# ${selected.length} submissions exported on ${new Date().toLocaleDateString()}\n\n---\n\n`;
    selected.forEach((sub, index) => {
      content += `## Submission ${index + 1}: ${sub.athleteName} (${sub.callType === 'parent' ? 'Parent Call' : 'Athlete Interview'})\n**Rep:** ${sub.repName}\n**Grade:** ${sub.grade || 'N/A'}\n`;
      if (sub.callType === 'parent') content += `**Outcome:** ${sub.outcome || 'N/A'}\n`;
      content += `**Interview Date:** ${fmtDate(sub)}\n`;
      content += `**Submitted:** ${new Date(sub.timestamp).toLocaleDateString()}\n\n### Coaching Output\n\n${sub.output}\n\n---\n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `nextplay-analysis-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const generateTrendsReport = async () => {
    let filtered = submissions.filter(s => s.callType === 'athlete');
    if (trendsRep !== 'all') filtered = filtered.filter(s => normalizeRepName(s.repName) === trendsRep);
    if (trendsDateRange !== 'all') {
      const days = parseInt(trendsDateRange);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      filtered = filtered.filter(s => new Date(s.interviewDate || s.timestamp) > cutoff);
    }
    if (filtered.length < 2) { alert('Need at least 2 submissions to generate a trends report.'); return; }
    const replayMoments = filtered.map(s => {
      const output = s.output || '';
      const replayMatch = output.match(/#*\s*\*{0,2}\d*\.?\s*REPLAY THESE MOMENTS\*{0,2}([\s\S]*?)(?=\n#{1,3}\s|\n\*\*\d+\.|\n---|$)/i);
      return { repName: s.repName, athleteName: s.athleteName, grade: s.grade, date: s.timestamp, moments: replayMatch ? replayMatch[1].trim() : '' };
    }).filter(r => r.moments.length > 0);
    if (replayMoments.length < 2) { alert('Not enough "Replay These Moments" data to analyze.'); return; }
    setTrendsLoading(true); setTrendsReport(null);
    try {
      const response = await fetch('/api/trends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replayMoments }) });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTrendsReport(data);
    } catch (error) { console.error('Error generating trends:', error); alert('Failed to generate trends report. Please try again.'); }
    setTrendsLoading(false);
  };

  // Calls /api/analyze and reads the stream. onText gets the full text so far.
  const runModel = async (body: Record<string, unknown>, onText?: (fullSoFar: string) => void): Promise<string> => {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Analyze failed: ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');
    const decoder = new TextDecoder();
    let fullOutput = '';
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) { fullOutput = parsed.fullText || fullOutput + parsed.text; onText?.(fullOutput); }
          if (parsed.done) fullOutput = parsed.fullText;
        } catch { /* partial line — skip */ }
      }
    }
    return fullOutput;
  };

  // ---------- Booking priority ----------
  const runBooking = async (sub: LocalSubmission) => {
    setBookingRunningIds(prev => [...prev, sub.id]);
    try {
      const out = await runModel({ transcript: sub.transcript, mode: 'booking' });
      const bucket = extractBucket(out);
      await supabase.from('submissions').update({ booking_priority: bucket, booking_output: out }).eq('id', sub.id);
      patchLocal(sub.id, { bookingPriority: bucket, bookingOutput: out });
    } catch (e) { console.error('Booking score failed:', e); }
    setBookingRunningIds(prev => prev.filter(id => id !== sub.id));
  };

  const runBookingBatch = async (subs: LocalSubmission[]) => {
    setBookingBatchLeft(subs.length);
    for (const s of subs) { await runBooking(s); setBookingBatchLeft(n => n - 1); }
  };

  // ---------- Pre-call brief ----------
  const generatePrep = async (family: LocalSubmission, repName: string) => {
    setPrepLoadingId(family.id); setPrepStreaming('');
    try {
      const out = await runModel({ transcript: family.transcript, repName, mode: 'parent_prep' }, setPrepStreaming);
      await supabase.from('submissions').update({ prep_output: out }).eq('id', family.id);
      patchLocal(family.id, { prepOutput: out });
    } catch (e) { console.error('Brief failed:', e); alert('Failed to build the brief. Please try again.'); }
    setPrepLoadingId(null); setPrepStreaming('');
  };

  // ---------- Links ----------
  const saveLinks = async (id: string, t: string, r: string) => {
    const transcriptUrl = cleanUrl(t); const recordingUrl = cleanUrl(r);
    const { error } = await supabase.from('submissions').update({ transcript_url: transcriptUrl, recording_url: recordingUrl }).eq('id', id);
    if (!error) { patchLocal(id, { transcriptUrl, recordingUrl }); setEditLinksId(null); }
    else alert('Failed to save links.');
  };

  // ---------- Submit: athlete interview ----------
  const handleSubmit = async () => {
    setSubmitError('');
    const transcriptInput = document.getElementById('transcript-input') as HTMLTextAreaElement;
    const transcriptText = transcriptInput?.value?.trim();
    const normalizedCode = repCode.trim().toLowerCase();
    const rep = validateRepCode(normalizedCode);
    if (!rep) { setSubmitError('Rep code not recognized. Contact your admin.'); return; }
    if (!transcriptText) { setSubmitError('Please paste a transcript.'); return; }
    const header = extractTranscriptHeader(transcriptText);
    const isDuplicate = await checkDuplicate(header);
    if (isDuplicate) { setSubmitError('This transcript has already been submitted.'); return; }
    setIsLoading(true); setResult(null); setStreamingOutput('');
    try {
      const fullOutput = await runModel({ transcript: transcriptText, repName: rep.rep_name, mode: 'athlete' }, setStreamingOutput);
      const grade = extractGrade(fullOutput);
      const athleteName = extractAthleteNameFromHeader(header) || extractAthleteName(fullOutput);
      const interviewDate = extractInterviewDate(transcriptText);
      const submission: LocalSubmission = {
        id: Date.now().toString(), repName: rep.rep_name, repCode: normalizedCode, athleteName, grade,
        output: fullOutput, transcript: transcriptText, timestamp: new Date().toISOString(), interviewDate,
        flagged: ['B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'].includes(grade || ''), transcriptHeader: header,
        callType: 'athlete', athleteSubmissionId: null, transcriptUrl: cleanUrl(linkTranscript), recordingUrl: cleanUrl(linkRecording),
        parentName: null, outcome: null, paymentType: null, athleteContext: null, prepOutput: null, bookingPriority: null, bookingOutput: null,
      };
      const saved = await saveSubmission(submission);
      setResult(saved || submission);
      setDetailTab('results');
      setStreamingOutput('');
      setLinkTranscript(''); setLinkRecording('');
      // Score booking priority in the background so the board stays current
      if (saved) runBooking(saved);
    } catch (error) { console.error('Error:', error); setResult({ error: 'Failed to analyze transcript. Please try again.' }); }
    setIsLoading(false);
  };

  // ---------- Submit: parent call ----------
  const handleParentSubmit = async () => {
    setSubmitError('');
    const transcriptInput = document.getElementById('parent-transcript-input') as HTMLTextAreaElement;
    const transcriptText = transcriptInput?.value?.trim();
    const normalizedCode = repCode.trim().toLowerCase();
    const rep = validateRepCode(normalizedCode);
    if (!rep) { setSubmitError('Rep code not recognized. Contact your admin.'); return; }
    if (!rep.can_parent) { setSubmitError('This rep code is not set up for parent calls. Contact your admin.'); return; }
    const family = submissions.find(s => s.id === selectedFamilyId) || null;
    if (!family && !noAthleteOnFile) { setSubmitError('Pick the family first.'); return; }
    if (!transcriptText) { setSubmitError('Please paste the parent call transcript.'); return; }
    const pastedContextEl = document.getElementById('athlete-context-input') as HTMLTextAreaElement | null;
    const pastedContext = pastedContextEl?.value?.trim() || '';
    const header = extractTranscriptHeader(transcriptText);
    const isDuplicate = await checkDuplicate(header);
    if (isDuplicate) { setSubmitError('This transcript has already been submitted.'); return; }
    setIsLoading(true); setResult(null); setStreamingOutput('');
    try {
      const athleteTranscript = family ? family.transcript : pastedContext;
      const fullOutput = await runModel({ transcript: transcriptText, athleteTranscript, repName: rep.rep_name, mode: 'parent_post' }, setStreamingOutput);
      const outcome = extractOutcome(fullOutput);
      const paymentType = extractPaymentType(fullOutput);
      const rawGrade = extractGrade(fullOutput);
      const grade = capGradeForOutcome(rawGrade, outcome);
      let output = fullOutput;
      if (rawGrade && grade !== rawGrade) {
        output = output.replace(/\*\*Grade:\s*[A-F][+\-]*\*\*/i, `**Grade: ${grade}** _(capped from ${rawGrade}: no enrollment and no booked follow-up)_`);
      }
      const athleteName = family?.athleteName || extractFormAnswer(fullOutput, /Athletes? Full Name/) || 'Unknown';
      const submission: LocalSubmission = {
        id: Date.now().toString(), repName: rep.rep_name, repCode: normalizedCode, athleteName, grade,
        output, transcript: transcriptText, timestamp: new Date().toISOString(), interviewDate: extractInterviewDate(transcriptText),
        flagged: ['B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'].includes(grade || ''), transcriptHeader: header,
        callType: 'parent', athleteSubmissionId: family?.id || null,
        transcriptUrl: cleanUrl(linkTranscript), recordingUrl: cleanUrl(linkRecording),
        parentName: extractParentName(header, fullOutput), outcome, paymentType,
        athleteContext: family ? null : (pastedContext || null),
        prepOutput: null, bookingPriority: null, bookingOutput: null,
      };
      const saved = await saveSubmission(submission);
      setResult(saved || submission);
      setDetailTab('results');
      setStreamingOutput('');
      setLinkTranscript(''); setLinkRecording('');
    } catch (error) { console.error('Error:', error); setResult({ error: 'Failed to analyze transcript. Please try again.' }); }
    setIsLoading(false);
  };

  const resetSubmitForm = () => {
    setResult(null); setDetailTab('results'); setSubmitError('');
    setSelectedFamilyId(null); setNoAthleteOnFile(false); setFamilyTab('brief'); setFamilySearch('');
    setLinkTranscript(''); setLinkRecording('');
    ['transcript-input', 'parent-transcript-input', 'athlete-context-input'].forEach(id => { const el = document.getElementById(id) as HTMLTextAreaElement | null; if (el) el.value = ''; });
  };

  const handleAddRep = async () => {
    if (!newRepName.trim() || !newRepCode.trim()) return;
    const code = newRepCode.trim().toLowerCase();
    if (reps[code]) { alert('This code already exists.'); return; }
    const { data, error } = await supabase.from('reps').insert({ rep_name: newRepName.trim(), rep_code: code, active: true }).select().single();
    if (!error && data) { setReps(prev => ({ ...prev, [code]: data })); setNewRepName(''); setNewRepCode(''); setShowAddRep(false); }
    else alert('Failed to add rep. Code may already exist.');
  };

  const handleUpdateRep = async (oldCode: string, newName: string, newCode: string) => {
    const rep = reps[oldCode];
    if (!rep) return;
    const normalizedNewCode = newCode.trim().toLowerCase();
    const { error } = await supabase.from('reps').update({ rep_name: newName.trim(), rep_code: normalizedNewCode }).eq('id', rep.id);
    if (!error) {
      const updatedReps = { ...reps }; delete updatedReps[oldCode];
      updatedReps[normalizedNewCode] = { ...rep, rep_name: newName.trim(), rep_code: normalizedNewCode };
      setReps(updatedReps); setEditingRep(null); loadSubmissions();
    } else alert('Failed to update rep.');
  };

  const handleToggleRepActive = async (code: string) => {
    const rep = reps[code];
    if (!rep) return;
    const { error } = await supabase.from('reps').update({ active: !rep.active }).eq('id', rep.id);
    if (!error) setReps(prev => ({ ...prev, [code]: { ...prev[code], active: !prev[code].active } }));
  };

  const handleToggleRepParent = async (code: string) => {
    const rep = reps[code];
    if (!rep) return;
    const { error } = await supabase.from('reps').update({ can_parent: !rep.can_parent }).eq('id', rep.id);
    if (!error) setReps(prev => ({ ...prev, [code]: { ...prev[code], can_parent: !prev[code].can_parent } }));
    else alert('Failed to update. Did you run the v8 Supabase migration?');
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (filterRep !== 'all' && normalizeRepName(sub.repName) !== filterRep) return false;
    if (filterGrade !== 'all' && sub.grade?.charAt(0) !== filterGrade) return false;
    if (filterType !== 'all' && sub.callType !== filterType) return false;
    const subDate = new Date(sub.interviewDate || sub.timestamp);
    const now = new Date();
    if (filterDateRange !== 'all' && filterDateRange !== 'custom') {
      if (filterDateRange === 'today') { const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (subDate < today) return false; }
      else if (filterDateRange === 'week') { const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); if (subDate < weekAgo) return false; }
      else if (filterDateRange === 'month') { const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); if (subDate < monthAgo) return false; }
    } else if (filterDateRange === 'custom') {
      if (filterDateStart) { const startDate = new Date(filterDateStart); if (subDate < startDate) return false; }
      if (filterDateEnd) { const endDate = new Date(filterDateEnd); endDate.setHours(23, 59, 59, 999); if (subDate > endDate) return false; }
    }
    return true;
  });

  const mySubmissions = submissions.filter(s => {
    const rep = validateRepCode(viewRepCode);
    return rep && normalizeRepName(s.repName) === normalizeRepName(rep.rep_name);
  });

  const repNames = Array.from(new Set(submissions.map(s => normalizeRepName(s.repName)))).filter(Boolean);

  // Families = athlete interviews in the tool
  const athleteSubs = submissions.filter(s => s.callType === 'athlete');
  const parentCallsFor = (athleteId: string) => submissions.filter(s => s.callType === 'parent' && s.athleteSubmissionId === athleteId);
  const linkedAthlete = (sub: LocalSubmission) => sub.athleteSubmissionId ? submissions.find(s => s.id === sub.athleteSubmissionId) || null : null;
  const familyMatches = (() => {
    const q = familySearch.trim().toLowerCase();
    if (!q) return athleteSubs.slice(0, 10);
    return athleteSubs.filter(s => `${s.athleteName} ${s.transcriptHeader || ''} ${s.repName} ${s.transcript.slice(0, 4000)}`.toLowerCase().includes(q)).slice(0, 15);
  })();
  const selectedFamily = selectedFamilyId ? submissions.find(s => s.id === selectedFamilyId) || null : null;
  const currentRep = validateRepCode(repCode);
  const canParent = !!currentRep?.can_parent;

  // Booking board
  const bookingRows = athleteSubs.filter(s => !hideBooked || parentCallsFor(s.id).length === 0);
  const unscored = bookingRows.filter(s => !s.bookingPriority && !bookingRunningIds.includes(s.id));
  const bookingGroups: { bucket: string | null; rows: LocalSubmission[] }[] = [
    ...BUCKETS.map(b => ({ bucket: b as string, rows: bookingRows.filter(s => s.bookingPriority === b) })),
    { bucket: null, rows: bookingRows.filter(s => !s.bookingPriority || !(BUCKETS as readonly string[]).includes(s.bookingPriority)) },
  ];

  // ============================================
  // RENDER HELPERS (plain functions returning JSX — not components, so no remounting)
  // ============================================

  const renderLinksEditor = (sub: LocalSubmission) => (
    editLinksId === sub.id ? (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
        <input value={editLinkT} onChange={(e) => setEditLinkT(e.target.value)} placeholder="Transcript link (Google Doc)" style={{ ...inputStyle, width: '280px', padding: '8px 12px' }} />
        <input value={editLinkR} onChange={(e) => setEditLinkR(e.target.value)} placeholder="Recording link (Drive video)" style={{ ...inputStyle, width: '280px', padding: '8px 12px' }} />
        <button onClick={() => saveLinks(sub.id, editLinkT, editLinkR)} style={{ ...primaryBtn(), padding: '8px 14px' }}>Save</button>
        <button onClick={() => setEditLinksId(null)} style={ghostBtn}>Cancel</button>
      </div>
    ) : (
      <button onClick={() => { setEditLinksId(sub.id); setEditLinkT(sub.transcriptUrl || ''); setEditLinkR(sub.recordingUrl || ''); }} style={{ ...ghostBtn, padding: '6px 12px', fontSize: '12px', color: styles.colors.textMuted }}>✏️ {sub.transcriptUrl || sub.recordingUrl ? 'Edit links' : 'Add links'}</button>
    )
  );

  const renderDetail = (sub: LocalSubmission, opts: { admin: boolean; nav?: boolean }) => {
    const canNav = opts.nav !== false;
    const athlete = sub.callType === 'parent' ? linkedAthlete(sub) : null;
    const parentCalls = sub.callType === 'athlete' ? parentCallsFor(sub.id) : [];
    const athleteText = athlete?.transcript || sub.athleteContext || '';
    const tabs: { key: DetailTab; label: string }[] = [{ key: 'results', label: 'Results' }, { key: 'transcript', label: 'Transcript' }];
    if (sub.callType === 'athlete' && sub.prepOutput) tabs.push({ key: 'brief', label: 'Pre-Call Brief' });
    if (sub.callType === 'parent' && athleteText) tabs.push({ key: 'athlete', label: 'Athlete Interview' });
    const tab = tabs.some(t => t.key === detailTab) ? detailTab : 'results';
    return (
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${styles.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: 0 }}>{sub.athleteName}</h2>
              <TypeBadge type={sub.callType} />
              {sub.callType === 'athlete' && opts.admin && <BucketBadge bucket={sub.bookingPriority} />}
            </div>
            <p style={{ color: styles.colors.textMuted, fontSize: '14px', margin: '4px 0 0' }}>
              {sub.repName} · {fmtDate(sub)}
              {sub.callType === 'parent' && sub.parentName && <> · Parent: {sub.parentName}</>}
              {sub.callType === 'parent' && sub.outcome && <> · <span style={{ color: sub.outcome.startsWith('Enrolled') ? styles.colors.accent : styles.colors.text }}>{sub.outcome}</span></>}
              {sub.callType === 'parent' && sub.paymentType && sub.paymentType !== 'None' && <> · {sub.paymentType}</>}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GradeBadge grade={sub.grade} />
            {opts.admin && <button onClick={() => { if (confirm('Delete this submission?')) deleteSubmission(sub.id); }} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.danger}`, borderRadius: '6px', color: styles.colors.danger, fontSize: '13px', cursor: 'pointer' }}>Delete</button>}
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${styles.colors.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <LinkButtons transcriptUrl={sub.transcriptUrl} recordingUrl={sub.recordingUrl} label={sub.callType === 'parent' ? 'Parent call' : 'Interview'} />
            {renderLinksEditor(sub)}
          </div>
          {athlete && <LinkButtons transcriptUrl={athlete.transcriptUrl} recordingUrl={athlete.recordingUrl} label="Athlete interview" />}
          {sub.callType === 'parent' && needsRecurringReminder(sub.outcome, sub.paymentType) && (
            <Banner tone="warning">⚠️ Set up the recurring / scheduled payment in GoHighLevel ({sub.paymentType}).</Banner>
          )}
          {athlete && canNav && (
            <div><button onClick={() => { setSelectedSubmission(athlete); setDetailTab('results'); }} style={{ ...ghostBtn, fontSize: '12px' }}>← Open athlete interview ({athlete.repName}, {fmtDate(athlete)})</button></div>
          )}
          {parentCalls.length > 0 && canNav && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: styles.colors.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parent calls</span>
              {parentCalls.map(pc => (
                <button key={pc.id} onClick={() => { setSelectedSubmission(pc); setDetailTab('results'); }} style={{ ...ghostBtn, fontSize: '12px', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                  {pc.repName} · {fmtDate(pc)} · {pc.outcome || '—'} <GradeBadge grade={pc.grade} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', borderBottom: `1px solid ${styles.colors.border}` }}>
          {tabs.map(t => <button key={t.key} onClick={() => setDetailTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>)}
        </div>
        <div style={{ padding: '24px', maxHeight: opts.admin ? '640px' : undefined, overflow: 'auto' }}>
          {tab === 'transcript' && <pre style={preStyle}>{sub.transcript}</pre>}
          {tab === 'results' && <MarkdownRenderer content={sub.output} />}
          {tab === 'brief' && sub.prepOutput && <MarkdownRenderer content={sub.prepOutput} />}
          {tab === 'athlete' && <pre style={preStyle}>{athleteText}</pre>}
        </div>
      </div>
    );
  };

  const renderBrief = (family: LocalSubmission) => {
    const loading = prepLoadingId === family.id;
    const content = loading ? prepStreaming : family.prepOutput;
    const quickFill = family.prepOutput ? extractSection(family.prepOutput, 'GHL QUICK-FILL') : '';
    return (
      <div>
        {!content && !loading && (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ color: styles.colors.textMuted, fontSize: '14px', marginBottom: '16px' }}>No brief yet. Builds the cheat sheet, objection forecast, questions and close path from the athlete interview.</p>
            <button onClick={() => generatePrep(family, currentRep?.rep_name || 'the closer')} disabled={!!prepLoadingId} style={primaryBtn(!!prepLoadingId)}>⚡ Build Pre-Call Brief</button>
          </div>
        )}
        {loading && !content && <Spinner label="Building the brief..." />}
        {content && (
          <>
            {!loading && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '8px' }}>
                {quickFill && (
                  <button onClick={(e) => { navigator.clipboard.writeText(quickFill); const el = e.currentTarget; el.textContent = '✓ Copied'; setTimeout(() => { el.textContent = '📋 Copy GHL quick-fill'; }, 1000); }} style={{ ...ghostBtn, fontSize: '12px' }}>📋 Copy GHL quick-fill</button>
                )}
                <button onClick={() => { if (confirm('Rebuild the brief? This replaces the saved one.')) generatePrep(family, currentRep?.rep_name || 'the closer'); }} disabled={!!prepLoadingId} style={{ ...ghostBtn, fontSize: '12px', color: styles.colors.textMuted }}>↻ Rebuild</button>
              </div>
            )}
            <MarkdownRenderer content={content} />
          </>
        )}
      </div>
    );
  };

  const renderParentUpload = () => (
    <div>
      {noAthleteOnFile && (
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Athlete interview transcript (optional, for context)</label>
          <textarea id="athlete-context-input" placeholder="Paste the athlete interview if you have it. Leave blank to grade the parent call on its own." style={{ ...textareaStyle, minHeight: '140px' }} />
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Paste Parent Call Transcript</label>
        <textarea id="parent-transcript-input" placeholder="Parent Call With Jane Smith - 2026/11/17 18:00 CST - Transcript..." style={textareaStyle} />
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ flex: '1 1 260px' }}>
          <label style={labelStyle}>Transcript link</label>
          <input value={linkTranscript} onChange={(e) => setLinkTranscript(e.target.value)} placeholder="https://docs.google.com/document/d/..." style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 260px' }}>
          <label style={labelStyle}>Recording link</label>
          <input value={linkRecording} onChange={(e) => setLinkRecording(e.target.value)} placeholder="https://drive.google.com/file/d/..." style={inputStyle} />
        </div>
      </div>
      <button onClick={handleParentSubmit} disabled={isLoading} style={{ ...primaryBtn(isLoading), width: '100%', padding: '16px', fontSize: '16px' }}>
        {isLoading ? 'Grading...' : 'Grade Parent Call + Fill Form'}
      </button>
    </div>
  );

  // ============================================
  // MAIN RENDER - ALL VIEWS INLINED
  // ============================================

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        gap: '8px', padding: '12px', backgroundColor: 'rgba(10, 15, 26, 0.95)',
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${styles.colors.border}`, zIndex: 1000, flexWrap: 'wrap',
      }}>
        <button onClick={() => setView('rep')} style={navBtn(view === 'rep')}>Submit Transcript</button>
        <button onClick={() => { setView('mySubmissions'); setSelectedSubmission(null); }} style={navBtn(view === 'mySubmissions')}>View My Submissions</button>
        <button onClick={() => { setView('admin'); setSelectedSubmission(null); }} style={navBtn(view === 'admin')}>Admin Dashboard</button>
      </nav>

      <div style={{ paddingTop: '60px' }}>

        {/* ========== REP VIEW (Submit Transcript) ========== */}
        {view === 'rep' && (
          <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, padding: '40px 20px' }}>
            <div style={{ maxWidth: '860px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '32px' }}>🏈</span>
                  <h1 style={{ fontSize: '28px', fontWeight: '800', color: styles.colors.text, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.5px', margin: 0 }}>NEXT PLAY</h1>
                </div>
                <p style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>{submitType === 'parent' && canParent ? 'Parent Call Command Center' : 'Athlete Interview Command Center'}</p>
              </div>

              {!result ? (
                <>
                  <div style={{ ...card, padding: '28px' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={labelStyle}>Rep Code</label>
                      <input
                        type="text"
                        value={repCode}
                        onChange={(e) => setRepCode(e.target.value)}
                        placeholder="e.g., will-223"
                        style={{ ...inputStyle, width: '200px', fontSize: '16px', padding: '14px 16px' }}
                      />
                      {repCode.length >= 5 && (
                        <span style={{ marginLeft: '12px', fontSize: '14px', color: currentRep ? styles.colors.accent : styles.colors.danger }}>
                          {currentRep ? `✓ ${currentRep.rep_name}` : '✗ Code not recognized'}
                        </span>
                      )}
                    </div>

                    {canParent && (
                      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', border: `1px solid ${styles.colors.border}`, borderRadius: '8px', overflow: 'hidden', width: 'fit-content' }}>
                        <button onClick={() => { setSubmitType('athlete'); setSubmitError(''); }} style={{ padding: '10px 20px', border: 'none', backgroundColor: submitType === 'athlete' ? styles.colors.accent : 'transparent', color: submitType === 'athlete' ? '#000' : styles.colors.text, fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Athlete Interview</button>
                        <button onClick={() => { setSubmitType('parent'); setSubmitError(''); }} style={{ padding: '10px 20px', border: 'none', backgroundColor: submitType === 'parent' ? styles.colors.accent : 'transparent', color: submitType === 'parent' ? '#000' : styles.colors.text, fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Parent Call</button>
                      </div>
                    )}

                    {/* ---- ATHLETE INTERVIEW FORM ---- */}
                    {!(submitType === 'parent' && canParent) && (
                      <>
                        <div style={{ marginBottom: '20px' }}>
                          <label style={labelStyle}>Paste Transcript</label>
                          <textarea id="transcript-input" placeholder="Athlete Interview with Mike Strong - 2026/04/08 18:51 CDT - Transcript..." style={textareaStyle} />
                          <p style={{ fontSize: '12px', color: styles.colors.textMuted, marginTop: '8px' }}>Athlete name and date will be extracted from the first line.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                          <div style={{ flex: '1 1 260px' }}>
                            <label style={labelStyle}>Transcript link (optional)</label>
                            <input value={linkTranscript} onChange={(e) => setLinkTranscript(e.target.value)} placeholder="https://docs.google.com/document/d/..." style={inputStyle} />
                          </div>
                          <div style={{ flex: '1 1 260px' }}>
                            <label style={labelStyle}>Recording link (optional)</label>
                            <input value={linkRecording} onChange={(e) => setLinkRecording(e.target.value)} placeholder="https://drive.google.com/file/d/..." style={inputStyle} />
                          </div>
                        </div>
                        <button onClick={handleSubmit} disabled={isLoading} style={{ ...primaryBtn(isLoading), width: '100%', padding: '16px', fontSize: '16px' }}>
                          {isLoading ? 'Analyzing...' : 'Get Coaching Feedback'}
                        </button>
                      </>
                    )}

                    {/* ---- PARENT CALL FLOW ---- */}
                    {submitType === 'parent' && canParent && (
                      <>
                        {!selectedFamily && !noAthleteOnFile ? (
                          <div>
                            <label style={labelStyle}>1. Find the family</label>
                            <input value={familySearch} onChange={(e) => setFamilySearch(e.target.value)} placeholder="Search athlete, parent, or rep name..." style={{ ...inputStyle, marginBottom: '12px' }} />
                            <div style={{ border: `1px solid ${styles.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                              {familyMatches.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: styles.colors.textMuted, fontSize: '14px' }}>No athlete interviews match.</div>
                              ) : familyMatches.map(f => {
                                const pcs = parentCallsFor(f.id);
                                return (
                                  <div key={f.id} onClick={() => { setSelectedFamilyId(f.id); setFamilyTab('brief'); setSubmitError(''); }}
                                    style={{ padding: '14px 18px', borderBottom: `1px solid ${styles.colors.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                    <div>
                                      <p style={{ color: styles.colors.text, fontWeight: '600', margin: '0 0 4px' }}>{f.athleteName}</p>
                                      <p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>Interview by {f.repName} · {fmtDate(f)}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                      {f.prepOutput && <span style={{ fontSize: '11px', color: styles.colors.accent, fontWeight: '700' }}>BRIEF READY</span>}
                                      {pcs.length > 0 && <span style={{ fontSize: '11px', color: styles.colors.info, fontWeight: '700' }}>PARENT CALL DONE</span>}
                                      <span style={{ color: styles.colors.textMuted }}>→</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <button onClick={() => { setNoAthleteOnFile(true); setFamilyTab('upload'); }} style={{ ...ghostBtn, marginTop: '12px', fontSize: '12px', color: styles.colors.textMuted }}>Family not in the tool? Grade the parent call without it →</button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                              <div>
                                <p style={{ ...labelStyle, marginBottom: '4px' }}>Family</p>
                                <h2 style={{ color: styles.colors.text, fontSize: '20px', fontWeight: '800', margin: 0 }}>{selectedFamily ? selectedFamily.athleteName : 'No athlete interview on file'}</h2>
                                {selectedFamily && <p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: '4px 0 0' }}>Interview by {selectedFamily.repName} · {fmtDate(selectedFamily)}</p>}
                              </div>
                              <button onClick={() => { setSelectedFamilyId(null); setNoAthleteOnFile(false); setFamilyTab('brief'); setSubmitError(''); }} style={ghostBtn}>← Change family</button>
                            </div>
                            {selectedFamily && (
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                                <LinkButtons transcriptUrl={selectedFamily.transcriptUrl} recordingUrl={selectedFamily.recordingUrl} label="Athlete interview" />
                                {renderLinksEditor(selectedFamily)}
                              </div>
                            )}
                            {selectedFamily && parentCallsFor(selectedFamily.id).length > 0 && (
                              <Banner tone="info">This family already has a graded parent call. You can still upload another (e.g. a P2 / follow-up).</Banner>
                            )}
                            <div style={{ border: `1px solid ${styles.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', borderBottom: `1px solid ${styles.colors.border}` }}>
                                {selectedFamily && <button onClick={() => setFamilyTab('brief')} style={tabBtn(familyTab === 'brief')}>2. Pre-Call Brief</button>}
                                {selectedFamily && <button onClick={() => setFamilyTab('athlete')} style={tabBtn(familyTab === 'athlete')}>Athlete Transcript</button>}
                                <button onClick={() => setFamilyTab('upload')} style={tabBtn(familyTab === 'upload')}>3. Upload Parent Call</button>
                              </div>
                              <div style={{ padding: '20px' }}>
                                {/* All panes stay mounted so a pasted transcript survives tab switches */}
                                {selectedFamily && <div style={{ display: familyTab === 'brief' ? 'block' : 'none' }}>{renderBrief(selectedFamily)}</div>}
                                {selectedFamily && <div style={{ display: familyTab === 'athlete' ? 'block' : 'none' }}><pre style={{ ...preStyle, maxHeight: '520px', overflow: 'auto' }}>{selectedFamily.transcript}</pre></div>}
                                <div style={{ display: familyTab === 'upload' || !selectedFamily ? 'block' : 'none' }}>{renderParentUpload()}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {submitError && (
                      <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: `1px solid ${styles.colors.danger}`, borderRadius: '8px', color: styles.colors.danger, fontSize: '14px' }}>{submitError}</div>
                    )}
                  </div>
                  {isLoading && (
                    <div style={{ ...card, marginTop: '24px', padding: '32px' }}>
                      {streamingOutput ? <MarkdownRenderer content={streamingOutput} /> : <Spinner />}
                    </div>
                  )}
                </>
              ) : 'error' in result ? (
                <div style={{ ...card, padding: '32px', border: `1px solid ${styles.colors.danger}`, textAlign: 'center' }}>
                  <p style={{ color: styles.colors.danger, fontSize: '16px', marginBottom: '16px' }}>{result.error}</p>
                  <button onClick={() => setResult(null)} style={primaryBtn()}>Try Again</button>
                </div>
              ) : (
                <div>
                  <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: `1px solid ${styles.colors.accent}`, borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><span style={{ color: styles.colors.accent, fontWeight: '700' }}>✓ Submission #{result.id.slice(-6)} saved</span><span style={{ color: styles.colors.textMuted, marginLeft: '12px' }}>{result.athleteName}</span></div>
                    <GradeBadge grade={result.grade} />
                  </div>
                  {renderDetail(result, { admin: false, nav: false })}
                  <button onClick={resetSubmitForm}
                    style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                    ← Submit Another Transcript
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== MY SUBMISSIONS VIEW ========== */}
        {view === 'mySubmissions' && (
          <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, padding: '40px 20px' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <h1 style={{ color: styles.colors.text, fontSize: '28px', fontWeight: '800', marginBottom: '24px' }}>📋 View My Submissions</h1>
              {!isViewLoggedIn ? (
                <div style={{ ...card, padding: '32px', maxWidth: '400px' }}>
                  <label style={labelStyle}>Enter Your Rep Code</label>
                  <input type="text" value={viewRepCode} onChange={(e) => setViewRepCode(e.target.value)} placeholder="e.g., will-223"
                    style={{ ...inputStyle, fontSize: '16px', padding: '14px 16px', marginBottom: '16px' }} />
                  <button onClick={() => { if (validateRepCode(viewRepCode)) setIsViewLoggedIn(true); else alert('Rep code not recognized.'); }}
                    style={{ ...primaryBtn(), width: '100%', padding: '14px', fontSize: '16px' }}>View Submissions</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <span style={{ color: styles.colors.textMuted }}>{validateRepCode(viewRepCode)?.rep_name} · {mySubmissions.length} submissions</span>
                    <button onClick={() => { setIsViewLoggedIn(false); setViewRepCode(''); setSelectedSubmission(null); }} style={{ ...ghostBtn, color: styles.colors.textMuted }}>Log Out</button>
                  </div>
                  {selectedSubmission ? (
                    <div>
                      <button onClick={() => setSelectedSubmission(null)} style={{ ...ghostBtn, marginBottom: '16px' }}>← Back to List</button>
                      {renderDetail(selectedSubmission, { admin: false })}
                    </div>
                  ) : (
                    <div style={{ ...card, overflow: 'hidden' }}>
                      {mySubmissions.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: styles.colors.textMuted }}>No submissions yet</div>
                      ) : mySubmissions.map(sub => (
                        <div key={sub.id} onClick={() => { setSelectedSubmission(sub); setDetailTab('results'); }}
                          style={{ padding: '16px 24px', borderBottom: `1px solid ${styles.colors.border}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ color: styles.colors.text, fontWeight: '600', margin: '0 0 4px', display: 'flex', gap: '8px', alignItems: 'center' }}>{sub.athleteName} <TypeBadge type={sub.callType} /></p>
                            <p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>{fmtDate(sub)}{sub.callType === 'parent' && sub.outcome ? ` · ${sub.outcome}` : ''}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><GradeBadge grade={sub.grade} /><span style={{ color: styles.colors.textMuted }}>→</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== ADMIN VIEW ========== */}
        {view === 'admin' && (
          !isAuthenticated ? (
            <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ ...card, padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔒</span>
                <h2 style={{ color: styles.colors.text, fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Admin Access</h2>
                <p style={{ color: styles.colors.textMuted, fontSize: '14px', marginBottom: '24px' }}>Enter password to view submissions</p>
                <input type="password" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="Password"
                  onKeyDown={(e) => { if (e.key === 'Enter' && adminPw === ADMIN_PASSWORD) setIsAuthenticated(true); }}
                  style={{ ...inputStyle, fontSize: '16px', padding: '14px 16px', marginBottom: '16px' }} />
                <button onClick={() => { if (adminPw === ADMIN_PASSWORD) setIsAuthenticated(true); }}
                  style={{ ...primaryBtn(), width: '100%', padding: '14px', fontSize: '16px' }}>Enter</button>
              </div>
            </div>
          ) : (
            <div style={{ minHeight: '100vh', backgroundColor: styles.colors.bg, padding: '40px 20px' }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div><h1 style={{ color: styles.colors.text, fontSize: '28px', fontWeight: '800', margin: '0 0 4px 0' }}>📊 Admin Dashboard</h1><p style={{ color: styles.colors.textMuted, fontSize: '14px', margin: 0 }}>{athleteSubs.length} athlete interviews · {submissions.length - athleteSubs.length} parent calls</p></div>
                </div>

                {/* Admin Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${styles.colors.border}`, paddingBottom: '16px', flexWrap: 'wrap' }}>
                  {(['submissions', 'booking', 'reps', 'instructions', 'objections', 'trends'] as const).map(tab => (
                    <button key={tab} onClick={() => { setAdminTab(tab); setSelectedSubmission(null); }}
                      style={{ padding: '10px 20px', backgroundColor: adminTab === tab ? styles.colors.bgHover : 'transparent', color: adminTab === tab ? styles.colors.text : styles.colors.textMuted, border: `1px solid ${adminTab === tab ? styles.colors.border : 'transparent'}`, borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                      {tab === 'submissions' && '📋 Submissions'}{tab === 'booking' && '📅 Booking Priority'}{tab === 'reps' && '👥 Manage Reps'}{tab === 'instructions' && '⚙️ Edit Instructions'}{tab === 'objections' && '💬 Objection Handling'}{tab === 'trends' && '📈 Trends Report'}
                    </button>
                  ))}
                </div>

                {/* BOOKING PRIORITY TAB */}
                {adminTab === 'booking' && (
                  selectedSubmission ? (
                    <div>
                      <button onClick={() => setSelectedSubmission(null)} style={{ ...ghostBtn, marginBottom: '16px' }}>← Back to Booking Priority</button>
                      {renderDetail(selectedSubmission, { admin: true })}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <button onClick={() => runBookingBatch(unscored)} disabled={unscored.length === 0 || bookingBatchLeft > 0} style={primaryBtn(unscored.length === 0 || bookingBatchLeft > 0)}>
                          {bookingBatchLeft > 0 ? `Scoring… ${bookingBatchLeft} left` : `Score unscored (${unscored.length})`}
                        </button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: styles.colors.textMuted, fontSize: '14px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={hideBooked} onChange={(e) => setHideBooked(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: styles.colors.accent }} />
                          Hide families that already have a graded parent call
                        </label>
                      </div>
                      <p style={{ color: styles.colors.textMuted, fontSize: '13px', marginTop: 0, marginBottom: '20px' }}>New athlete interviews are scored automatically on submit. Grad years come from the transcript only. Confirm against the CRM before moving anyone.</p>
                      {bookingGroups.map(group => group.rows.length > 0 && (
                        <div key={group.bucket || 'none'} style={{ marginBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <BucketBadge bucket={group.bucket} />
                            <span style={{ color: styles.colors.textMuted, fontSize: '13px' }}>{group.rows.length} {group.rows.length === 1 ? 'family' : 'families'}</span>
                          </div>
                          <div style={{ ...card, overflow: 'hidden' }}>
                            {group.rows.map(s => {
                              const running = bookingRunningIds.includes(s.id);
                              const expanded = expandedBookingId === s.id;
                              return (
                                <div key={s.id} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                                  <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ cursor: s.bookingOutput ? 'pointer' : 'default', flex: '1 1 300px' }} onClick={() => s.bookingOutput && setExpandedBookingId(expanded ? null : s.id)}>
                                      <p style={{ color: styles.colors.text, fontWeight: '600', margin: '0 0 4px' }}>{s.bookingOutput ? (expanded ? '▾ ' : '▸ ') : ''}{s.athleteName}</p>
                                      <p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>Interview by {s.repName} · {fmtDate(s)}{parentCallsFor(s.id).length > 0 ? ' · parent call done' : ''}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <button onClick={() => { setSelectedSubmission(s); setDetailTab('results'); }} style={{ ...ghostBtn, fontSize: '12px' }}>Open</button>
                                      <button onClick={() => runBooking(s)} disabled={running} style={{ ...ghostBtn, fontSize: '12px', color: styles.colors.textMuted }}>{running ? 'Scoring…' : s.bookingPriority ? '↻ Re-score' : 'Score'}</button>
                                    </div>
                                  </div>
                                  {expanded && s.bookingOutput && (
                                    <pre style={{ ...preStyle, color: styles.colors.text, padding: '0 20px 16px 36px' }}>{s.bookingOutput}</pre>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {bookingRows.length === 0 && <div style={{ ...card, padding: '40px', textAlign: 'center', color: styles.colors.textMuted }}>No families to show.</div>}
                    </div>
                  )
                )}

                {/* MANAGE REPS TAB */}
                {adminTab === 'reps' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: 0 }}>Rep Codes</h2>
                      <button onClick={() => setShowAddRep(true)} style={{ padding: '10px 16px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>+ Add Rep</button>
                    </div>
                    {showAddRep && (
                      <div style={{ ...card, padding: '20px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div><label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', marginBottom: '6px' }}>Rep Name</label><input type="text" value={newRepName} onChange={(e) => setNewRepName(e.target.value)} placeholder="Will Daffron" style={{ padding: '10px 14px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '180px' }} /></div>
                          <div><label style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', marginBottom: '6px' }}>Code</label><input type="text" value={newRepCode} onChange={(e) => setNewRepCode(e.target.value)} placeholder="will-223" style={{ padding: '10px 14px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '140px', fontFamily: 'monospace' }} /></div>
                          <button onClick={handleAddRep} style={{ padding: '10px 16px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => { setShowAddRep(false); setNewRepName(''); setNewRepCode(''); }} style={{ padding: '10px 16px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.textMuted, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    <div style={{ ...card, overflow: 'hidden' }}>
                      {Object.keys(reps).length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: styles.colors.textMuted }}>No reps yet. Add your first rep above.</div>
                      ) : Object.entries(reps).map(([code, rep]) => (
                        <div key={code} style={{ padding: '16px 24px', borderBottom: `1px solid ${styles.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: rep.active ? 1 : 0.5 }}>
                          {editingRep === code ? (
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                              <input type="text" defaultValue={rep.rep_name} id={`edit-name-${code}`} style={{ padding: '8px 12px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '160px' }} />
                              <input type="text" defaultValue={code} id={`edit-code-${code}`} style={{ padding: '8px 12px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.text, width: '120px', fontFamily: 'monospace' }} />
                              <button onClick={() => { const newName = (document.getElementById(`edit-name-${code}`) as HTMLInputElement).value; const newCode = (document.getElementById(`edit-code-${code}`) as HTMLInputElement).value; handleUpdateRep(code, newName, newCode); }} style={{ padding: '8px 12px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
                              <button onClick={() => setEditingRep(null)} style={{ padding: '8px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.textMuted, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <div><p style={{ color: styles.colors.text, fontWeight: '600', margin: '0 0 2px' }}>{rep.rep_name}{!rep.active && <span style={{ color: styles.colors.danger, fontSize: '12px', marginLeft: '8px' }}>(Inactive)</span>}{rep.can_parent && <span style={{ color: styles.colors.info, fontSize: '11px', fontWeight: '700', marginLeft: '8px' }}>PARENT CALLS</span>}</p><p style={{ color: styles.colors.textMuted, fontSize: '13px', fontFamily: 'monospace', margin: 0 }}>{code}</p></div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleToggleRepParent(code)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: rep.can_parent ? styles.colors.info : styles.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}>{rep.can_parent ? 'Parent calls: On' : 'Parent calls: Off'}</button>
                                <button onClick={() => setEditingRep(code)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: styles.colors.textMuted, fontSize: '13px', cursor: 'pointer' }}>Edit</button>
                                <button onClick={() => handleToggleRepActive(code)} style={{ padding: '6px 12px', backgroundColor: 'transparent', border: `1px solid ${styles.colors.border}`, borderRadius: '6px', color: rep.active ? styles.colors.danger : styles.colors.accent, fontSize: '13px', cursor: 'pointer' }}>{rep.active ? 'Deactivate' : 'Activate'}</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EDIT INSTRUCTIONS TAB */}
                {adminTab === 'instructions' && (
                  <div>
                    <div style={{ ...card, padding: '24px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <select value={editingPromptKey} onChange={(e) => setEditingPromptKey(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bg, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginBottom: '8px' }}>
                            {PROMPTS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                          </select>
                          <p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>{PROMPTS.find(p => p.key === editingPromptKey)?.description}</p>
                        </div>
                        {promptSaved && <span style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '600' }}>✓ Saved</span>}
                      </div>
                      <textarea value={prompts[editingPromptKey] || ''} onChange={(e) => setPrompts(prev => ({ ...prev, [editingPromptKey]: e.target.value }))}
                        style={{ ...textareaStyle, minHeight: '500px', fontSize: '13px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => savePrompt(editingPromptKey, prompts[editingPromptKey] || '')} style={primaryBtn()}>Save Changes</button>
                      <button onClick={() => { if (confirm('Reset this prompt to the default?')) resetPrompt(editingPromptKey); }} style={{ padding: '12px 24px', backgroundColor: 'transparent', color: styles.colors.textMuted, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Reset to Default</button>
                    </div>
                  </div>
                )}

                {/* OBJECTION HANDLING TAB */}
                {adminTab === 'objections' && (
                  <div>
                    <div style={{ ...card, padding: '24px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div><h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0' }}>Objection Handling</h2><p style={{ color: styles.colors.textMuted, fontSize: '13px', margin: 0 }}>Examples for athlete interview analysis. (Parent-call objection logic lives in Edit Instructions → Parent Call — Reference Library.)</p></div>
                        {objectionSaved && <span style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '600' }}>✓ Saved</span>}
                      </div>
                      <textarea value={objectionDoc} onChange={(e) => setObjectionDoc(e.target.value)}
                        placeholder="Add your objection handling examples here..."
                        style={{ ...textareaStyle, minHeight: '400px', fontSize: '13px' }} />
                    </div>
                    <button onClick={() => saveObjectionDoc(objectionDoc)} style={primaryBtn()}>Save Objection Handling</button>
                  </div>
                )}

                {/* TRENDS REPORT TAB */}
                {adminTab === 'trends' && (
                  <div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select value={trendsRep} onChange={(e) => setTrendsRep(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', cursor: 'pointer' }}>
                        <option value="all">All Reps</option>
                        {repNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                      <select value={trendsDateRange} onChange={(e) => setTrendsDateRange(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px', cursor: 'pointer' }}>
                        <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option>
                      </select>
                      <button onClick={generateTrendsReport} disabled={trendsLoading} style={primaryBtn(trendsLoading)}>{trendsLoading ? 'Analyzing...' : 'Generate Trends Report'}</button>
                      <span style={{ color: styles.colors.textMuted, fontSize: '13px' }}>Athlete interviews only</span>
                    </div>
                    {trendsReport && (
                      <div style={{ ...card, padding: '24px' }}>
                        <h2 style={{ color: styles.colors.text, fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Pattern Analysis ({trendsReport.totalCalls} calls)</h2>
                        {trendsReport.patterns.map((pattern, i) => (
                          <div key={i} style={{ padding: '16px', backgroundColor: styles.colors.bg, borderRadius: '8px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <h3 style={{ color: styles.colors.text, fontSize: '16px', fontWeight: '600', margin: 0 }}>{pattern.issue}</h3>
                              <span style={{ backgroundColor: styles.colors.warning, color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>{pattern.count} calls ({pattern.percentage}%)</span>
                            </div>
                            <p style={{ color: styles.colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>{pattern.description}</p>
                            {pattern.examples.length > 0 && (
                              <div style={{ borderLeft: `2px solid ${styles.colors.border}`, paddingLeft: '12px' }}>
                                {pattern.examples.map((ex, j) => <p key={j} style={{ color: styles.colors.text, fontSize: '13px', margin: '4px 0', fontStyle: 'italic' }}>"{ex}"</p>)}
                              </div>
                            )}
                          </div>
                        ))}
                        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: styles.colors.accentDim, borderRadius: '8px' }}>
                          <h3 style={{ color: styles.colors.accent, fontSize: '14px', fontWeight: '700', margin: '0 0 8px' }}>📌 Training Recommendation</h3>
                          <p style={{ color: styles.colors.text, fontSize: '14px', margin: 0 }}>{trendsReport.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SUBMISSIONS TAB */}
                {adminTab === 'submissions' && (
                  <>
                    {selectedSubmission ? (
                      <div>
                        <button onClick={() => setSelectedSubmission(null)} style={{ ...ghostBtn, marginBottom: '16px' }}>← Back to List</button>
                        {renderDetail(selectedSubmission, { admin: true })}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | CallType)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }}>
                            <option value="all">All Call Types</option><option value="athlete">Athlete Interviews</option><option value="parent">Parent Calls</option>
                          </select>
                          <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }}>
                            <option value="all">All Reps</option>
                            {repNames.map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }}>
                            <option value="all">All Grades</option><option value="A">A Range</option><option value="B">B Range</option><option value="C">C or Below</option>
                          </select>
                          <select value={filterDateRange} onChange={(e) => setFilterDateRange(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }}>
                            <option value="all">All Time</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">Last 30 Days</option><option value="custom">Custom Range</option>
                          </select>
                          {filterDateRange === 'custom' && (
                            <>
                              <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }} />
                              <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} style={{ padding: '10px 16px', backgroundColor: styles.colors.bgCard, border: `1px solid ${styles.colors.border}`, borderRadius: '8px', color: styles.colors.text, fontSize: '14px' }} />
                            </>
                          )}
                        </div>
                        {selectedIds.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: styles.colors.bgCard, borderRadius: '8px', marginBottom: '16px' }}>
                            <span style={{ color: styles.colors.text, fontSize: '14px' }}>{selectedIds.length} selected</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={downloadSelectedSubmissions} style={{ padding: '8px 16px', backgroundColor: styles.colors.accent, color: '#000', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>📥 Download</button>
                              <button onClick={deleteSelectedSubmissions} style={{ padding: '8px 16px', backgroundColor: styles.colors.danger, color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>🗑️ Delete</button>
                            </div>
                          </div>
                        )}
                        <div style={{ ...card, overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '40px 1.4fr 110px 1fr 80px 110px 110px 40px', gap: '12px', padding: '16px 24px', backgroundColor: styles.colors.bg, borderBottom: `1px solid ${styles.colors.border}`, alignItems: 'center' }}>
                            <input type="checkbox" checked={filteredSubmissions.length > 0 && filteredSubmissions.every(s => selectedIds.includes(s.id))} onChange={toggleSelectAll} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: styles.colors.accent }} />
                            {['Athlete', 'Type', 'Rep', 'Grade', 'Call Date', 'Submitted'].map(h => <span key={h} style={{ color: styles.colors.textMuted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>)}
                            <span></span>
                          </div>
                          {filteredSubmissions.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: styles.colors.textMuted }}>No submissions found</div>
                          ) : filteredSubmissions.map(sub => (
                            <div key={sub.id} onClick={() => { setSelectedSubmission(sub); setDetailTab('results'); }}
                              style={{ display: 'grid', gridTemplateColumns: '40px 1.4fr 110px 1fr 80px 110px 110px 40px', gap: '12px', padding: '16px 24px', borderBottom: `1px solid ${styles.colors.border}`, backgroundColor: selectedIds.includes(sub.id) ? 'rgba(34, 197, 94, 0.1)' : sub.flagged ? 'rgba(239, 68, 68, 0.05)' : 'transparent', alignItems: 'center', cursor: 'pointer' }}>
                              <input type="checkbox" checked={selectedIds.includes(sub.id)} onChange={(e) => { e.stopPropagation(); toggleSelectSubmission(sub.id); }} onClick={(e) => e.stopPropagation()} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: styles.colors.accent }} />
                              <span style={{ color: styles.colors.text, fontSize: '14px', fontWeight: '600' }}>{sub.flagged && <span style={{ marginRight: '8px' }}>🚩</span>}{sub.athleteName}{sub.callType === 'parent' && sub.outcome && <span style={{ display: 'block', color: styles.colors.textMuted, fontSize: '12px', fontWeight: '400' }}>{sub.outcome}</span>}</span>
                              <span><TypeBadge type={sub.callType} /></span>
                              <span style={{ color: styles.colors.textMuted, fontSize: '14px' }}>{sub.repName}</span>
                              <GradeBadge grade={sub.grade} />
                              <span style={{ color: styles.colors.text, fontSize: '13px' }}>{sub.interviewDate ? fmtDate(sub) : '—'}</span>
                              <span style={{ color: styles.colors.textMuted, fontSize: '13px' }}>{new Date(sub.timestamp).toLocaleDateString()}</span>
                              <span style={{ color: styles.colors.textMuted, fontSize: '14px' }}>→</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
