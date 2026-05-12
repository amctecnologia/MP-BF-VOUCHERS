import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function PendenteBadge() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetch = () =>
      api.get('/lancamentos/pendentes/count').then((r) => setTotal(r.data.total)).catch(() => {});
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!total) return null;
  return (
    <span className="bg-accent text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
      {total > 99 ? '99+' : total}
    </span>
  );
}
