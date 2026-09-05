import { Component, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";

type Props = { children: ReactNode; onRetry?: () => void; resetKey?: string | number };

export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="app-recovery" lang="th" aria-labelledby="recovery-title">
        <h1 id="recovery-title">ไม่สามารถแสดงหน้านี้ได้</h1>
        <p role="alert">เกิดข้อผิดพลาดระหว่างเปิดหน้า กรุณาลองใหม่ ข้อมูลที่บันทึกไว้ยังคงอยู่</p>
        <div className="app-recovery-actions">
          <button type="button" className="primary-button" onClick={() => {
            this.props.onRetry?.();
            this.setState({ failed: false });
          }}><RotateCcw size={16} /> ลองใหม่</button>
          <a className="secondary-button" href="/">เปิดภาพรวมใหม่</a>
        </div>
      </section>
    );
  }
}
