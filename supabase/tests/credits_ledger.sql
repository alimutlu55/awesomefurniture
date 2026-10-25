-- Disposable integration fixtures for the credit ledger, rolled back at the end. Run on development.
begin;
insert into auth.users (id, email) values
  ('33333333-3333-4333-8333-333333333333', 'buyer@wardrobe-test.invalid'),
  ('44444444-4444-4444-8444-444444444444', 'other@wardrobe-test.invalid');

-- Buying: an order is credited once, whatever the number of webhooks; a wrong amount credits nothing.
do $$
declare ord public.payment_orders; bad public.payment_orders; result jsonb;
begin
  ord := public.credits_create_order('33333333-3333-4333-8333-333333333333', 'popular', 120, 999, 'USD', 'stripe');
  perform public.credits_attach_order(ord.id, 'cs_test_1');
  result := public.credits_complete_order(ord.id, 'stripe', 'cs_test_1', 'pi_test_1', 999, 'usd');
  if result->>'result' <> 'credited' or (result->>'balance')::int <> 120 then raise exception 'Order not credited: %', result; end if;
  result := public.credits_complete_order(ord.id, 'stripe', 'cs_test_1', 'pi_test_1', 999, 'usd');
  if result->>'result' <> 'already' then raise exception 'Replayed payment credited twice: %', result; end if;
  if public.credits_complete_order(ord.id, 'other', 'cs_test_1', 'pi_test_1', 999, 'usd')->>'result' <> 'unknown' then
    raise exception 'Another provider completed the order';
  end if;
  bad := public.credits_create_order('33333333-3333-4333-8333-333333333333', 'starter', 50, 499, 'usd', 'stripe');
  if public.credits_complete_order(bad.id, 'stripe', 'cs_test_2', 'pi_test_2', 100, 'usd')->>'result' <> 'mismatch' then
    raise exception 'A short payment was accepted';
  end if;
  if (select balance from public.credit_accounts where user_id = '33333333-3333-4333-8333-333333333333') <> 120 then
    raise exception 'A rejected payment changed the balance';
  end if;
end $$;

-- Spending: a reservation takes credits, releasing gives them back, the same key never charges twice.
do $$
declare first jsonb; again jsonb; poor jsonb; settled jsonb;
begin
  first := public.credits_spend('33333333-3333-4333-8333-333333333333', 'ai-image', 'image-request-0001', 4, 0, 0, null, false);
  if first->>'status' <> 'reserved' or (first->>'balance')::int <> 116 then raise exception 'Reservation wrong: %', first; end if;
  again := public.credits_spend('33333333-3333-4333-8333-333333333333', 'ai-image', 'image-request-0001', 4, 0, 0, null, false);
  if (again->>'replay')::boolean is not true or (again->>'balance')::int <> 116 then raise exception 'Retry charged twice: %', again; end if;
  settled := public.credits_settle((first->>'spend_id')::uuid, 'released');
  if (settled->>'balance')::int <> 120 then raise exception 'Release did not refund: %', settled; end if;
  settled := public.credits_settle((first->>'spend_id')::uuid, 'captured');
  if (settled->>'replay')::boolean is not true or settled->>'status' <> 'released' then raise exception 'A settled spend changed: %', settled; end if;
  poor := public.credits_spend('44444444-4444-4444-8444-444444444444', 'ai-image', 'image-request-0002', 4, 0, 0, null, false);
  if poor->>'status' <> 'insufficient' or exists (select 1 from public.credit_spends where idempotency_key = 'image-request-0002') then
    raise exception 'Spent without credits: %', poor;
  end if;
end $$;

-- Free uses and passes: the first drawing set is free and opens a pass for its design; another design pays.
do $$
declare r jsonb;
begin
  r := public.credits_spend('44444444-4444-4444-8444-444444444444', 'technical-drawings', 'drawings-key-0001', 10, 1, 24, 'design-a', true);
  if r->>'charge' <> 'free' or r->>'status' <> 'captured' or r->>'pass_expires_at' is null then raise exception 'First drawings not free: %', r; end if;
  r := public.credits_spend('44444444-4444-4444-8444-444444444444', 'technical-drawings', 'drawings-key-0002', 10, 1, 24, 'design-a', true);
  if r->>'charge' <> 'pass' then raise exception 'The open pass was not used: %', r; end if;
  r := public.credits_spend('44444444-4444-4444-8444-444444444444', 'technical-drawings', 'drawings-key-0003', 10, 1, 24, 'design-b', true);
  if r->>'status' <> 'insufficient' then raise exception 'A second design was free: %', r; end if;
  r := public.credits_spend('33333333-3333-4333-8333-333333333333', 'technical-drawings', 'drawings-key-0004', 10, 0, 24, 'design-c', true);
  if r->>'charge' <> 'paid' or (r->>'balance')::int <> 110 then raise exception 'Paid drawings wrong: %', r; end if;
end $$;

-- Refunds and chargebacks take credits back, even below zero; a won dispute restores them; replays change nothing.
do $$
declare ord uuid := (select id from public.payment_orders where provider_ref = 'cs_test_1'); r jsonb;
begin
  r := public.credits_adjust_order(ord, 'evt_refund_1', 'refunded', 500);
  if r->>'status' <> 'partially_refunded' or (r->>'credited')::int <> 59 then raise exception 'Partial refund wrong: %', r; end if;
  r := public.credits_adjust_order(ord, 'evt_refund_1', 'refunded', 500);
  if (select balance from public.credit_accounts where user_id = '33333333-3333-4333-8333-333333333333') <> 49 then
    raise exception 'Refund replay moved the balance';
  end if;
  perform public.credits_adjust_order(ord, 'evt_dispute_1', 'disputed');
  if (select balance from public.credit_accounts where user_id = '33333333-3333-4333-8333-333333333333') <> -10 then
    raise exception 'Chargeback did not take back the credits';
  end if;
  r := public.credits_spend('33333333-3333-4333-8333-333333333333', 'ai-image', 'image-request-0003', 4, 0, 0, null, false);
  if r->>'status' <> 'insufficient' then raise exception 'Spent from a negative balance: %', r; end if;
  perform public.credits_adjust_order(ord, 'evt_dispute_2', 'dispute_won');
  if (select balance from public.credit_accounts where user_id = '33333333-3333-4333-8333-333333333333') <> 49 then
    raise exception 'A won dispute did not restore the credits';
  end if;
end $$;

-- Stale reservations are given back; the ledger always adds up and cannot be rewritten.
do $$
declare r jsonb;
begin
  r := public.credits_spend('33333333-3333-4333-8333-333333333333', 'ai-image', 'image-request-0004', 4, 0, 0, null, false);
  update public.credit_spends set created_at = now() - interval '1 hour' where id = (r->>'spend_id')::uuid;
  if public.credits_release_stale(15) <> 1 then raise exception 'Stale reservation kept'; end if;
  if exists (select 1 from public.credits_audit()) then raise exception 'A balance differs from its ledger'; end if;
  begin
    update public.credit_ledger set delta = 1000 where user_id = '33333333-3333-4333-8333-333333333333';
    raise exception 'The ledger was rewritten';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.credit_ledger where user_id = '33333333-3333-4333-8333-333333333333';
    raise exception 'The ledger was deleted';
  exception when insufficient_privilege then null; end;
  if public.credits_grant('44444444-4444-4444-8444-444444444444', 25, 'ticket-1', 'Support') <> 25
    or public.credits_grant('44444444-4444-4444-8444-444444444444', 25, 'ticket-1', 'Support') <> 25 then
    raise exception 'Support grant not idempotent';
  end if;
end $$;

-- People read only their own credits and can call none of the functions.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.credit_ledger where user_id <> '44444444-4444-4444-8444-444444444444') then
    raise exception 'Another account''s ledger is visible';
  end if;
  if (select count(*) from public.credit_accounts) <> 1 then raise exception 'Account visibility wrong'; end if;
  begin
    perform public.credits_grant('44444444-4444-4444-8444-444444444444', 1000, 'self', 'Free money');
    raise exception 'A person granted themselves credits';
  exception when insufficient_privilege then null; end;
  begin
    update public.credit_accounts set balance = 1000000;
    raise exception 'A person changed their balance';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Deleting a person removes their credits with them.
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
do $$ begin
  if exists (select 1 from public.credit_ledger where user_id = '44444444-4444-4444-8444-444444444444') then
    raise exception 'Ledger rows outlived their account';
  end if;
end $$;
select 'credits ledger checks passed' as result;
rollback;
