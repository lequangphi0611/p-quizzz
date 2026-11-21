import { useState } from 'react';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { PageCard, mText } from '../../../shared/ui/member/member-shell.js';
import { HOOK_EVENTS, SETTINGS_LOCAL_PATH, buildRemovalPrompt, ingestUrl } from '../domain/removal.js';
import { CodeBlock } from './CodeBlock.js';
import { Callout, Mono, Paragraph, Stack, StatusMark, Step } from './parts.js';

type Way = 'ask' | 'manual';

/** Step "Gỡ đúng đoạn đã thêm": ask Claude Code to remove it, or do it by hand. Shared by the stop-sending and stopped screens. */
function RemoveHowTo({ host }: { host: string }) {
  const [way, setWay] = useState<Way>('ask');
  return (
    <Step n={1} title="Gỡ đúng đoạn đã thêm">
      <div style={{ overflowX: 'auto' }}>
        <SegmentedControl<Way> ariaLabel="Cách gỡ cấu hình" value={way} onChange={setWay}
          items={[{ value: 'ask', label: 'A. Nhờ Claude Code gỡ', icon: 'sparkles' }, { value: 'manual', label: 'B. Tự xoá', icon: 'pencil' }]} />
      </div>
      {way === 'ask' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <Paragraph>Cách này dễ nhất. Mở Claude Code trong thư mục bài tập, sao chép câu bên dưới rồi dán vào.</Paragraph>
          <CodeBlock label="Câu nhờ Claude Code gỡ cấu hình" code={buildRemovalPrompt(host)} maxHeight={240} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <Paragraph>Mở <Mono>{SETTINGS_LOCAL_PATH}</Mono> trong thư mục bài tập. Xoá các mục hook có địa chỉ <Mono>{ingestUrl(host)}</Mono> trong {HOOK_EVENTS.map((e, i) => <span key={e}>{i > 0 && ', '}<Mono>{e}</Mono></span>)}.</Paragraph>
          <Paragraph>Chỉ xoá đúng đoạn đã thêm, giữ nguyên các cấu hình và hook khác. Nếu một mục hook hoặc cả khối <Mono>"hooks"</Mono> bị trống sau khi xoá, xoá luôn phần trống đó.</Paragraph>
        </div>
      )}
      <Callout tone="neutral" icon="info">Bạn đã mở Claude Code ở nhiều thư mục bài tập? Gỡ ở từng thư mục.</Callout>
    </Step>
  );
}

/** Screen 7: the mentor stopped recording. Loud notice, how to remove the config, then "Kiểm tra đã gỡ". */
export function RemoveScreen({ host, busy, message, onCheck }: { host: string; busy: boolean; message: string | null; onCheck: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <Callout tone="warn" icon="triangle-alert" alert title="Mentor đã dừng thu">
        Máy mentor không nhận thêm dữ liệu từ bạn nữa. Nhưng cấu hình vẫn còn trên máy bạn: Claude Code sẽ tiếp tục thử gửi tới <Mono>{ingestUrl(host)}</Mono> cho tới khi bạn gỡ nó.
      </Callout>

      <div style={{ display: 'grid', gap: 6 }}>
        <span style={mText.label}>Gỡ kết nối</span>
        <h1 style={mText.h1}>Gỡ cấu hình khỏi thư mục bài tập</h1>
      </div>

      <RemoveHowTo host={host} />

      <Step n={2} title="Kiểm tra đã gỡ">
        <Paragraph>Sau khi gỡ, thoát Claude Code rồi mở lại trong thư mục bài tập. Bấm nút dưới đây, gõ một prompt bất kỳ, rồi bấm "Xong". Nếu máy mentor không nhận được gì thì cấu hình đã gỡ.</Paragraph>
        {message && <ErrorMessage tone="warning" message={message} />}
        <div><Button size="lg" icon="circle-check" loading={busy} onClick={onCheck}>Kiểm tra đã gỡ</Button></div>
      </Step>
    </div>
  );
}

/** Screen 8, the check itself: type a prompt, then "Xong" (locked for the first 5 seconds, with the count). */
export function CheckScreen({ desk, secondsLeft, busy, message, onDone }: { desk: boolean; secondsLeft: number; busy: boolean; message: string | null; onDone: () => void }) {
  const locked = secondsLeft > 0;
  return (
    <PageCard desk={desk} center>
      <StatusMark icon="clock" tone="info" />
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={mText.h1}>Kiểm tra đã gỡ</h1>
        <p style={{ ...mText.meta, fontSize: 16 }}>Gõ một prompt bất kỳ trong Claude Code, rồi bấm <b>Xong</b>.</p>
        <p style={mText.meta}>Hãy mở Claude Code trong thư mục bài tập (mở lại nếu bạn vừa sửa file cấu hình). Máy mentor sẽ kiểm tra xem còn nhận được gì từ máy bạn không.</p>
      </div>
      {message && <ErrorMessage tone="warning" message={message} />}
      <Button size="lg" icon={locked ? 'lock' : 'check'} block={!desk} loading={busy} disabled={locked} onClick={onDone}>
        {locked ? `Xong (còn ${secondsLeft} giây)` : 'Xong'}
      </Button>
      <p style={mText.meta}>{locked ? 'Nút Xong mở sau 5 giây đầu, để kịp gõ prompt.' : 'Đã gõ prompt rồi? Bấm Xong.'}</p>
    </PageCard>
  );
}

/** Screen 8c: the check still received something. How to find what is left, then try again. */
export function CheckFailedScreen({ host, busy, onRetry }: { host: string; busy: boolean; onRetry: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Callout tone="wrong" icon="circle-alert" title="Vẫn còn nhận được tín hiệu">
        Trong lúc kiểm tra, máy mentor vẫn nhận được dữ liệu từ máy bạn: cấu hình chưa được gỡ hết.
      </Callout>
      <Stack>
        <h1 style={mText.h1}>Tìm chỗ còn sót, rồi kiểm tra lại</h1>
        <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', display: 'grid', gap: 10, font: 'var(--type-body)', fontSize: 15, color: 'var(--text-body)' }}>
          <li>Mở Claude Code trong thư mục bài tập rồi gõ <Mono>/hooks</Mono>. Xem các mục hook (<Mono>UserPromptSubmit</Mono>, <Mono>PostToolUse</Mono>, <Mono>PermissionRequest</Mono>, …): còn mục nào có địa chỉ <Mono>{ingestUrl(host)}</Mono> không?</li>
          <li>Xoá các mục đó khỏi <Mono>{SETTINGS_LOCAL_PATH}</Mono>. Nếu bạn từng đặt cấu hình ở chỗ khác, kiểm tra cả <Mono>.claude/settings.json</Mono> và <Mono>~/.claude/settings.json</Mono>.</li>
          <li>Đóng mọi cửa sổ Claude Code đang mở ở thư mục bài tập (cửa sổ cũ vẫn giữ cấu hình cũ), rồi mở lại một cửa sổ mới.</li>
          <li>Bấm "Kiểm tra lại" và làm lại như lần trước.</li>
        </ol>
        <div><Button size="lg" icon="refresh-cw" loading={busy} onClick={onRetry}>Kiểm tra lại</Button></div>
      </Stack>
    </div>
  );
}

/** Screen 8b: "Đã gỡ". Honest about what the check can show. */
export function RemovedScreen({ desk, onHome }: { desk: boolean; onHome: () => void }) {
  return (
    <PageCard desk={desk} center>
      <StatusMark icon="circle-check" tone="ok" />
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={mText.h1}>Đã gỡ</h1>
        <p style={{ ...mText.meta, fontSize: 16 }}>Máy mentor không còn nhận được tín hiệu từ máy bạn. Cảm ơn bạn đã tham gia buổi training.</p>
      </div>
      <p style={mText.meta}>Kết quả này là tự kiểm tra: nếu bạn quên gõ prompt trong lúc kiểm tra, kết quả cũng ra "Đã gỡ". Nếu không chắc, gõ <Mono>/hooks</Mono> trong Claude Code để xem còn hook nào không.</p>
      <Button variant="secondary" size="lg" icon="arrow-left" block={!desk} onClick={onHome}>Về trang đầu</Button>
    </PageCard>
  );
}

/**
 * Screen 10: the member pressed "Dừng gửi" while the training is open. Says plainly what happens to the data already sent (it stays
 * until the mentor approves deleting it or ends the training; the mentor sees their name) and how to remove the config.
 */
export function SendingStoppedScreen({ host }: { host: string }) {
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <Callout tone="warn" icon="log-out" alert title="Bạn đã dừng gửi">
        Máy mentor không nhận thêm dữ liệu từ bạn nữa. Nhưng cấu hình vẫn còn trên máy bạn: Claude Code sẽ tiếp tục thử gửi tới <Mono>{ingestUrl(host)}</Mono> cho tới khi bạn gỡ nó.
      </Callout>

      <Callout tone="neutral" icon="eye" title="Dữ liệu đã gửi trước đó">
        Dữ liệu bạn đã gửi vẫn nằm trên máy mentor. Nó chỉ bị xoá khi <b>mentor duyệt xoá</b> hoặc khi mentor bấm "Kết thúc". Mentor biết bạn đã dừng gửi và thấy tên bạn. Bạn không xem lại được dữ liệu này.
      </Callout>

      <div style={{ display: 'grid', gap: 6 }}>
        <span style={mText.label}>Gỡ kết nối</span>
        <h1 style={mText.h1}>Gỡ cấu hình khỏi thư mục bài tập</h1>
      </div>

      <RemoveHowTo host={host} />

      <Paragraph>Khi mentor bấm "Dừng thu", trang này sẽ cho bạn kiểm tra đã gỡ xong chưa.</Paragraph>
    </div>
  );
}

/** Screen 11: the mentor approved deleting this member's data after they stopped sending. */
export function DeletedScreen({ desk, onHome }: { desk: boolean; onHome: () => void }) {
  return (
    <PageCard desk={desk} center>
      <StatusMark icon="trash-2" tone="neutral" />
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={mText.h1}>Đã xoá dữ liệu</h1>
        <p style={{ ...mText.meta, fontSize: 15 }}>Mentor đã duyệt xoá dữ liệu bạn gửi trước khi dừng. Bạn không còn ở trong buổi training này.</p>
      </div>
      <p style={mText.meta}>Nếu cấu hình vẫn còn trong thư mục bài tập, hãy xoá các mục hook gửi tới máy mentor khỏi <Mono>.claude/settings.local.json</Mono>.</p>
      <Button size="lg" icon="arrow-left" block={!desk} onClick={onHome}>Về trang đầu</Button>
    </PageCard>
  );
}
