revoke execute on function public.resolve_qr_token(text) from public, anon;
revoke execute on function public.create_project_with_first_task(text,text,text,text[]) from public, anon;
revoke execute on function public.get_current_position(uuid) from public, anon;
revoke execute on function public.complete_task_step(uuid,integer,text) from public, anon;
revoke execute on function public.confirm_qr_action(text,text) from public, anon;

grant execute on function public.resolve_qr_token(text) to authenticated, service_role;
grant execute on function public.create_project_with_first_task(text,text,text,text[]) to authenticated, service_role;
grant execute on function public.get_current_position(uuid) to authenticated, service_role;
grant execute on function public.complete_task_step(uuid,integer,text) to authenticated, service_role;
grant execute on function public.confirm_qr_action(text,text) to authenticated, service_role;
