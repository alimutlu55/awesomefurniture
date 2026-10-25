-- Failed checkouts no longer count against the hourly limit, and a checkout that never reached the payment page
-- (no provider reference after five minutes) is closed. Only started, still-open or paid checkouts are counted.

create or replace function public.credits_create_order(
  p_user uuid, p_pack text, p_credits integer, p_amount integer, p_currency text, p_provider text, p_email text default null
) returns public.payment_orders
language plpgsql security definer set search_path = '' as $$
declare created public.payment_orders;
begin
  update public.payment_orders set status = 'expired', updated_at = now()
    where user_id = p_user and status = 'pending' and provider_ref is null and created_at < now() - interval '5 minutes';
  if (select count(*) from public.payment_orders
      where user_id = p_user and created_at > now() - interval '1 hour' and status <> 'expired') >= 20 then
    raise exception 'Too many checkouts started' using errcode = 'P0001', hint = 'RATE_LIMITED';
  end if;
  insert into public.payment_orders (user_id, pack_id, credits, amount, currency, provider, customer_email)
    values (p_user, p_pack, p_credits, p_amount, lower(p_currency), p_provider, p_email) returning * into created;
  return created;
end;
$$;
revoke all on function public.credits_create_order(uuid, text, integer, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.credits_create_order(uuid, text, integer, integer, text, text, text) to service_role;

-- Close what the earlier limit counted: checkouts that never got a payment page.
update public.payment_orders set status = 'expired', updated_at = now()
  where status = 'pending' and provider_ref is null and created_at < now() - interval '5 minutes';
