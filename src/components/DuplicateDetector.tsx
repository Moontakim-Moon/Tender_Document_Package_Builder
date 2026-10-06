import { useEffect } from 'react';
import { useAppContext } from '../store/AppContext';

/**
 * Invisible component that listens for 'check-duplicate' events
 * and updates file statuses after SHA-256 hashes are computed.
 */
export function DuplicateDetector() {
  const { state, updateFile } = useAppContext();

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, sha256 } = (e as CustomEvent<{ id: string; sha256: string }>).detail;

      // Find all files with the same hash
      const filesWithSameHash = state.uploadedFiles.filter(
        (f) => f.sha256 === sha256 && f.id !== id && f.status !== 'error'
      );

      if (filesWithSameHash.length > 0) {
        // Find the primary file (the first one added with this hash)
        const primaryFile = filesWithSameHash.find((f) => !f.duplicateOfId) ?? filesWithSameHash[0];
        
        // Mark current file as duplicate
        updateFile(id, {
          status: 'duplicate',
          duplicateOfId: primaryFile.id,
        });
      }
    };

    window.addEventListener('check-duplicate', handler);
    return () => window.removeEventListener('check-duplicate', handler);
  }, [state.uploadedFiles, updateFile]);

  return null;
}
