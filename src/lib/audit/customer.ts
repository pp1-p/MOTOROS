type CustomerUpdateAuditInput = {
  organisationId: string;
  actorUserId: string;
  customerId: string;
  updates: Record<string, unknown>;
};

export function buildCustomerUpdateAuditEntry({
  organisationId,
  actorUserId,
  customerId,
  updates,
}: CustomerUpdateAuditInput) {
  return {
    organisation_id: organisationId,
    actor_user_id: actorUserId,
    action: "customer.updated",
    entity_type: "customer",
    entity_id: customerId,
    changed_fields: Object.keys(updates).sort(),
  };
}
