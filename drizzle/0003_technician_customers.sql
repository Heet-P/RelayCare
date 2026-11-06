-- Technicians list their jobs with the customer's name; they could not read customers at all, so
-- the job list's join returned nothing. Anyone who can access a case may read that case's customer.
DROP POLICY customers_read ON public.customers;--> statement-breakpoint
CREATE POLICY customers_read ON public.customers FOR SELECT TO authenticated
  USING (
    user_id = app.current_user_id()
    OR app.is_org_staff(organization_id)
    OR EXISTS (SELECT 1 FROM public.service_cases c WHERE c.customer_id = customers.id AND app.can_access_case(c.id))
  );
