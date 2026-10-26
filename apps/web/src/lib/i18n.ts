import type { Role } from '@erp/contracts';

export const ROLE_LABELS_TH: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  PURCHASING: 'เจ้าหน้าที่จัดซื้อ',
  STORE_STAFF: 'พนักงานประจำสาขา',
  MANAGER: 'ผู้จัดการ',
};

export function formatStoreAssignment(storeId: string | null): string {
  if (!storeId) return 'ส่วนกลาง (ทุกสาขา)';
  return `สาขา ${storeId}`;
}

export const I18N = {
  appTitle: 'ระบบจัดการร้านค้า ERP',
  signOut: 'ออกจากระบบ',
  signingIn: 'กำลังเข้าสู่ระบบ…',
  signIn: 'เข้าสู่ระบบ',
  email: 'อีเมล',
  password: 'รหัสผ่าน',
  signInPrompt: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ',
  invalidCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  networkError: 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบการเชื่อมต่อ API',
  demoAccountsTitle: 'บัญชีทดสอบ (รหัสผ่าน: password)',
} as const;
