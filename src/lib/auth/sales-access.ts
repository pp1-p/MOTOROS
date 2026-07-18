export const operationalSaleDetailSelect =
  "id,organisation_id,reference,vehicle_id,customer_id,lead_id,salesperson_id,status,sale_price,deposit,part_exchange_allowance,discount,warranty,additional_products,payment_method,sale_date,handover_date,completed_at,created_at,updated_at,deleted_at,vehicles(id,stock_number,registration,make,model,derivative),customers(id,full_name,email,phone)";

export const commercialSaleDetailSelect =
  "id,organisation_id,reference,vehicle_id,customer_id,lead_id,salesperson_id,status,sale_price,deposit,part_exchange_allowance,discount,warranty,additional_products,payment_method,sale_date,handover_date,completed_at,created_at,updated_at,deleted_at,gross_profit,internal_notes,vehicles(id,stock_number,registration,make,model,derivative),customers(id,full_name,email,phone)";

export function getSaleDetailSelect(canViewCommercial: boolean) {
  return canViewCommercial
    ? commercialSaleDetailSelect
    : operationalSaleDetailSelect;
}
