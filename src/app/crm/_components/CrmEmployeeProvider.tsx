'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  accessFromEmployeeRow,
  FULL_CRM_PERMISSIONS,
  type CrmProfileAccess,
  type EmployeeRbacRow,
} from '@/lib/crm-permissions';
import { isEmergencyCrmOwnerBypass } from '@/lib/crm-roles';
import { supabase } from '@/lib/supabase';

export type EmployeeRow = {
  id: string;
  full_name: string;
  role?: string | null;
  job_title?: string | null;
};

type Ctx = {
  employee: EmployeeRow | null;
  profileAccess: CrmProfileAccess | null;
  /** آخر صف employees خام — للتشخيص */
  employeeDbRow: EmployeeRbacRow | null;
  authUserId: string | null;
  authEmail: string | null;
  loading: boolean;
  employeeError: string | null;
  reload: () => Promise<void>;
};

const CrmEmployeeContext = createContext<Ctx>({
  employee: null,
  profileAccess: null,
  employeeDbRow: null,
  authUserId: null,
  authEmail: null,
  loading: true,
  employeeError: null,
  reload: async () => {},
});

const PROFILE_STORAGE_KEY = 'wanderloom_profile';

function toEmployeeRow(row: EmployeeRbacRow | null): EmployeeRow | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? '').trim(),
    role: row.role ?? null,
    job_title: row.job_title ?? null,
  };
}

async function fetchEmployeeByAuth(userId: string, email: string | null) {
  if (!supabase) return { data: null, error: new Error('Supabase غير مهيأ') };

  const byUserId = await supabase.from('employees').select('*').eq('user_id', userId).maybeSingle();
  console.log('Auth Debug - user_id query:', { userId, data: byUserId.data, error: byUserId.error });

  if (!byUserId.error && byUserId.data) return byUserId;

  if (email) {
    const byEmail = await supabase.from('employees').select('*').eq('email', email).maybeSingle();
    console.log('Auth Debug - email query:', { email, data: byEmail.data, error: byEmail.error });
    if (!byEmail.error && byEmail.data) return byEmail;
  }

  return byUserId.error ? byUserId : { data: null, error: null };
}

export function CrmEmployeeProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [profileAccess, setProfileAccess] = useState<CrmProfileAccess | null>(null);
  const [employeeDbRow, setEmployeeDbRow] = useState<EmployeeRbacRow | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) {
      setEmployee(null);
      setProfileAccess(null);
      setEmployeeDbRow(null);
      setAuthUserId(null);
      setAuthEmail(null);
      setEmployeeError(null);
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log('Auth Debug - Email:', user?.email);
    console.log('Auth Debug - Auth User ID:', user?.id);

    if (!user) {
      setEmployee(null);
      setProfileAccess(null);
      setEmployeeDbRow(null);
      setAuthUserId(null);
      setAuthEmail(null);
      setEmployeeError(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('wanderloom_employee');
        window.sessionStorage.removeItem(PROFILE_STORAGE_KEY);
      }
      setLoading(false);
      return;
    }
    const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
    setAuthUserId(user.id);
    setAuthEmail(normalizedEmail);

    if (isEmergencyCrmOwnerBypass(normalizedEmail)) {
      console.log('Auth Debug - Emergency owner bypass ACTIVE for', normalizedEmail);
      const emergencyAccess: CrmProfileAccess = {
        is_admin: true,
        is_expert: false,
        is_suspended: false,
        permissions: { ...FULL_CRM_PERMISSIONS },
      };
      setEmployee({
        id: 'emergency-owner',
        full_name: 'Owner (Emergency Bypass)',
        role: 'Admin',
        job_title: 'CRM Admin',
      });
      setEmployeeDbRow(null);
      setProfileAccess(emergencyAccess);
      setEmployeeError(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          'wanderloom_employee',
          JSON.stringify({ id: 'emergency-owner', full_name: 'Owner', role: 'Admin' }),
        );
        window.sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(emergencyAccess));
      }
      setLoading(false);
      return;
    }

    const employeeResult = await fetchEmployeeByAuth(user.id, normalizedEmail);
    console.log('Auth Debug - DB Result:', employeeResult.data);
    console.log('Auth Debug - DB Error:', employeeResult.error);

    if (employeeResult.error) {
      console.error('[CrmEmployee] employees select:', employeeResult.error);
      setEmployee(null);
      setEmployeeDbRow(null);
      setProfileAccess(accessFromEmployeeRow(null, normalizedEmail));
      setEmployeeError(employeeResult.error.message || 'تعذر تحميل ملف الموظف من قاعدة البيانات.');
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('wanderloom_employee');
        window.sessionStorage.removeItem(PROFILE_STORAGE_KEY);
      }
      setLoading(false);
      return;
    }

    const rbacRow = (employeeResult.data ?? null) as EmployeeRbacRow | null;
    const row = toEmployeeRow(rbacRow);
    const access = accessFromEmployeeRow(rbacRow, normalizedEmail);

    console.log('Auth Debug - Resolved Access:', access);

    if (!row && process.env.NODE_ENV === 'development') {
      console.warn('[CrmEmployee] لا يوجد صف employees لهذا المستخدم:', user.id);
    }

    setEmployee(row);
    setEmployeeDbRow(rbacRow);
    setProfileAccess(access);
    setEmployeeError(null);

    if (typeof window !== 'undefined') {
      if (row) window.sessionStorage.setItem('wanderloom_employee', JSON.stringify(row));
      else window.sessionStorage.removeItem('wanderloom_employee');
      window.sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(access));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <CrmEmployeeContext.Provider
      value={{
        employee,
        profileAccess,
        employeeDbRow,
        authUserId,
        authEmail,
        loading,
        employeeError,
        reload,
      }}
    >
      {children}
    </CrmEmployeeContext.Provider>
  );
}

export function useCrmEmployee() {
  return useContext(CrmEmployeeContext);
}
