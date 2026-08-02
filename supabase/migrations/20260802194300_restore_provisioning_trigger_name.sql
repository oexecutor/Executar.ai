-- Mantém o nome histórico do trigger para compatibilidade com testes,
-- observabilidade e automações existentes. O comportamento não muda.
drop trigger if exists on_auth_user_created_personal_workspace on auth.users;
drop trigger if exists on_auth_user_created_create_workspace on auth.users;

create trigger on_auth_user_created_create_workspace
after insert on auth.users
for each row execute procedure app.create_personal_workspace();
