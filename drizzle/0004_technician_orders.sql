-- Same gap as 0003, for orders: the case view joins the order (number, dates), so a technician
-- assigned to a case got a 404. Anyone who can access a case may read that case's order.
DROP POLICY orders_read ON public.orders;--> statement-breakpoint
CREATE POLICY orders_read ON public.orders FOR SELECT TO authenticated
  USING (
    app.is_org_staff(organization_id)
    OR app.owns_customer(customer_id)
    OR EXISTS (SELECT 1 FROM public.service_cases c WHERE c.order_id = orders.id AND app.can_access_case(c.id))
  );
