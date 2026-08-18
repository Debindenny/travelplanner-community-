/**
 * StaffRow — typed interface matching the current staff.component.ts literal shape.
 */
export interface StaffRow {
  id: string;
  displayCode: string;
  name: string;
  email: string;
  phone: string;
  role: 'Staff' | 'Manager' | 'Admin' | string;
  type: 'Couple' | 'Solo' | 'Family' | 'Friends' | string; // from current mock
  dateJoined: string;
  lastLogin: string;
  isActive: boolean;
  stats: {
    customers: number;
    itineraries: number;
    booked: number;
    pending: number;
    created: number;
  };
}

/** Staff KPIs */
export interface StaffKpis {
  total: number;
  active: number;
  inactive: number;
}

/** Staff list API response */
export interface StaffApiResponse {
  kpis: { total: number; active: number; inactive: number };
  items: StaffApiItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface StaffApiItem {
  id: string;
  display_code: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  date_joined: string;
  is_active: boolean;
}
