import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { ApiError } from '../../../shared/api-client/http-client.js';
import type { ExamLibraryGateway } from './exam-gateway.js';
import { ImportController, type ImportState } from './import-controller.js';

export const ExamLibraryGatewayContext = createContext<ExamLibraryGateway | null>(null);

export function useExamLibraryGateway(): ExamLibraryGateway {
  const g = useContext(ExamLibraryGatewayContext);
  if (!g) throw new Error('ExamLibraryGatewayContext.Provider is missing above this component');
  return g;
}

export function useImportExam(): { state: ImportState; ctrl: ImportController } {
  const gateway = useExamLibraryGateway();
  const [ctrl] = useState(() => new ImportController(gateway));
  const state = useSyncExternalStore(ctrl.subscribe, ctrl.getState);
  useEffect(() => () => ctrl.dispose(), [ctrl]);
  return { state, ctrl };
}

/** Delete with a busy flag and the server's reason on failure (409 when the exam was used by a session). */
export function useDeleteExam() {
  const gateway = useExamLibraryGateway();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  /** True when the exam is gone. */
  async function remove(id: number): Promise<boolean> {
    setDeleting(true);
    setError('');
    try { await gateway.deleteExam(id); return true; }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Không xoá được đề'); return false; }
    finally { setDeleting(false); }
  }
  return { remove, deleting, error };
}
