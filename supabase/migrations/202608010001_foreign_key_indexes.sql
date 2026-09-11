begin;

-- =============================================================================
-- MOTOR.OS · Cover unindexed foreign keys the Supabase advisor flags.
--
-- Postgres does not create an index for a FK column automatically. Without
-- one, every parent-row DELETE or UPDATE must scan the child table, and
-- child-side lookups by parent id degrade to seq scans as data grows.
--
-- Scope: high-cardinality domain FKs used in admin UI joins/filters. We
-- intentionally skip audit-only `_by` columns (created_by / updated_by /
-- similar) — they're never queried, and indexing them just taxes writes.
-- =============================================================================

create index if not exists appointments_customer_idx_fk
  on public.appointments (customer_id) where customer_id is not null;
create index if not exists appointments_customer_vehicle_idx_fk
  on public.appointments (customer_vehicle_id) where customer_vehicle_id is not null;
create index if not exists appointments_lead_idx_fk
  on public.appointments (lead_id) where lead_id is not null;
create index if not exists appointments_assigned_user_idx_fk
  on public.appointments (assigned_user_id) where assigned_user_id is not null;

create index if not exists customer_vehicles_stock_vehicle_idx_fk
  on public.customer_vehicles (stock_vehicle_id) where stock_vehicle_id is not null;
create index if not exists customers_merged_into_idx_fk
  on public.customers (merged_into_customer_id) where merged_into_customer_id is not null;

create index if not exists documents_customer_idx_fk
  on public.documents (customer_id) where customer_id is not null;
create index if not exists documents_lead_idx_fk
  on public.documents (lead_id) where lead_id is not null;
create index if not exists documents_repair_job_idx_fk
  on public.documents (repair_job_id) where repair_job_id is not null;
create index if not exists documents_sale_idx_fk
  on public.documents (sale_id) where sale_id is not null;
create index if not exists documents_sourcing_request_idx_fk
  on public.documents (sourcing_request_id) where sourcing_request_id is not null;
create index if not exists documents_vehicle_idx_fk
  on public.documents (vehicle_id) where vehicle_id is not null;
create index if not exists documents_appointment_idx_fk
  on public.documents (appointment_id) where appointment_id is not null;

create index if not exists invoice_activity_actor_idx_fk
  on public.invoice_activity (actor_user_id) where actor_user_id is not null;

create index if not exists invoice_credit_notes_customer_idx_fk
  on public.invoice_credit_notes (customer_id) where customer_id is not null;
create index if not exists invoice_credit_notes_refunded_payment_idx_fk
  on public.invoice_credit_notes (refunded_payment_id) where refunded_payment_id is not null;

create index if not exists invoices_customer_idx_fk
  on public.invoices (customer_id) where customer_id is not null;
create index if not exists invoices_sourcing_request_idx_fk
  on public.invoices (sourcing_request_id) where sourcing_request_id is not null;
create index if not exists invoices_vehicle_idx_fk
  on public.invoices (vehicle_id) where vehicle_id is not null;

create index if not exists leads_customer_idx_fk
  on public.leads (customer_id) where customer_id is not null;
create index if not exists leads_sourcing_request_idx_fk
  on public.leads (sourcing_request_id) where sourcing_request_id is not null;
create index if not exists leads_vehicle_idx_fk
  on public.leads (vehicle_id) where vehicle_id is not null;
create index if not exists leads_assigned_user_idx_fk
  on public.leads (assigned_user_id) where assigned_user_id is not null;

create index if not exists notification_receipts_user_idx_fk
  on public.notification_receipts (user_id);

create index if not exists repair_jobs_technician_idx_fk
  on public.repair_jobs (assigned_technician_id) where assigned_technician_id is not null;
create index if not exists repair_jobs_customer_idx_fk
  on public.repair_jobs (customer_id) where customer_id is not null;
create index if not exists repair_jobs_customer_vehicle_idx_fk
  on public.repair_jobs (customer_vehicle_id) where customer_vehicle_id is not null;

create index if not exists sales_customer_idx_fk
  on public.sales (customer_id) where customer_id is not null;
create index if not exists sales_lead_idx_fk
  on public.sales (lead_id) where lead_id is not null;
create index if not exists sales_salesperson_idx_fk
  on public.sales (salesperson_id) where salesperson_id is not null;
create index if not exists sales_vehicle_idx_fk
  on public.sales (vehicle_id) where vehicle_id is not null;

create index if not exists sourcing_activities_org_idx_fk
  on public.sourcing_activities (organisation_id);
create index if not exists sourcing_candidates_stock_vehicle_idx_fk
  on public.sourcing_candidates (stock_vehicle_id) where stock_vehicle_id is not null;
create index if not exists sourcing_requests_assigned_user_idx_fk
  on public.sourcing_requests (assigned_user_id) where assigned_user_id is not null;
create index if not exists sourcing_requests_converted_vehicle_idx_fk
  on public.sourcing_requests (converted_vehicle_id) where converted_vehicle_id is not null;
create index if not exists sourcing_requests_customer_idx_fk
  on public.sourcing_requests (customer_id) where customer_id is not null;
create index if not exists sourcing_requests_lead_idx_fk
  on public.sourcing_requests (lead_id) where lead_id is not null;

create index if not exists storage_cleanup_jobs_org_idx_fk
  on public.storage_cleanup_jobs (organisation_id);
create index if not exists task_comments_org_idx_fk
  on public.task_comments (organisation_id);

create index if not exists tasks_appointment_idx_fk
  on public.tasks (appointment_id) where appointment_id is not null;
create index if not exists tasks_assigned_user_idx_fk
  on public.tasks (assigned_user_id) where assigned_user_id is not null;
create index if not exists tasks_customer_idx_fk
  on public.tasks (customer_id) where customer_id is not null;
create index if not exists tasks_lead_idx_fk
  on public.tasks (lead_id) where lead_id is not null;
create index if not exists tasks_repair_job_idx_fk
  on public.tasks (repair_job_id) where repair_job_id is not null;
create index if not exists tasks_sale_idx_fk
  on public.tasks (sale_id) where sale_id is not null;
create index if not exists tasks_sourcing_request_idx_fk
  on public.tasks (sourcing_request_id) where sourcing_request_id is not null;
create index if not exists tasks_vehicle_idx_fk
  on public.tasks (vehicle_id) where vehicle_id is not null;

create index if not exists team_invitations_invited_by_idx_fk
  on public.team_invitations (invited_by) where invited_by is not null;
create index if not exists team_invitations_accepted_by_idx_fk
  on public.team_invitations (accepted_by) where accepted_by is not null;

create index if not exists vehicle_sync_records_vehicle_idx_fk
  on public.vehicle_sync_records (vehicle_id) where vehicle_id is not null;

commit;
