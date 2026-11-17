import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ExamSummary, GroupSummary, OutsiderPolicy, ScoreVisibility } from '../../../../shared/api/index.js';
import { parseEmailList } from '../../../../shared/email-list.js';
import { PREF_KEYS, readPref, writePref } from '../../../shared/storage/prefs.js';
import { Button } from '../../../shared/ui/Button.js';
import { Card } from '../../../shared/ui/Card.js';
import { EmailListPreview } from '../../../shared/ui/EmailListPreview.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { TextField } from '../../../shared/ui/TextField.js';
import { saveNote } from '../../../shared/ui/email-preview-rows.js';
import { useCreateSession } from '../application/session-admin-context.js';
import { ACCESS_CHOICES, accessBlocker, buildAccess, isAccessChoice, OUTSIDER_CHOICES, type AccessChoice } from '../domain/access-ui.js';
import { suggestSessionName } from '../domain/session-ui.js';
import { SCORE_VISIBILITY_CHOICES } from '../domain/score-visibility-ui.js';
import { MAX_TIME_LIMIT_MINUTES, MIN_TIME_LIMIT_MINUTES } from '../../../../shared/session-timer.js';
import { chosenTimeLimit, timeLimitHint } from '../domain/time-limit-ui.js';

const selectStyle = { width: '100%', height: 44, padding: '0 12px', font: 'var(--type-body)', fontSize: 16, color: 'var(--text-title)', background: 'var(--paper)', border: '1.5px solid var(--border-strong)', borderRadius: 'var(--radius-md)' } as const;
const hintStyle = { margin: 0, font: 'var(--type-meta)', color: 'var(--text-meta)' } as const;

export function CreateSessionForm({ exams, groups, initialExamId, onCancel }: { exams: ExamSummary[]; groups: GroupSummary[]; initialExamId: number | null; onCancel: () => void }) {
  const nav = useNavigate();
  const [examId, setExamIdRaw] = useState<number | ''>(exams.some(e => e.id === initialExamId) ? initialExamId! : '');
  // PRODUCT.md §7.27b: an exam with `duration` preselects "limited" with its minutes; picking another exam resets to its default.
  const durationOf = (id: number | '') => (id === '' ? null : exams.find(e => e.id === id)?.durationMinutes ?? null);
  const [limited, setLimited] = useState(() => durationOf(examId) !== null);
  const [minutes, setMinutes] = useState(() => String(durationOf(examId) ?? 30));
  const setExamId = (id: number | '') => {
    setExamIdRaw(id);
    const d = durationOf(id);
    setLimited(d !== null);
    setMinutes(String(d ?? 30));
  };
  const timeLimit = chosenTimeLimit(limited, minutes);
  const [name, setName] = useState('');
  const [shuffle, setShuffle] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  // Offer what the mentor used last time ("Chỉ nhóm" only makes sense when a group exists).
  const [choice, setChoice] = useState<AccessChoice>(() => { const last = readPref(PREF_KEYS.lastAccess); return isAccessChoice(last) && (last !== 'group' || groups.length > 0) ? last : 'free'; });
  const [groupId, setGroupId] = useState<number | null>(groups.length === 1 ? groups[0]!.id : null);
  const [tempText, setTempText] = useState('');
  const [tempDomain, setTempDomain] = useState('');
  const [outsiders, setOutsiders] = useState<OutsiderPolicy>('block');
  const [remind, setRemind] = useState(true);
  const [scoreVisibility, setScoreVisibility] = useState<ScoreVisibility>('on_submit');
  const { create: createSession, busy, error } = useCreateSession();
  const tempParse = useMemo(() => parseEmailList(tempText, tempDomain), [tempText, tempDomain]);
  const blocker = accessBlocker(choice, groupId, tempParse);
  const chosen = ACCESS_CHOICES.find(c => c.value === choice)!;
  const selectedGroup = groups.find(g => g.id === groupId);

  async function create() {
    if (examId === '' || blocker || timeLimit === undefined) return;
    writePref(PREF_KEYS.lastAccess, choice);
    const s = await createSession({
      examId, name: name.trim() || undefined, shuffle,
      autoApprove: choice === 'free' ? autoApprove : false,
      access: buildAccess(choice, groupId, tempParse),
      ...(choice === 'free' ? {} : { outsiderPolicy: outsiders }),
      scoreVisibility,
      timeLimitMinutes: timeLimit,
    });
    if (!s) return;
    if (choice === 'temp' && !remind) writePref(PREF_KEYS.saveReminderOff(s.id), '1');
    nav(`/admin/sessions/${s.id}`);
  }

  return (
    <Card title="Tạo phiên thi" tone="brand">
      <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Đề thi</span>
          <select value={examId} onChange={e => setExamId(e.target.value ? Number(e.target.value) : '')} style={selectStyle}>
            <option value="">Chọn đề…</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title} · {e.questionCount} câu{e.durationMinutes ? ` · ${e.durationMinutes} phút` : ''}</option>)}
          </select>
        </label>
        <TextField label="Tên phiên" value={name} onChange={setName} maxLength={80}
          placeholder={examId === '' ? 'vd. Ôn tập Git – lớp sáng' : suggestSessionName(exams.find(e => e.id === examId)?.title ?? '', new Date())}
          hint="Chỉ mentor thấy, để phân biệt khi mở nhiều phiên cùng lúc. Học viên và màn chiếu chỉ thấy tên đề." />

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          <legend style={{ padding: 0, marginBottom: 6, font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Ai được vào?</legend>
          <SegmentedControl ariaLabel="Ai được vào" value={choice} onChange={setChoice} items={ACCESS_CHOICES.map(c => ({ value: c.value, label: c.label, icon: c.icon }))} />
          <p style={hintStyle}>{chosen.hint}</p>

          {choice === 'free' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, font: 'var(--type-ui)', color: 'var(--text-title)', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--brand-600)' }} />
              <span>Tự động duyệt người vào<br /><span style={hintStyle}>Tắt: bạn duyệt từng tên (tránh một người vào bằng nhiều tên). Bật khi cả nhóm là người quen.</span></span>
            </label>
          )}

          {choice === 'group' && (
            groups.length === 0 ? (
              <ErrorMessage tone="warning" message="Chưa có nhóm nào. Tạo nhóm ở mục Nhóm, hoặc chọn “Danh sách tạm” để dán email ngay." onRetry={() => nav('/admin/groups')} retryLabel="Tạo nhóm" />
            ) : (
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Nhóm</span>
                <select value={groupId ?? ''} onChange={e => setGroupId(e.target.value ? Number(e.target.value) : null)} style={selectStyle}>
                  <option value="">Chọn nhóm…</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} · {g.emailCount} email</option>)}
                </select>
                {selectedGroup && <span style={hintStyle}>Phiên giữ một bản sao danh sách lúc tạo: sửa nhóm sau này không ảnh hưởng phiên này.</span>}
              </label>
            )
          )}

          {choice === 'temp' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>
                <TextField label="Danh sách email" multiline mono rows={6} value={tempText} onChange={setTempText} spellCheck={false}
                  placeholder={'phi78@gmail.com\nphi89@gmail.com'} hint="Mỗi dòng một email, hoặc cách nhau bằng dấu phẩy." />
                <TextField label="Domain mặc định" value={tempDomain} onChange={setTempDomain} placeholder="gmail.com" spellCheck={false} hint="Dòng nào chưa có @ sẽ được thêm domain này." />
              </div>
              <EmailListPreview parse={tempParse} maxHeight={200} />
              {saveNote(tempParse) && <span style={hintStyle}>{saveNote(tempParse)}</span>}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--type-ui)', color: 'var(--text-title)', cursor: 'pointer' }}>
                <input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-600)' }} />
                Nhắc tôi lưu thành nhóm khi phiên kết thúc
              </label>
            </div>
          )}

          {choice !== 'free' && (
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Người ngoài danh sách</span>
              <SegmentedControl ariaLabel="Người ngoài danh sách" size="sm" value={outsiders} onChange={setOutsiders} items={OUTSIDER_CHOICES.map(o => ({ value: o.value, label: o.label }))} />
              <p style={hintStyle}>{OUTSIDER_CHOICES.find(o => o.value === outsiders)!.hint}</p>
            </div>
          )}
        </fieldset>

        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Thời gian làm bài</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <SegmentedControl ariaLabel="Thời gian làm bài" size="sm" value={limited ? 'limited' : 'none'} onChange={v => setLimited(v === 'limited')}
              items={[{ value: 'none', label: 'Không giới hạn' }, { value: 'limited', label: 'Giới hạn' }]} />
            {limited && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: 'var(--type-ui)', color: 'var(--text-title)' }}>
                <input type="number" inputMode="numeric" min={MIN_TIME_LIMIT_MINUTES} max={MAX_TIME_LIMIT_MINUTES} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} aria-label="Số phút"
                  aria-invalid={timeLimit === undefined} style={{ ...selectStyle, width: 96, height: 36, borderColor: timeLimit === undefined ? 'var(--wrong-500)' : 'var(--border-strong)' }} />
                phút
              </label>
            )}
          </div>
          <p style={{ ...hintStyle, color: limited && timeLimit === undefined ? 'var(--wrong-600)' : 'var(--text-meta)' }}>{timeLimitHint(durationOf(examId), limited, minutes)}</p>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ font: 'var(--type-label)', fontSize: 13, color: 'var(--text-title)' }}>Điểm và bảng xếp hạng</span>
          <SegmentedControl ariaLabel="Điểm và bảng xếp hạng" size="sm" value={scoreVisibility} onChange={setScoreVisibility} items={SCORE_VISIBILITY_CHOICES.map(c => ({ value: c.value, label: c.label }))} />
          <p style={hintStyle}>{SCORE_VISIBILITY_CHOICES.find(c => c.value === scoreVisibility)!.hint}</p>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: 'var(--type-ui)', color: 'var(--text-title)', cursor: 'pointer' }}>
          <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-600)' }} />
          Trộn thứ tự câu hỏi và đáp án cho từng người
        </label>
        {choice !== 'free' && <p style={hintStyle}>Học viên nhập mã phòng, tên và email. Email chỉ bạn thấy; người trong danh sách vào thẳng, không cần bạn duyệt.</p>}
        {error && <ErrorMessage message={error} />}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button icon="plus" loading={busy} disabled={examId === '' || !!blocker || timeLimit === undefined} onClick={create}>Tạo phiên</Button>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Huỷ</Button>
          {blocker && examId !== '' && <span style={hintStyle}>{blocker}.</span>}
        </div>
      </div>
    </Card>
  );
}
