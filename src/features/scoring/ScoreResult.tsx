import type { ScoreOutcome } from './useScoreSession.ts';

export const NAME_TAKEN_GUEST_TEXT =
  'Tên này thuộc về một thành viên. Hãy chọn tên khác hoặc đăng nhập.';

interface Props {
  outcome: ScoreOutcome;
  onSave: () => void;
  onRetry: () => void;
}

export function ScoreResult({ outcome, onSave, onRetry }: Props) {
  let content;
  switch (outcome.state) {
    case 'pending':
      content = <p>Đang lưu điểm…</p>;
      break;
    case 'saved':
      content = (
        <p>
          Đã lưu điểm: {outcome.score}. Hạng{' '}
          <strong data-testid="score-result-rank">#{outcome.rank}</strong>
          {outcome.personalBest ? ' (kỷ lục cá nhân)' : ''}
        </p>
      );
      break;
    case 'needs-name':
      content = (
        <>
          <p>Nhập tên để lưu điểm</p>
          <button type="button" data-testid="score-save" onClick={onSave}>
            Lưu điểm
          </button>
        </>
      );
      break;
    case 'name-taken':
      content = (
        <>
          <p>{NAME_TAKEN_GUEST_TEXT}</p>
          <button type="button" data-testid="score-save" onClick={onSave}>
            Lưu điểm
          </button>
        </>
      );
      break;
    case 'rejected':
      content = <p>Điểm của ván này không được ghi nhận.</p>;
      break;
    case 'expired':
      content = <p>Phiên chơi đã hết hạn, điểm không được lưu.</p>;
      break;
    case 'not-saved':
      content = <p>Không lưu được điểm cho ván này.</p>;
      break;
    case 'error':
      content = (
        <>
          <p>
            {outcome.rateLimited
              ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau.'
              : 'Không gửi được điểm. Kiểm tra kết nối và thử lại.'}
          </p>
          <button type="button" data-testid="score-retry" onClick={onRetry}>
            Thử lại
          </button>
        </>
      );
      break;
  }
  return (
    <div
      data-testid="score-result"
      data-state={outcome.state}
      role="status"
      className="score-result"
    >
      {content}
    </div>
  );
}
