'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

export type EmployeeRow = {
  id: string;
  full_name: string;
  role?: string | null;
  job_title?: string | null;
};

type Ctx = {
  employee: EmployeeRow | null;
  /** بريد الجلسة الحالية (Auth) — للتحقق من تجاوز المدير المؤقت */
  authEmail: string | null;
  loading: boolean;
  employeeError: string | null;
  reload: () => Promise<void>;
};

const CrmEmployeeContext = createContext<Ctx>({
  employee: null,
  authEmail: null,
  loading: true,
  employeeError: null,
  reload: async () => {},
});

export function CrmEmployeeProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) {
      setEmployee(null);
      setAuthEmail(null);
      setEmployeeError(null);
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setEmployee(null);
      setAuthEmail(null);
      setEmployeeError(null);
      if (typeof window !== 'undefined') window.sessionStorage.removeItem('wanderloom_employee');
      setLoading(false);
      return;
    }
    const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
    setAuthEmail(normalizedEmail);
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, role, job_title')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('[CrmEmployee] employees select:', error);
      setEmployee(null);
      setEmployeeError(error.message || 'تعذر تحميل ملف الموظف من قاعدة البيانات.');
      if (typeof window !== 'undefined') window.sessionStorage.removeItem('wanderloom_employee');
      setLoading(false);
      return;
    }
    const row = (data ?? null) as EmployeeRow | null;
    if (!row && process.env.NODE_ENV === 'development') {
      console.warn('[CrmEmployee] لا يوجد صف employees لهذا المستخدم (أو role غير مرجع):', user.id);
    }
    setEmployee(row);
    setEmployeeError(null);
    if (typeof window !== 'undefined') {
      if (row) window.sessionStorage.setItem('wanderloom_employee', JSON.stringify(row));
      else window.sessionStorage.removeItem('wanderloom_employee');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <CrmEmployeeContext.Provider value={{ employee, authEmail, loading, employeeError, reload }}>
      {children}
    </CrmEmployeeContext.Provider>
  );
}

export function useCrmEmployee() {
  return useContext(CrmEmployeeContext);
}
