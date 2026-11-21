import { useState } from 'react';
import type { HookConfig } from '../../../../shared/api/index.js';
import { Button } from '../../../shared/ui/Button.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl.js';
import { Spinner } from '../../../shared/ui/Spinner.js';
import { mText } from '../../../shared/ui/member/member-shell.js';
import { SETTINGS_LOCAL_PATH } from '../domain/removal.js';
import { CodeBlock } from './CodeBlock.js';
import { Callout, Mono, Paragraph, Step } from './parts.js';

type Way = 'ask' | 'manual';

const FOLDER_COMMANDS = ['mkdir bai-tap-training', 'cd bai-tap-training', 'claude'].join('\n');

/**
 * Screens 2-4 on one page: pick the exercise folder, add the member's own config, wait for the first signal.
 * Everything shown comes from the member's own `hook-config` and fixed text: nothing that was collected.
 */
export function InstallScreen({ config, configStatus, onRetryConfig, showHint, onWithdraw }: {
  config: HookConfig | null;
  configStatus: 'idle' | 'loading' | 'ok' | 'error';
  onRetryConfig: () => void;
  showHint: boolean;
  onWithdraw: () => void;
}) {
  const [way, setWay] = useState<Way>('ask');
  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={mText.label}>Cài kết nối</span>
        <h1 style={mText.h1}>Làm 3 bước trên laptop có Claude Code</h1>
        <p style={mText.meta}>Mất vài phút. Chỉ làm trong thư mục bài tập training, không động tới cấu hình cấp máy.</p>
      </div>

      <Step n={1} title="Chọn một thư mục bài tập riêng">
        <Paragraph>Dùng một thư mục mới chỉ cho bài tập training, ví dụ <Mono>bai-tap-training</Mono>. Cấu hình bên dưới sẽ nằm trong thư mục này.</Paragraph>
        <Callout tone="warn" icon="triangle-alert" title="Không dùng repo của công ty hay dự án thật">
          Claude Code mở trong thư mục này mới gửi dữ liệu về máy mentor. Đừng đặt cấu hình vào <Mono>~/.claude/settings.json</Mono> (cấu hình cấp máy): như vậy prompt của mọi dự án khác cũng bị gửi.
        </Callout>
        <CodeBlock label="Gõ trong terminal (hoặc tự tạo thư mục rồi mở Claude Code trong đó)" code={FOLDER_COMMANDS} maxHeight={140} />
      </Step>

      <Step n={2} title="Thêm cấu hình vào thư mục đó">
        <Callout tone="info" icon="info" title="Ghép vào, đừng ghi đè">
          File <Mono>{SETTINGS_LOCAL_PATH}</Mono> có thể đã có cấu hình khác: giữ nguyên chúng, chỉ thêm các mục hook mới.
        </Callout>
        <div style={{ overflowX: 'auto' }}>
          <SegmentedControl<Way> ariaLabel="Cách thêm cấu hình" value={way} onChange={setWay}
            items={[{ value: 'ask', label: 'A. Nhờ Claude Code', icon: 'sparkles' }, { value: 'manual', label: 'B. Tự ghép', icon: 'pencil' }]} />
        </div>

        {configStatus === 'error' && <ErrorMessage message="Chưa lấy được cấu hình của bạn từ máy mentor." onRetry={onRetryConfig} />}
        {(configStatus === 'idle' || configStatus === 'loading') && <Spinner label="Đang lấy cấu hình của bạn…" />}
        {config && way === 'ask' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <Paragraph>Cách này dễ nhất. Mở Claude Code trong thư mục bài tập, sao chép câu bên dưới rồi dán vào. Claude Code sẽ tự ghép cấu hình và nói lại cho bạn biết đã thêm gì.</Paragraph>
            <CodeBlock label="Câu nhờ Claude Code ghép cấu hình" code={config.mergePrompt} maxHeight={300} />
          </div>
        )}
        {config && way === 'manual' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <Paragraph>Mở (hoặc tạo) file <Mono>{SETTINGS_LOCAL_PATH}</Mono> trong thư mục bài tập. Nếu file đã có mục <Mono>"hooks"</Mono>, thêm các phần tử dưới đây vào từng mảng cùng tên; nếu chưa có, thêm cả khối <Mono>"hooks"</Mono>.</Paragraph>
            <CodeBlock label={`Đoạn cấu hình để ghép vào ${SETTINGS_LOCAL_PATH}`} code={JSON.stringify(config.settings, null, 2)} maxHeight={340} />
            <Callout tone="warn" icon="triangle-alert" title="Chỉ file trong thư mục bài tập">
              Không dán vào <Mono>~/.claude/settings.json</Mono> và không thay cả file bằng đoạn này.
            </Callout>
          </div>
        )}
        <Callout tone="neutral" icon="shield-alert" title="Hộp thoại tin cậy thư mục">
          Lần đầu mở một thư mục, Claude Code hỏi bạn có tin cậy thư mục này không. Lựa chọn được chọn sẵn là <b>"No, exit"</b>: nếu bấm Enter ngay, Claude Code sẽ <b>thoát</b>. Hãy chọn <b>"Yes, I trust this folder"</b>, nếu không cấu hình sẽ không chạy. Sau khi ghép xong, thoát Claude Code rồi mở lại trong thư mục này để cấu hình có hiệu lực.
        </Callout>
      </Step>

      <Step n={3} title="Gõ một prompt bất kỳ, rồi chờ tín hiệu">
        <Paragraph>Trong Claude Code (đã mở lại trong thư mục bài tập), gõ một prompt bất kỳ, ví dụ "xin chào". Trang này sẽ báo ngay khi nhận được.</Paragraph>
        <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1.5px dashed var(--border-strong)', background: 'var(--paper)' }}>
          <Spinner label="Đang chờ tín hiệu từ Claude Code của bạn…" />
        </div>
        {showHint && (
          <Callout tone="warn" icon="circle-alert" title="Chưa thấy tín hiệu sau 1 phút. Thử kiểm tra:">
            <ul style={{ margin: '4px 0 0', paddingLeft: 20, listStyle: 'disc', display: 'grid', gap: 4 }}>
              <li>Claude Code có đang mở <b>đúng thư mục bài tập</b> (nơi có <Mono>{SETTINGS_LOCAL_PATH}</Mono>) không?</li>
              <li>Bạn đã <b>thoát và mở lại</b> Claude Code sau khi ghép cấu hình chưa, và đã chọn <b>"Yes, I trust this folder"</b> ở hộp thoại tin cậy thư mục chưa?</li>
              <li>Gõ <Mono>/hooks</Mono> trong Claude Code: có thấy các mục <Mono>UserPromptSubmit</Mono>, <Mono>PostToolUse</Mono>, <Mono>PostToolUseFailure</Mono>, <Mono>PermissionRequest</Mono>, <Mono>Notification</Mono>, <Mono>PreCompact</Mono>, <Mono>SessionEnd</Mono>, <Mono>PostModelSwitch</Mono> (8 mục) không?</li>
              <li>Máy có <b>proxy hoặc phần mềm của công ty</b> chặn kết nối tới máy mentor không? Máy công ty có thể chặn hook gửi tới địa chỉ trong mạng nội bộ.</li>
              <li>Laptop có đang chung mạng Wi-Fi/LAN với máy mentor không?</li>
            </ul>
          </Callout>
        )}
      </Step>

      <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={mText.meta}>Không muốn tham gia nữa? Bạn rút lại đồng ý được bất cứ lúc nào.</span>
        <Button variant="secondary" size="lg" icon="log-out" onClick={onWithdraw}>Rút lại đồng ý</Button>
      </div>
    </div>
  );
}
