/**
 * Tipos locais das tabelas walk-in.
 *
 * Esses tipos espelham a migration `19_estetica_walkin.sql`. Quando o usuário
 * rodar `npx supabase gen types typescript` após aplicar a migration, esses
 * tipos vão aparecer em `database.types.ts` e este arquivo pode ser removido
 * (ou virar re-export).
 */

export type WalkinPaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao_debito"
  | "cartao_credito"
  | "transferencia"
  | "outro";

export type WalkinPaymentStatus = "pago" | "pendente" | "isento";

export type WalkinServiceStatus = "in_progress" | "done" | "canceled";

export interface EsteticaCustomerRow {
  id: string;
  full_name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  notes: string | null;
  profile_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EsteticaCustomerInsert {
  full_name: string;
  phone: string;
  cpf?: string | null;
  email?: string | null;
  notes?: string | null;
  profile_id?: string | null;
  created_by: string;
}

export interface EsteticaVehicleRow {
  id: string;
  customer_id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  moto_photo_path: string | null;
  plate_photo_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsteticaVehicleInsert {
  customer_id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  moto_photo_path?: string | null;
  plate_photo_path?: string | null;
  notes?: string | null;
}

export interface EsteticaWalkinServiceRow {
  id: string;
  vehicle_id: string;
  customer_id: string;
  service_id: string | null;
  admin_id: string;
  price_cents: number;
  payment_method: WalkinPaymentMethod;
  payment_status: WalkinPaymentStatus;
  status: WalkinServiceStatus;
  moto_photo_path: string | null;
  plate_photo_path: string | null;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsteticaWalkinServiceInsert {
  vehicle_id: string;
  customer_id: string;
  service_id?: string | null;
  admin_id: string;
  price_cents: number;
  payment_method: WalkinPaymentMethod;
  payment_status?: WalkinPaymentStatus;
  status?: WalkinServiceStatus;
  moto_photo_path?: string | null;
  plate_photo_path?: string | null;
  notes?: string | null;
  completed_at?: string | null;
}
