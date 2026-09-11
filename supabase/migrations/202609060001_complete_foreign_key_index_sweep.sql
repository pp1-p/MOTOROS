begin;

-- =============================================================================
-- MOTOR.OS · Final foreign-key index sweep.
--
-- 202608010001 adds named indexes for the operational foreign keys that are
-- used most heavily by the application. The Supabase advisor, correctly,
-- also reports audit and administrative foreign keys when no covering index
-- exists. This migration closes that remaining gap after every current schema
-- migration has run.
--
-- The block only creates an index when an existing valid index does not start
-- with the FK columns in the same order. Primary/unique and partial indexes
-- therefore count as coverage, matching PostgreSQL/Supabase advisor semantics.
-- =============================================================================

do $$
declare
  fk record;
  has_covering_index boolean;
  columns_sql text;
  generated_index_name text;
begin
  for fk in
    select
      constraint_row.oid as constraint_oid,
      constraint_row.conrelid as table_oid,
      namespace_row.nspname as schema_name,
      table_row.relname as table_name,
      constraint_row.conname as constraint_name,
      constraint_row.conkey as key_columns
    from pg_constraint as constraint_row
    join pg_class as table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace as namespace_row
      on namespace_row.oid = table_row.relnamespace
    where constraint_row.contype = 'f'
      and namespace_row.nspname = 'public'
    order by table_row.relname, constraint_row.conname
  loop
    select exists (
      select 1
      from pg_index as index_row
      where index_row.indrelid = fk.table_oid
        and index_row.indisvalid
        and index_row.indisready
        and not exists (
          select 1
          from unnest(fk.key_columns) with ordinality
            as required_column(attnum, position)
          where index_row.indkey[(required_column.position - 1)::integer]
                  is distinct from required_column.attnum
        )
    )
    into has_covering_index;

    if has_covering_index then
      continue;
    end if;

    select string_agg(
      format('%I', attribute_row.attname),
      ', '
      order by required_column.position
    )
    into columns_sql
    from unnest(fk.key_columns) with ordinality
      as required_column(attnum, position)
    join pg_attribute as attribute_row
      on attribute_row.attrelid = fk.table_oid
     and attribute_row.attnum = required_column.attnum;

    if columns_sql is null then
      raise exception
        'Could not resolve columns for foreign key %.%',
        fk.table_name,
        fk.constraint_name;
    end if;

    generated_index_name :=
      left(format('%s_%s', fk.table_name, fk.constraint_name), 45)
      || '_'
      || substr(
        md5(fk.schema_name || '.' || fk.table_name || '.' || fk.constraint_name),
        1,
        10
      )
      || '_fk_idx';

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      generated_index_name,
      fk.schema_name,
      fk.table_name,
      columns_sql
    );
  end loop;
end;
$$;

commit;
