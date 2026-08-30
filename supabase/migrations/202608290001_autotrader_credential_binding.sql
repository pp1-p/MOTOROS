begin;

-- The Auto Trader credentials live only in the server environment. This
-- unique HMAC fingerprint binds that credential set to one dealership without
-- storing the API key, secret or advertiser ID in Postgres.
create unique index if not exists integration_settings_autotrader_binding_unique
  on public.integration_settings (
    (btrim(public_configuration ->> 'credential_binding'))
  )
  where provider = 'autotrader'
    and nullif(btrim(public_configuration ->> 'credential_binding'), '') is not null;

commit;
