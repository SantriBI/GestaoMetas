'use client';

import { useEffect, useState } from 'react';
import { getRankingVendedores } from '@/lib/api';

export function useRankingVendedores() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getRankingVendedores()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
