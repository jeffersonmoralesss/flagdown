// A custom React hook: loads a driver's documents and gives back reload(). The setup screen and the
// home screen both need it, so it lives here once.
import { useCallback, useEffect, useState } from 'react';
import { listDocuments } from './api';

export function useDocuments(driverId) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setDocuments(await listDocuments(driverId));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { documents, loading, error, reload };
}
