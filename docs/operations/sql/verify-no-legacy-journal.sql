-- Gate de exclusão do projeto Vercel executa-journal-preview.
-- Resultado esperado: zero linhas.

create temporary table legacy_domain_hits (
  table_schema text,
  table_name text,
  matches bigint
) on commit drop;

do $$
declare
  table_record record;
  match_count bigint;
begin
  for table_record in
    select tables.table_schema, tables.table_name
    from information_schema.tables
    where tables.table_schema in ('public', 'auth', 'storage')
      and tables.table_type = 'BASE TABLE'
  loop
    execute format(
      'select count(*) from %I.%I row_data where row_to_json(row_data)::text ilike $1',
      table_record.table_schema,
      table_record.table_name
    )
    into match_count
    using '%executa-journal-preview%';

    if match_count > 0 then
      insert into legacy_domain_hits values (
        table_record.table_schema,
        table_record.table_name,
        match_count
      );
    end if;
  end loop;
end $$;

select table_schema, table_name, matches
from legacy_domain_hits
order by table_schema, table_name;
