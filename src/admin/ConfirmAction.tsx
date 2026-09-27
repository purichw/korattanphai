import { WorkspaceDialog } from '../components/WorkspaceDialog';

export function ConfirmAction({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return <WorkspaceDialog title={title} onClose={onCancel} closeLabel="กลับไปแก้ไข"><div className="cms-form"><p>{message}</p>
    <footer className="cms-actions"><button className="secondary-button" onClick={onCancel}>กลับไปแก้ไข</button>
      <button className="primary-button" onClick={onConfirm}>{confirmLabel}</button></footer></div></WorkspaceDialog>;
}
